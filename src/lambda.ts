import { Err, fail, Failure, FailureException, Result } from '@alexshelkov/result';
import {
  AwsEvent,
  AwsHandler,
  Handler,
  HandlerError,
  HandlerException,
  Middleware,
  MiddlewareCreator,
  MiddlewareEvents,
  MiddlewareLifecycle,
  Request,
  ServiceContainer,
  ServiceOptions,
  Transform,
  TransformError,
} from './types';
import { json } from './transform';

type Executed = { [k in keyof MiddlewareEvents]: boolean };

const createLifecycleEvents = (): {
  events: MiddlewareEvents;
  lifecycle: MiddlewareLifecycle;
  executed: Executed;
} => {
  const events: MiddlewareEvents = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async destroy() {},
  };

  const lifecycle: MiddlewareLifecycle = {
    destroy(cb) {
      events.destroy = cb;
    },
  };

  const executed = {
    destroy: false,
  };

  return { events, lifecycle, executed };
};

export type UnhandledError = Err & { cause?: string };
export type UncaughtError = { type: 'UncaughtError' } & UnhandledError;
export type UncaughtErrorTransform = { type: 'UncaughtTransformError' } & UnhandledError;
export type UnhandledErrors = UncaughtError | UncaughtErrorTransform;

export const convertToFailure = (
  type: UnhandledErrors['type'],
  exception: unknown
): Failure<UnhandledErrors> => {
  let cause;
  let message;

  if (exception instanceof Error) {
    cause = exception.name;
    message = exception.message;
  } else {
    cause = 'Unknown';
    message = undefined;
  }

  const error = fail<UnhandledErrors>(type, { order: -1, message, cause });

  error.stack = exception instanceof Error ? exception.stack : error.stack;

  return error;
};

type FallBackTransform = (result: Result<unknown, unknown>) => Promise<unknown>;

let fallBackTransform: FallBackTransform = json;

export const getFallBackTransform = (): FallBackTransform => {
  return fallBackTransform;
};

export const resetFallBackTransform = (transform: FallBackTransform): void => {
  fallBackTransform = transform;
};

export const lambda = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  ResOk,
  ResErr,
  ResFatal,
  Service extends ServiceContainer,
  ServiceError,
  Data,
  Error,
  FailureData,
  FailureError,
  ExceptionData,
  ExceptionError
>(
  options: Options,
  creator: MiddlewareCreator<Options, Service, ServiceError, ServiceContainer, Event>,
  exception: HandlerException<ExceptionData, ExceptionError, Event, Options>,
  failure: HandlerError<ServiceError, FailureData, FailureError, Event, Options>,
  success: Handler<Service, Data, Error, Event, Options>,
  transform: Transform<ResOk, Event, Options, Service>,
  transformError: TransformError<ResErr, Event, Options>,
  transformException: TransformError<ResFatal, Event, Options>
): AwsHandler<Event, ResOk | ResErr | ResFatal> => {
  let middleware: Middleware<Service, ServiceError, ServiceContainer, Event> | undefined;
  let middlewareError: unknown;

  try {
    middleware = creator(options);
  } catch (err: unknown) {
    middlewareError = err;
  }

  return async (event: Event['event'], context: Event['context']) => {
    const { events, lifecycle } = createLifecycleEvents();

    const evObj = { event, context } as Event;

    let response;

    const handleServiceError = async (err: ServiceError) => {
      const result = await failure(
        {
          event,
          context,
          error: err,
        },
        options
      );

      return transformError(result, evObj, options);
    };

    const handleHandler = async (data: Request<Event, Service>) => {
      const result = await success(data, options);

      return transform(result, data, options);
    };

    const handleFailureError = async (err: FailureException<ServiceError>) => {
      const result = await failure(
        {
          event,
          context,
          error: err.error,
        },
        options
      );

      return transformError(result, evObj, options);
    };

    const handleFatalError = async (err: unknown) => {
      let result;

      try {
        result = await exception(
          {
            event,
            context,
            exception: err,
          },
          options
        );
      } catch (fatal) {
        result = convertToFailure('UncaughtError', fatal);
      }

      try {
        response = await transformException(result, evObj, options);
      } catch (fatal) {
        result = convertToFailure('UncaughtTransformError', fatal);
        response = (await getFallBackTransform()(result)) as Promise<ResFatal>;
      }

      return response;
    };

    const handleFatalLifecycleError = async (err: unknown) => {
      if (err instanceof FailureException) {
        try {
          return await handleFailureError(err);
        } catch (fatal: unknown) {
          err = fatal;
        }
      }

      return handleFatalError(err);
    };

    const handleCreationError = async (err: unknown) => {
      if (err instanceof FailureException) {
        try {
          return await handleFailureError(err);
        } catch (fatal: unknown) {
          err = fatal;
        }
      }

      return handleFatalError(err);
    };

    const tryDestroyAndNeverThrow = async () => {
      try {
        await events.destroy();
      } catch (fatal: unknown) {
        response = await handleFatalLifecycleError(fatal);
      }
    };

    if (!middleware) {
      return handleCreationError(middlewareError);
    }

    try {
      const service = await middleware(
        {
          event,
          context,
          service: {} as Service,
        },
        lifecycle
      );

      if (service.isErr()) {
        response = await handleServiceError(service.error);
        await tryDestroyAndNeverThrow();
      } else {
        try {
          response = await handleHandler(service.data);
          await tryDestroyAndNeverThrow();
        } catch (err) {
          if (err instanceof FailureException) {
            response = await handleFailureError(err);
            await tryDestroyAndNeverThrow();
          } else {
            throw err;
          }
        }
      }
    } catch (err: unknown) {
      // check if error is failed Jest assertion and throw it immediately
      if (
        err instanceof Error &&
        typeof ((err as unknown) as { matcherResult: unknown }).matcherResult !== 'undefined'
      ) {
        throw err;
      }

      response = await handleFatalError(err);

      await tryDestroyAndNeverThrow();
    }

    return response;
  };
};
