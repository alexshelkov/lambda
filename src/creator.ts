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

import { join, joinFailure, joinFatal, connect, json, lambda } from './utils';

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
  ResOk1,
  ResErr1,
  ResFatal1,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1,
  Data1,
  Error1,
  FailureData1,
  FailureError1,
  ExceptionData1,
  ExceptionError1,
  ServiceDeps extends ServiceOptions = ServiceContainer
> {
  srv: <Options2 extends ServiceOptions, Service2 extends ServiceContainer, ServiceError2>(
    middlewareCreator: MiddlewareCreator<
      Options1 & Options2,
      Service2,
      ServiceError2,
      ServiceDeps,
      Event
    >
  ) => Creator<
    Event,
    ResOk1,
    ResErr1,
    ResFatal1,
    Options1 & Options2,
    Service1 & Service2,
    ServiceError2 | ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    Service2 & ServiceDeps
  >;

  opt: (
    options: Partial<Options1>
  ) => Creator<
    Event,
    ResOk1,
    ResErr1,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  ctx: <Event2 extends AwsEvent>() => Creator<
    Event2,
    ResOk1,
    ResErr1,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  ok: <Data2, Error2>(
    success: Handler<Service1, Data2, Error2, Event>
  ) => Creator<
    Event,
    ResOk1,
    ResErr1,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1 | Data2,
    Error1 | Error2,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  fail: <FailureData2, FailureError2>(
    error: HandlerError<ServiceError1, FailureData2, FailureError2, Event>
  ) => Creator<
    Event,
    ResOk1,
    ResErr1,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1 | FailureData2,
    FailureError1 | FailureError2,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  fatal: <ExceptionData2, ExceptionError2>(
    exception: HandlerException<ExceptionData2, ExceptionError2, Event>
  ) => Creator<
    Event,
    ResOk1,
    ResErr1,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1 | ExceptionData2,
    ExceptionError1 | ExceptionError2,
    ServiceDeps
  >;

  onOk: <ResOk2>(
    transform: Transform<Event, ResOk2>
  ) => Creator<
    Event,
    ResOk2,
    ResErr1,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  onFail: <ResErr2>(
    transformError: Transform<Event, ResErr2>
  ) => Creator<
    Event,
    ResOk1,
    ResErr2,
    ResFatal1,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  onFatal: <ResFatal2>(
    transformFatal: Transform<Event, ResFatal2>
  ) => Creator<
    Event,
    ResOk1,
    ResErr1,
    ResFatal2,
    Options1,
    Service1,
    ServiceError1,
    Data1,
    Error1,
    FailureData1,
    FailureError1,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  md: () => Middleware<Service1, ServiceError1, ServiceDeps, Event>;

  cr: () => MiddlewareCreator<Options1, Service1, ServiceError1, ServiceDeps, Event>;

  options: () => Options1;

  req: () => AwsHandler<Event, ResOk1 | ResErr1 | ResFatal1>;
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
  ResOk1,
  ResErr1,
  ResFatal1,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1,
  Data1,
  Error1,
  FailureData1,
  FailureError1,
  ExceptionData1,
  ExceptionError1
>(
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1, ServiceContainer, Event>,
  options1: Options1,
  success1: Handler<Service1, Data1, Error1, Event>,
  error1: HandlerError<ServiceError1, FailureData1, FailureError1, Event>,
  exception1: HandlerException<ExceptionData1, ExceptionError1, Event>,
  transform1: Transform<Event, ResOk1>,
  transformError1: Transform<Event, ResErr1>,
  transformException1: Transform<Event, ResFatal1>
): Creator<
  Event,
  ResOk1,
  ResErr1,
  ResFatal1,
  Options1,
  Service1,
  ServiceError1,
  Data1,
  Error1,
  FailureData1,
  FailureError1,
  ExceptionData1,
  ExceptionError1,
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
        idHandler<Event, Service2, Data1, Error1>((undefined as unknown) as Data1)
      );

      const error12 = joinFailure(
        error1,
        idHandlerFailure<Event, ServiceError2, FailureData1, FailureError1>(
          (undefined as unknown) as FailureData1
        )
      );

      return creatorHelper(
        creator12,
        { ...options1, ...options2 },
        success12,
        error12,
        exception1,
        transform1,
        transformError1,
        transformException1
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
        transformError1,
        transformException1
      );
    },

    ctx: <Event2 extends AwsEvent = AwsEvent>() => {
      return (creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformError1,
        transformException1
      ) as unknown) as Creator<
        Event2,
        ResOk1,
        ResErr1,
        ResFatal1,
        Options1,
        Service1,
        ServiceError1,
        Data1,
        Error1,
        FailureData1,
        FailureError1,
        ExceptionData1,
        ExceptionError1,
        Service1
      >;
    },

    ok: <Data2, Error2>(success2: Handler<Service1, Data2, Error2, Event>) => {
      const success12 = join(success1, success2);

      return creatorHelper(
        creator1,
        options1,
        success12,
        error1,
        exception1,
        transform1,
        transformError1,
        transformException1
      );
    },

    fail: <FailureData2, FailureError2>(
      error2: HandlerError<ServiceError1, FailureData2, FailureError2, Event>
    ) => {
      const error12 = joinFailure(error1, error2);

      return creatorHelper(
        creator1,
        options1,
        success1,
        error12,
        exception1,
        transform1,
        transformError1,
        transformException1
      );
    },

    fatal: <ExceptionData2, ExceptionError2>(
      exception2: HandlerException<ExceptionData2, ExceptionError2, Event>
    ) => {
      const exception12 = joinFatal(exception1, exception2);

      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception12,
        transform1,
        transformError1,
        transformException1
      );
    },

    onOk: <ResOk2>(transform2: Transform<Event, ResOk2>) => {
      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform2,
        transformError1,
        transformException1
      );
    },

    onFail: <ResErr2>(transformError2: Transform<Event, ResErr2>) => {
      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformError2,
        transformException1
      );
    },

    onFatal: <ResFatal2>(transformFatal2: Transform<Event, ResFatal2>) => {
      return creatorHelper(
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformError1,
        transformFatal2
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

    req: () => {
      const middleware = creator1(options1);

      return lambda(
        middleware,
        exception1,
        error1,
        success1,
        transform1,
        transformError1,
        transformException1
      );
    },
  };
};

export const success1: Handler<ServiceContainer, never, Err> = () => {
  return Promise.resolve(fail('Not implemented', { order: -1 }));
};

export const error1: HandlerError<unknown, never, Err> = (request) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { error } = request;

  if (typeof error === 'object' && error !== null) {
    const type =
      typeof (error as { type: unknown }).type === 'string'
        ? (error as { type: string }).type
        : 'Unknown';

    return Promise.resolve(fail(type, { order: -1, ...error }));
  }

  return Promise.resolve(fail(typeof error === 'string' ? error : 'Unknown', { order: -1 }));
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
const transformException1: Transform<AwsEvent, APIGatewayProxyResult> = json;

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
    transformError1,
    transformException1
  );

  return creatorType;
};
