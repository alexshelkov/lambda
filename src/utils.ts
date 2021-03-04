import { APIGatewayProxyResult } from 'aws-lambda';
import { compare, FailureException, ok, Result, Success } from '@alexshelkov/result';

import {
  Handler,
  HandlerError,
  HandlerException,
  Middleware,
  MiddlewareCreator,
  Request,
  RequestError,
  RequestException,
  ServiceContainer,
  ServiceOptions,
  Transform,
  AwsHandler,
  AwsEvent,
} from './types';

// eslint-disable-next-line @typescript-eslint/require-await
export const json = async (result: Result<unknown, unknown>): Promise<APIGatewayProxyResult> => {
  let code: number;

  if (result.code) {
    code = result.code;
  } else {
    code = result.status === 'success' ? 200 : 400;
  }

  if (result.status === 'success' && result.data === undefined) {
    delete result.data;
  } else if (result.status === 'error' && result.error === undefined) {
    delete result.error;
  }

  delete result.order;
  delete result.code;

  let body: string;

  if (result.status === 'success') {
    body = result.data !== undefined ? JSON.stringify(result) : '';
  } else {
    body =
      result.error !== undefined
        ? JSON.stringify({ ...result, message: undefined, name: undefined, stack: undefined })
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
    return (options) => {
      const m1 = c1(options);
      const m2 = c2(options);

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
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: Handler<Service1, Data1, Error1, Event>,
  c2: Handler<Service2, Data2, Error2, Event>
): Handler<Service1 & Service2, Data1 | Data2, Error1 | Error2, Event> => {
  return async (request: Request<Event, Service1 & Service2>) => {
    const r1 = await c1(request);
    const r2 = await c2(request);

    return compare(r1, r2);
  };
};

export const joinFailure = <
  Event extends AwsEvent,
  ServiceError1,
  ServiceError2,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: HandlerError<ServiceError1, Data1, Error1, Event>,
  c2: HandlerError<ServiceError2, Data2, Error2, Event>
): HandlerError<ServiceError1 | ServiceError2, Data1 | Data2, Error1 | Error2, Event> => {
  return async (request: RequestError<Event, ServiceError1 | ServiceError2>) => {
    const r1 = await c1(request as RequestError<Event, ServiceError1>);
    const r2 = await c2(request as RequestError<Event, ServiceError2>);

    return compare(r1, r2);
  };
};

export const joinFatal = <Event extends AwsEvent, Data1, Error1, Data2, Error2>(
  c1: HandlerException<Data1, Error1, Event>,
  c2: HandlerException<Data2, Error2, Event>
): HandlerException<Data1 | Data2, Error1 | Error2, Event> => {
  return async (request: RequestException<Event>) => {
    const r1 = await c1(request);
    const r2 = await c2(request);

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
  middleware: Middleware<Service, ServiceError, ServiceContainer, Event>,
  exception: HandlerException<ExceptionData, ExceptionError, Event>,
  failure: HandlerError<ServiceError, FailureData, FailureError, Event>,
  success: Handler<Service, Data, Error, Event>,
  transform: Transform<Event, ResOk>,
  transformError: Transform<Event, ResErr>,
  transformException: Transform<Event, ResFatal>
): AwsHandler<Event, ResOk | ResErr | ResFatal> => {
  return async (event: Event['event'], context: Event['context']) => {
    const evObj = { event, context } as Event;

    let response;

    try {
      const request = await middleware({
        event,
        context,
        service: {} as Service,
      });

      if (request.status === 'error') {
        response = await failure({
          event,
          context,
          error: request.error,
        });

        response = await transformError(response, evObj);
      } else {
        try {
          response = await success(request.data);
          response = await transform(response, evObj);
        } catch (err) {
          if (err instanceof FailureException) {
            response = await failure({
              event,
              context,
              error: err.error as ServiceError,
            });

            response = await transformError(response, evObj);
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

      response = await exception({
        event,
        context,
        exception: err,
      });

      response = await transformException(response, evObj);
    }

    return response;
  };
};
