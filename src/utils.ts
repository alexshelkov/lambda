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
  AwsResult,
  AwsHandler,
  AwsEvent,
  AwsContext,
} from './types';

// eslint-disable-next-line @typescript-eslint/require-await
export const json = async (result: Result<unknown, unknown>): Promise<AwsResult> => {
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

export const connect = <Options1 extends ServiceOptions, Service1 extends ServiceContainer, Error1>(
  c1: MiddlewareCreator<Options1, Service1, Error1>
) => <Options2 extends ServiceOptions, Service2 extends ServiceContainer, Error2>(
  c2: MiddlewareCreator<Options2, Service2, Error2, Service1>
): MiddlewareCreator<Options1 & Options2, Service1 & Service2, Error1 | Error2> => (options) => {
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

export const join = <
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: Handler<Service1, Data1, Error1>,
  c2: Handler<Service2, Data2, Error2>
): Handler<Service1 & Service2, Data1 | Data2, Error1 | Error2> => async (
  request: Request<Service1 & Service2>
) => {
  const r1 = await c1(request);
  const r2 = await c2(request);

  return compare(r1, r2);
};

export const joinFailure = <
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
  c1: HandlerError<ServiceError1, Data1, Error1>,
  c2: HandlerError<ServiceError2, Data2, Error2>
): HandlerError<ServiceError1 | ServiceError2, Data1 | Data2, Error1 | Error2> => async (
  request: RequestError<ServiceError1 | ServiceError2>
) => {
  const r1 = await c1(request as RequestError<ServiceError1>);
  const r2 = await c2(request as RequestError<ServiceError2>);

  return compare(r1, r2);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const joinUnexpected = <Data1, Error1, Message1, Data2, Error2, Message2>(
  c1: HandlerException<Data1, Error1>,
  c2: HandlerException<Data2, Error2>
): HandlerException<Data1 | Data2, Error1 | Error2> => async (request: RequestException) => {
  const r1 = await c1(request);
  const r2 = await c2(request);

  return compare(r1, r2);
};

export const addService = <Service extends ServiceContainer, ServiceAdded extends ServiceContainer>(
  request: Request<Service>,
  addedService: ServiceAdded
): Success<Request<Service & ServiceAdded>> =>
  ok({
    ...request,
    service: {
      ...request.service,
      ...addedService,
    },
  });

export const lambda = <
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
  middleware: Middleware<Service, ServiceError>,
  exception: HandlerException<ExceptionData, ExceptionError>,
  failure: HandlerError<ServiceError, FailureData, FailureError>,
  success: Handler<Service, Data, Error>,
  transform: Transform,
  transformError: Transform
): AwsHandler => async (event: AwsEvent, context: AwsContext) => {
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

      response = transformError(response);
    } else {
      try {
        response = await success(request.data);
        response = transform(response);
      } catch (err) {
        if (err instanceof FailureException) {
          response = await failure({
            event,
            context,
            error: err.error as ServiceError,
          });

          response = transformError(response);
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    response = await exception({
      event,
      context,
      exception: err as unknown,
    });

    response = transformError(response);
  }

  return response;
};
