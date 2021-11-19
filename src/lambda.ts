import { Failure, FailureException, fail, isFailureLike, isErr } from 'lambda-res';
import {
  AwsEvent,
  AwsHandler,
  Handler,
  HandlerError,
  HandlerException,
  Middleware,
  MiddlewareCreator,
  Request,
  ServiceContainer,
  ServiceOptions,
  Transform,
  TransformError,
  MiddlewareFail,
  UnhandledErrors,
  FallBackTransform,
} from './types';
import { json } from './transform';
import { createLifecycle, createHandlerLifecycle, createMiddlewareLifecycle } from './utils';

export const convertToFailure = (
  type: UnhandledErrors['type'],
  exception: unknown
): Failure<UnhandledErrors> => {
  let cause;
  let message;

  if (isFailureLike(exception) && isErr(exception.error)) {
    const { error } = exception;
    const { inner } = (error as unknown) as { inner: unknown };

    if (isFailureLike(inner) && isErr(inner.error)) {
      cause = `${error.type}: ${inner.error.type}`;
      message = `${error.message || ''}\n${inner.error.message || ''}`.trim() || undefined;
    } else {
      cause = error.type;
      message = error.message;
    }
  } else if (exception instanceof Error) {
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
  HandledError,
  ExceptionData,
  ExceptionError
>(
  options: Options,
  creator: MiddlewareCreator<Options, Service, ServiceError, ServiceContainer, Event>,
  exception: HandlerException<ExceptionData, ExceptionError, Event, Options>,
  failure: HandlerError<
    Service,
    ServiceError,
    FailureData,
    FailureError,
    HandledError,
    Event,
    Options
  >,
  success: Handler<Service, Data, Error, Event, Options>,
  transform: Transform<ResOk, Data, Error, Event, Options, Service>,
  transformError: TransformError<ResErr, FailureData, FailureError, Event, Options>,
  transformException: TransformError<ResFatal, ExceptionData, ExceptionError, Event, Options>
): AwsHandler<Event, ResOk | ResErr | ResFatal> => {
  let middleware: Middleware<Service, ServiceError, ServiceContainer, Event> | undefined;
  let middlewareError: unknown;

  const middlewareLifecycle = createMiddlewareLifecycle();

  try {
    middleware = creator(options, middlewareLifecycle);
  } catch (err: unknown) {
    middlewareError = err;
  }

  return async (event: Event['event'], context: Event['context']) => {
    const lifecycle = createLifecycle();

    const evObj = { event, context } as Event;

    let response;

    const handleServiceError = async (err: ServiceError) => {
      const handlerLifecycle = createHandlerLifecycle();

      const result = await failure(
        {
          event,
          context,
          error: err,
          service: lifecycle.partial(),
        },
        options,
        handlerLifecycle,
        lifecycle
      );

      return transformError(result, evObj, options);
    };

    const handleHandler = async (data: Request<Event, Service>) => {
      const handlerLifecycle = createHandlerLifecycle();

      const result = await success(data, options, handlerLifecycle, lifecycle);

      return transform(result, data, options);
    };

    const isHandleFailureError = (err: unknown): err is Failure<MiddlewareFail<ServiceError>> => {
      if (!(err instanceof FailureException)) {
        return false;
      }

      const error = (err as Failure<ServiceError>).err();

      return err !== null && typeof err === 'object' && 'gen' in error;
    };

    const handleFailureError = async (err: Failure<MiddlewareFail<ServiceError>>) => {
      const error = err.err();

      lifecycle.threw(error.gen);

      const handlerLifecycle = createHandlerLifecycle();

      const result = await failure(
        {
          event,
          context,
          error: error.inner.err(),
          service: lifecycle.partial(),
        },
        options,
        handlerLifecycle,
        lifecycle
      );

      return transformError(result, evObj, options);
    };

    const handleFatalError = async (err: unknown) => {
      const handlerLifecycle = createHandlerLifecycle();

      let result;

      try {
        result = await exception(
          {
            event,
            context,
            exception: err,
          },
          options,
          handlerLifecycle,
          lifecycle
        );
      } catch (fatal) {
        result = convertToFailure('UncaughtError', fatal);
      }

      try {
        response = await transformException(
          (result as unknown) as Failure<ExceptionError>,
          evObj,
          options
        );
      } catch (fatal) {
        result = convertToFailure('UncaughtTransformError', fatal);
        response = (await getFallBackTransform()(result)) as Promise<ResFatal>;
      }

      return response;
    };

    const handleFatalLifecycleError = async (err: unknown) => {
      if (isHandleFailureError(err)) {
        try {
          return await handleFailureError(err);
        } catch (fatal: unknown) {
          err = fatal;
        }
      }

      return handleFatalError(err);
    };

    const handleCreationError = async (err: unknown) => {
      if (isHandleFailureError(err)) {
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
        await lifecycle.finish();
      } catch (fatal: unknown) {
        response = await handleFatalLifecycleError(fatal);
      }
    };

    if (!middleware) {
      response = await handleCreationError(middlewareError);
    } else {
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
          response = await handleServiceError(service.err());
        } else {
          response = await handleHandler(service.ok());
        }

        await tryDestroyAndNeverThrow();
      } catch (err: unknown) {
        // check if error is failed Jest assertion and throw it immediately
        if (
          err instanceof Error &&
          typeof ((err as unknown) as { matcherResult: unknown }).matcherResult !== 'undefined'
        ) {
          throw err;
        }

        if (isHandleFailureError(err)) {
          try {
            response = await handleFailureError(err);
          } catch (fatal) {
            response = await handleFatalError(fatal);
          }
        } else {
          response = await handleFatalError(err);
        }

        await tryDestroyAndNeverThrow();
      }
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  };
};
