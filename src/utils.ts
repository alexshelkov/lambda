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
  c1: Handler<Event, Service1, Data1, Error1>,
  c2: Handler<Event, Service2, Data2, Error2>
): Handler<Event, Service1 & Service2, Data1 | Data2, Error1 | Error2> => {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ServiceMessage1,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ServiceMessage2,
  Data1,
  Error1,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Message1,
  Data2,
  Error2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Message2
>(
  c1: HandlerError<Event, ServiceError1, Data1, Error1>,
  c2: HandlerError<Event, ServiceError2, Data2, Error2>
): HandlerError<Event, ServiceError1 | ServiceError2, Data1 | Data2, Error1 | Error2> => {
  return async (request: RequestError<Event, ServiceError1 | ServiceError2>) => {
    const r1 = await c1(request as RequestError<Event, ServiceError1>);
    const r2 = await c2(request as RequestError<Event, ServiceError2>);

    return compare(r1, r2);
  };
};

export const joinUnexpected = <
  Event extends AwsEvent,
  Data1,
  Error1,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Message1,
  Data2,
  Error2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Message2
>(
  c1: HandlerException<Event, Data1, Error1>,
  c2: HandlerException<Event, Data2, Error2>
): HandlerException<Event, Data1 | Data2, Error1 | Error2> => {
  return async (request: RequestException<Event>) => {
    const r1 = await c1(request);
    const r2 = await c2(request);

    return compare(r1, r2);
  };
};

export const addService = <
  Event extends AwsEvent,
  Service extends ServiceContainer,
  ServiceAdded extends ServiceContainer
>(
  request: Request<Event, Service>,
  addedService: ServiceAdded
): Success<Request<Event, Service & ServiceAdded>> => {
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
  ResponseOk,
  ResponseErr,
  Service extends ServiceContainer,
  ServiceError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ServiceErrorMessage,
  Data,
  Error,
  FailureData,
  FailureError,
  ExceptionData,
  ExceptionError
>(
  middleware: Middleware<Service, ServiceError, ServiceContainer, Event>,
  exception: HandlerException<Event, ExceptionData, ExceptionError>,
  failure: HandlerError<Event, ServiceError, FailureData, FailureError>,
  success: Handler<Event, Service, Data, Error>,
  transform: Transform<Event, ResponseOk>,
  transformError: Transform<Event, ResponseErr>
): AwsHandler<Event, ResponseOk | ResponseErr> => {
  return async (event: Event['event'], context: Event['context']) => {
    const evObj = { event, context } as Event;

    const request = await middleware({
      event,
      context,
      service: {} as Service,
    });

    let response;

    try {
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

      response = await transformError(response, evObj);
    }

    return response;
  };
};
