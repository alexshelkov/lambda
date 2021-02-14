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
} from './types';

import { join, joinFailure, joinUnexpected, connect, json, lambda } from './utils';

const idHandler = <Service extends ServiceContainer, Data, Error>(
  data: Data
): Handler<
  Service,
  Data,
  Error
  // eslint-disable-next-line @typescript-eslint/require-await
> => async () => ok(data, { order: -2 });

const idHandlerFailure = <ServiceError, Data, Error>(
  data: Data
): HandlerError<
  ServiceError,
  Data,
  Error
  // eslint-disable-next-line @typescript-eslint/require-await
> => async () => ok(data, { order: -2 });

export interface Creator<
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
      ServiceDepsAdded
    >
  ) => Creator<
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
    success: Handler<ServiceAdded, Data, Error>
  ) => Creator<
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
    error: HandlerError<ServiceErrorAdded, FailureData, FailureError>
  ) => Creator<
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

  unexpected: <ExceptionData, ExceptionError>(
    exception: HandlerException<ExceptionData, ExceptionError>
  ) => Creator<
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

  onOk: (
    transform: Transform
  ) => Creator<
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

  onFail: (
    transformError: Transform
  ) => Creator<
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

  md: () => Middleware<ServiceAdded, ServiceErrorAdded>;

  cr: () => MiddlewareCreator<OptionsAdded, ServiceAdded, ServiceErrorAdded>;

  options: () => OptionsAdded;

  handle: () => Handler<ServiceAdded, DataAdded, ErrorAdded>;

  errorHandle: () => HandlerError<ServiceErrorAdded, FailureDataAdded, FailureErrorAdded>;

  exception: () => HandlerException<ExceptionDataAdded, ExceptionErrorAdded>;

  req: () => AwsHandler;
}

export type GetService<Crt> = Crt extends Creator<
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
  any
>
  ? Service
  : never;

export type PickService<Crt, Srv extends keyof GetService<Crt>> = Pick<GetService<Crt>, Srv>;

export type GetError<Crt> = Crt extends Creator<
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
  any
>
  ? Error
  : never;

export const creatorHelper = <
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
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1>,
  options1: Options1,
  success1: Handler<Service1, DataAdded1, ErrorAdded1>,
  error1: HandlerError<ServiceError1, FailureDataAdded1, FailureErrorAdded1>,
  exception1: HandlerException<ExceptionDataAdded1, ExceptionErrorAdded1>,
  transform1: Transform,
  transformError1: Transform
): Creator<
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
> => ({
  srv: <Options2 extends ServiceOptions, Service2 extends ServiceContainer, ServiceError2>(
    creator2: MiddlewareCreator<Options2 & Options1, Service2, ServiceError2, Service1>
  ) => {
    const creator12 = connect(creator1)(creator2);

    const options2: Options2 = {} as Options2;

    const success12 = join(
      success1,
      idHandler<Service2, DataAdded1, ErrorAdded1>((undefined as unknown) as DataAdded1)
    );

    const error12 = joinFailure(
      error1,
      idHandlerFailure<ServiceError2, FailureDataAdded1, FailureErrorAdded1>(
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

  opt: (options2: Partial<Options1>) =>
    creatorHelper(
      creator1,
      { ...options1, ...options2 },
      success1,
      error1,
      exception1,
      transform1,
      transformError1
    ),

  ok: <DataAdded2, ErrorAdded2>(success2: Handler<Service1, DataAdded2, ErrorAdded2>) => {
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
    error2: HandlerError<ServiceError1, FailureData, FailureError>
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

  unexpected: <ExceptionData, ExceptionError>(
    exception2: HandlerException<ExceptionData, ExceptionError>
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

  onOk: (transform2: Transform = json) =>
    creatorHelper(creator1, options1, success1, error1, exception1, transform2, transformError1),

  onFail: (transformError2: Transform = json) =>
    creatorHelper(creator1, options1, success1, error1, exception1, transform1, transformError2),

  cr: () => creator1,

  options: () => options1,

  md: () => {
    const middleware = creator1(options1);

    return middleware;
  },

  handle: () => success1,

  errorHandle: () => error1,

  exception: () => exception1,

  req: () => {
    const middleware = creator1(options1);

    return lambda(middleware, exception1, error1, success1, transform1, transformError1);
  },
});

export const creator = <
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1 extends Err
>(
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1>
): typeof creatorType => {
  const options1: Options1 = {} as Options1;

  // eslint-disable-next-line @typescript-eslint/require-await
  const success1: Handler<Service1, never, Err> = async () =>
    fail('Not implemented', { order: -1 });

  // eslint-disable-next-line @typescript-eslint/require-await
  const error1: HandlerError<ServiceError1, never, Err> = async (request) =>
    fail(request.error.type, { order: -1 });

  // eslint-disable-next-line @typescript-eslint/require-await
  const exception1: HandlerException<never, Err> = async ({ exception }) => {
    const name = exception instanceof Error ? exception.name : 'unknown';
    const message = exception instanceof Error ? exception.message : undefined;

    const error = fail<Err>(`Uncaught exception: ${name}`, { order: -1, message });

    error.stack = exception instanceof Error ? exception.stack : error.stack;

    return error;
  };

  const transform1: Transform = json;
  const transformError1: Transform = json;

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
