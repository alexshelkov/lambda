import { APIGatewayProxyResult } from 'aws-lambda';
import { compare, Err, fail, FailureException, ok, Result, Success } from '@alexshelkov/result';

import {
  Handler,
  HandlerError,
  HandlerException,
  MiddlewareEvents,
  MiddlewareLifecycle,
  MiddlewareCreator,
  Request,
  RequestError,
  RequestException,
  ServiceContainer,
  ServiceOptions,
  Transform,
  TransformError,
  AwsHandler,
  AwsEvent,
} from './types';

// eslint-disable-next-line @typescript-eslint/require-await
export const json = async (result: Result<unknown, unknown>): Promise<APIGatewayProxyResult> => {
  let code: number;

  if (result.code) {
    code = result.code;
  } else {
    code = result.isOk() ? 200 : 400;
  }

  if (result.isOk() && result.ok() === undefined) {
    delete result.data;
  } else if (result.isErr() && result.err() === undefined) {
    delete result.error;
  }

  delete result.order;
  delete result.code;

  let body: string;

  if (result.isOk()) {
    body = result.data !== undefined ? JSON.stringify(result) : '';
  } else {
    body =
      result.error !== undefined
        ? JSON.stringify({
            ...result,
            message: undefined,
            name: undefined,
            stack: undefined,
          })
        : '';
  }

  return {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    statusCode: code,
    body,
  };
};

export const connectLifecycles = (
  lifecycle: MiddlewareLifecycle
): [MiddlewareLifecycle, MiddlewareLifecycle] => {
  const e1: MiddlewareEvents = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async destroy() {},
  };

  const e2: MiddlewareEvents = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async destroy() {},
  };

  lifecycle.destroy(async () => {
    await e1.destroy();
    await e2.destroy();
  });

  const l1: MiddlewareLifecycle = {
    destroy(cb) {
      e1.destroy = cb;
    },
  };

  const l2: MiddlewareLifecycle = {
    destroy(cb) {
      e2.destroy = cb;
    },
  };

  return [l1, l2];
};

export const connect = <
  Event extends AwsEvent,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  Error1
>(
  c1: MiddlewareCreator<Options1, Service1, Error1, ServiceContainer, Event>
) => {
  return <Options2 extends ServiceOptions, Service2 extends ServiceContainer, Error2>(
    c2: MiddlewareCreator<Options2, Service2, Error2, Service1, Event>
  ): MiddlewareCreator<
    Options1 & Options2,
    Service1 & Service2,
    Error1 | Error2,
    ServiceContainer,
    Event
  > => {
    return (options, lifecycle) => {
      const [l1, l2] = connectLifecycles(lifecycle);

      const m1 = c1(options, l1);
      const m2 = c2(options, l2);

      return async (request) => {
        const r1 = await m1(request);

        if (r1.isOk()) {
          return m2<typeof r1.data.service>(r1.data);
        }

        return r1;
      };
    };
  };
};

export const join = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: Handler<Service1, Data1, Error1, Event, Options>,
  c2: Handler<Service2, Data2, Error2, Event, Options>
): Handler<Service1 & Service2, Data1 | Data2, Error1 | Error2, Event, Options> => {
  return async (request: Request<Event, Service1 & Service2>, options: Partial<Options>) => {
    const r2 = await c2(request, options);
    const r1 = await c1(request, options);

    return compare(r1, r2);
  };
};

export const joinFailure = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  ServiceError1,
  ServiceError2,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: HandlerError<ServiceError1, Data1, Error1, Event, Options>,
  c2: HandlerError<ServiceError2, Data2, Error2, Event, Options>
): HandlerError<ServiceError1 | ServiceError2, Data1 | Data2, Error1 | Error2, Event, Options> => {
  return async (
    request: RequestError<Event, ServiceError1 | ServiceError2>,
    options: Partial<Options>
  ) => {
    const r2 = await c2(request as RequestError<Event, ServiceError2>, options);
    const r1 = await c1(request as RequestError<Event, ServiceError1>, options);

    return compare(r1, r2);
  };
};

export const joinFatal = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: HandlerException<Data1, Error1, Event, Options>,
  c2: HandlerException<Data2, Error2, Event, Options>
): HandlerException<Data1 | Data2, Error1 | Error2, Event, Options> => {
  return async (request: RequestException<Event>, options: Partial<Options>) => {
    const r2 = await c2(request, options);
    const r1 = await c1(request, options);

    return compare(r1, r2);
  };
};

export const addService = <
  Event extends AwsEvent,
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer
>(
  request: Request<Event, Service1>,
  addedService: Service2
): Success<Request<Event, Service1 & Service2>> => {
  return ok({
    ...request,
    service: {
      ...request.service,
      ...addedService,
    },
  });
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
  const events: MiddlewareEvents = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async destroy() {},
  };

  const lifecycle: MiddlewareLifecycle = {
    destroy(cb) {
      events.destroy = cb;
    },
  };

  const middleware = creator(options, lifecycle);

  return async (event: Event['event'], context: Event['context']) => {
    const evObj = { event, context } as Event;
    let executed = false;

    let response;

    const lifecycles = async () => {
      if (executed) {
        return;
      }

      executed = true;
      await events.destroy();
    };

    try {
      const service = await middleware({
        event,
        context,
        service: {} as Service,
      });

      if (service.isErr()) {
        response = await failure(
          {
            event,
            context,
            error: service.error,
          },
          options
        );

        response = await transformError(response, evObj, options);

        await lifecycles();
      } else {
        try {
          response = await success(service.data, options);
          response = await transform(response, service.data, options);

          await lifecycles();
        } catch (err) {
          if (err instanceof FailureException) {
            response = await failure(
              {
                event,
                context,
                error: err.error as ServiceError,
              },
              options
            );

            response = await transformError(response, evObj, options);

            await lifecycles();
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

      try {
        response = await exception(
          {
            event,
            context,
            exception: err,
          },
          options
        );
      } catch (fatal) {
        response = fail<Err>('FatalException', {
          message: fatal instanceof Error ? `${fatal.name}\n${fatal.message}` : undefined,
        });
      }

      response = await transformException(response, evObj, options);

      await lifecycles();
    }

    return response;
  };
};
