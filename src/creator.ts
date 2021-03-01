import { APIGatewayProxyResult } from 'aws-lambda';
import { Err, fail, ok } from '@alexshelkov/result';

import {
  ServiceOptions,
  ServiceContainer,
  MiddlewareCreator,
  Middleware,
  Handler,
  HandlerError,
  HandlerException,
  Transform,
  AwsHandler,
  AwsEvent,
} from './types';

import { join, joinFailure, joinUnexpected, connect, json, lambda } from './utils';

const idHandler = <Event extends AwsEvent, Service extends ServiceContainer, Data, Error>(
  data: Data
): Handler<Service, Data, Error, Event> => {
  return () => {
    return Promise.resolve(ok(data, { order: -2 }));
  };
};

const idHandlerFailure = <Event extends AwsEvent, ServiceError, Data, Error>(
  data: Data
): HandlerError<ServiceError, Data, Error, Event> => {
  return () => {
    return Promise.resolve(ok(data, { order: -2 }));
  };
};

export interface Creator<
  Event extends AwsEvent,
  ResponseOk,
  ResponseErr,
  OptionsAdded extends ServiceOptions,
  ServiceAdded extends ServiceContainer,
  ServiceErrorAdded,
  DataAdded,
  ErrorAdded,
  FailureDataAdded,
  FailureErrorAdded,
  ExceptionDataAdded,
  ExceptionErrorAdded,
  ServiceDepsAdded extends ServiceOptions = ServiceContainer
> {
  srv: <Options extends ServiceOptions, Service extends ServiceContainer, ServiceError>(
    middlewareCreator: MiddlewareCreator<
      OptionsAdded & Options,
      Service,
      ServiceError,
      ServiceDepsAdded,
      Event
    >
  ) => Creator<
    Event,
    ResponseOk,
    ResponseErr,
    OptionsAdded & Options,
    ServiceAdded & Service,
    ServiceError | ServiceErrorAdded,
    DataAdded,
    ErrorAdded,
    FailureDataAdded,
    FailureErrorAdded,
    ExceptionDataAdded,
    ExceptionErrorAdded,
    Service & ServiceDepsAdded
  >;

  opt: (
    options: Partial<OptionsAdded>
  ) => Creator<
    Event,
    ResponseOk,
    ResponseErr,
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    DataAdded,
    ErrorAdded,
    FailureDataAdded,
    FailureErrorAdded,
    ExceptionDataAdded,
    ExceptionErrorAdded,
    ServiceDepsAdded
  >;

  ok: <Data, Error>(
    success: Handler<ServiceAdded, Data, Error, Event>
  ) => Creator<
    Event,
    ResponseOk,
    ResponseErr,
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    DataAdded | Data,
    ErrorAdded | Error,
    FailureDataAdded,
    FailureErrorAdded,
    ExceptionDataAdded,
    ExceptionErrorAdded,
    ServiceDepsAdded
  >;

  fail: <FailureData, FailureError>(
    error: HandlerError<ServiceErrorAdded, FailureData, FailureError, Event>
  ) => Creator<
    Event,
    ResponseOk,
    ResponseErr,
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    DataAdded,
    ErrorAdded,
    FailureDataAdded | FailureData,
    FailureErrorAdded | FailureError,
    ExceptionDataAdded,
    ExceptionErrorAdded,
    ServiceDepsAdded
  >;

  onUnexpected: <ExceptionData, ExceptionError>(
    exception: HandlerException<ExceptionData, ExceptionError, Event>
  ) => Creator<
    Event,
    ResponseOk,
    ResponseErr,
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    DataAdded,
    ErrorAdded,
    FailureDataAdded,
    FailureErrorAdded,
    ExceptionDataAdded | ExceptionData,
    ExceptionErrorAdded | ExceptionError,
    ServiceDepsAdded
  >;

  onOk: <OkResponse>(
    transform: Transform<Event, OkResponse>
  ) => Creator<
    Event,
    OkResponse,
    ResponseErr,
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    DataAdded,
    ErrorAdded,
    FailureDataAdded,
    FailureErrorAdded,
    ExceptionDataAdded,
    ExceptionErrorAdded,
    ServiceDepsAdded
  >;

  onFail: <ErrorResponse>(
    transformError: Transform<Event, ErrorResponse>
  ) => Creator<
    Event,
    ResponseOk,
    ErrorResponse,
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    DataAdded,
    ErrorAdded,
    FailureDataAdded,
    FailureErrorAdded,
    ExceptionDataAdded,
    ExceptionErrorAdded,
    ServiceDepsAdded
  >;

  md: () => Middleware<ServiceAdded, ServiceErrorAdded, ServiceDepsAdded, Event>;

  cr: () => MiddlewareCreator<
    OptionsAdded,
    ServiceAdded,
    ServiceErrorAdded,
    ServiceDepsAdded,
    Event
  >;

  options: () => OptionsAdded;

  handle: () => Handler<ServiceAdded, DataAdded, ErrorAdded, Event>;

  errorHandle: () => HandlerError<ServiceErrorAdded, FailureDataAdded, FailureErrorAdded, Event>;

  exception: () => HandlerException<ExceptionDataAdded, ExceptionErrorAdded, Event>;

  req: () => AwsHandler<Event, ResponseOk | ResponseErr>;
}

export type GetService<Crt> = Crt extends Creator<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  infer Service,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>
  ? Service
  : never;

export type GetEvent<Crt> = Crt extends Creator<
  infer Event,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>
  ? Event
  : never;

export type PickService<Crt, Srv extends keyof GetService<Crt>> = Pick<GetService<Crt>, Srv>;

export type GetError<Crt> = Crt extends Creator<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  infer Error,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>
  ? Error
  : never;

export const creatorHelper = <
  Event extends AwsEvent,
  ResponseOk,
  ResponseErr,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1,
  DataAdded1,
  ErrorAdded1,
  FailureDataAdded1,
  FailureErrorAdded1,
  ExceptionDataAdded1,
  ExceptionErrorAdded1
>(
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1, ServiceContainer, Event>,
  options1: Options1,
  success1: Handler<Service1, DataAdded1, ErrorAdded1, Event>,
  error1: HandlerError<ServiceError1, FailureDataAdded1, FailureErrorAdded1, Event>,
  exception1: HandlerException<ExceptionDataAdded1, ExceptionErrorAdded1, Event>,
  transform1: Transform<Event, ResponseOk>,
  transformError1: Transform<Event, ResponseErr>
): Creator<
  Event,
  ResponseOk,
  ResponseErr,
  Options1,
  Service1,
  ServiceError1,
  DataAdded1,
  ErrorAdded1,
  FailureDataAdded1,
  FailureErrorAdded1,
  ExceptionDataAdded1,
  ExceptionErrorAdded1,
  Service1
> => {
  return {
    srv: <Options2 extends ServiceOptions, Service2 extends ServiceContainer, ServiceError2>(
      creator2: MiddlewareCreator<Options2 & Options1, Service2, ServiceError2, Service1, Event>
    ) => {
      const creator12 = connect(creator1)(creator2);

      const options2: Options2 = {} as Options2;

      const success12 = join(
        success1,
        idHandler<Event, Service2, DataAdded1, ErrorAdded1>((undefined as unknown) as DataAdded1)
      );

      const error12 = joinFailure(
        error1,
        idHandlerFailure<Event, ServiceError2, FailureDataAdded1, FailureErrorAdded1>(
          (undefined as unknown) as FailureDataAdded1
        )
      );

      return creatorHelper(
        creator12,
        { ...options1, ...options2 },
        success12,
        error12,
        exception1,
        transform1,
        transformError1
      );
    },

    opt: (options2: Partial<Options1>) => {
      return creatorHelper(
        creator1,
        { ...options1, ...options2 },
        success1,
        error1,
        exception1,
        transform1,
        transformError1
      );
    },

    ok: <DataAdded2, ErrorAdded2>(success2: Handler<Service1, DataAdded2, ErrorAdded2, Event>) => {
      const success12 = join(success1, success2);

      return creatorHelper(
        creator1,
        options1,
        success12,
        error1,
        exception1,
        transform1,
        transformError1
      );
    },

    fail: <FailureData, FailureError>(
      error2: HandlerError<ServiceError1, FailureData, FailureError, Event>
    ) => {
      const error12 = joinFailure(error1, error2);

      return creatorHelper(
        creator1,
        options1,
        success1,
        error12,
        exception1,
        transform1,
        transformError1
      );
    },

    onUnexpected: <ExceptionData, ExceptionError>(
      exception2: HandlerException<ExceptionData, ExceptionError, Event>
    ) => {
      const exception12 = joinUnexpected(exception1, exception2);

      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception12,
        transform1,
        transformError1
      );
    },

    onOk: <NewResponse>(transform2: Transform<Event, NewResponse>) => {
      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform2,
        transformError1
      );
    },

    onFail: <NewResponse>(transformError2: Transform<Event, NewResponse>) => {
      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformError2
      );
    },

    cr: () => {
      return creator1;
    },

    options: () => {
      return options1;
    },

    md: () => {
      const middleware = creator1(options1);

      return middleware;
    },

    handle: () => {
      return success1;
    },

    errorHandle: () => {
      return error1;
    },

    exception: () => {
      return exception1;
    },

    req: () => {
      const middleware = creator1(options1);

      return lambda(middleware, exception1, error1, success1, transform1, transformError1);
    },
  };
};

export const success1: Handler<ServiceContainer, never, Err> = () => {
  return Promise.resolve(fail('Not implemented', { order: -1 }));
};

export const error1: HandlerError<Err, never, Err> = (request) => {
  return Promise.resolve(fail(request.error.type, { order: -1, ...request.error }));
};

export const exception1: HandlerException<never, Err> = ({ exception }) => {
  const name = exception instanceof Error ? exception.name : 'unknown';
  const message = exception instanceof Error ? exception.message : undefined;

  const error = fail<Err>(`Uncaught exception: ${name}`, { order: -1, message });

  error.stack = exception instanceof Error ? exception.stack : error.stack;

  return Promise.resolve(error);
};

const transform1: Transform<AwsEvent, APIGatewayProxyResult> = json;
const transformError1: Transform<AwsEvent, APIGatewayProxyResult> = json;

export const creator = <
  Event extends AwsEvent,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1 extends Err
>(
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1, ServiceContainer, Event>
): typeof creatorType => {
  const options1: Options1 = {} as Options1;

  const creatorType = creatorHelper(
    creator1,
    options1,
    success1,
    error1,
    exception1,
    transform1,
    transformError1
  );

  return creatorType;
};
