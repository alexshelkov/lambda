import { Err, fail } from 'lambda-res';

import {
  ServiceOptions,
  ServiceContainer,
  MiddlewareCreator,
  Handler,
  HandlerError,
  HandlerException,
  Transform,
  TransformError,
  AwsHandler,
  AwsEvent,
  Success1,
  Error1,
  Exception1,
  Transform1,
  TransformError1,
  GetReqRes,
} from './types';

import { join, joinFailure, joinFatal, connect } from './utils';

import { lambda, convertToFailure } from './lambda';

import { json } from './transform';

type IsBothNever<Data, Error> = [Data] extends [never]
  ? [Error] extends [never]
    ? true
    : false
  : false;

export type Package<
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError,
  Data = never,
  Error = never,
  FailureData = never,
  FailureError = never,
  HandledError = never,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent
> = {
  srv: MiddlewareCreator<Options, Service, ServiceError, ServiceDeps, Event>;
} & (IsBothNever<Data, Error> extends true
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : { ok: Handler<Service & ServiceDeps, Data, Error, Event, Options> }) &
  (IsBothNever<FailureData, FailureError> extends true
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {}
    : {
        fail: HandlerError<
          Service & ServiceDeps,
          ServiceError,
          FailureData,
          FailureError,
          HandledError,
          Event,
          Options
        >;
      });

export interface Creator<
  Event extends AwsEvent,
  ResOk1,
  ResOkRes1,
  ResErr1,
  ResErrRes1,
  ResFatal1,
  ResFatalRes1,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1,
  Data1,
  Error1,
  FailureData1,
  FailureError1,
  ExceptionData1,
  ExceptionError1,
  ServiceDeps extends ServiceContainer = ServiceContainer
> {
  srv: <Options2 extends ServiceOptions, Service2 extends ServiceContainer, ServiceError2>(
    creator: MiddlewareCreator<
      Options1 & Options2,
      Partial<Service1> & Service2,
      ServiceError2,
      ServiceDeps,
      Event
    >
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
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

  opt: <Options2 extends ServiceContainer>(
    options: Partial<Options1> & Options2
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
    Options1 & Options2,
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
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
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
    handler: Handler<Service1, Data2, Error2, Event, Options1>
  ) => Creator<
    Event,
    ResOk1,
    undefined,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
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

  fail: <FailureData2, FailureError2, HandledError2 = never>(
    handlerError: HandlerError<
      Service1,
      ServiceError1,
      FailureData2,
      FailureError2,
      HandledError2,
      Event,
      Options1
    >
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    undefined,
    ResFatal1,
    ResFatalRes1,
    Options1,
    Service1,
    Exclude<ServiceError1, HandledError2>,
    Data1,
    Error1,
    FailureData1 | FailureData2,
    FailureError1 | FailureError2,
    ExceptionData1,
    ExceptionError1,
    ServiceDeps
  >;

  fatal: <ExceptionData2, ExceptionError2>(
    handlerFatal: HandlerException<ExceptionData2, ExceptionError2, Event, Options1>
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    undefined,
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

  pack: <
    Options2 extends ServiceOptions,
    Service2 extends ServiceContainer,
    ServiceError2,
    Data2 = never,
    Error2 = never,
    FailureData2 = never,
    FailureError2 = never,
    HandledError2 = never
  >(
    pack: Package<
      Options1 & Options2,
      Partial<Service1> & Service2,
      ServiceError2,
      Data2,
      Error2,
      FailureData2,
      FailureError2,
      HandledError2,
      ServiceDeps,
      Event
    >
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
    Options1 & Options2,
    Service1 & Service2,
    Exclude<ServiceError1 | ServiceError2, HandledError2>,
    Data1 | Data2,
    Error1 | Error2,
    FailureData1 | FailureData2,
    FailureError1 | FailureError2,
    ExceptionData1,
    ExceptionError1,
    Service2 & ServiceDeps
  >;

  on: <ResOk2, ResErr2, ResFatal2>(
    transform: Transform<ResOk2, unknown, unknown, Event, Options1, Service1> &
      TransformError<ResErr2, unknown, unknown, Event, Options1> &
      TransformError<ResFatal2, unknown, unknown, Event, Options1>
  ) => Creator<
    Event,
    ResOk2,
    undefined,
    ResErr2,
    undefined,
    ResFatal2,
    undefined,
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

  onOk: <ResOk2>(
    transform: Transform<ResOk2, unknown, unknown, Event, Options1, Service1>
  ) => Creator<
    Event,
    ResOk2,
    undefined,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
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

  onOkRes: <ResOkRes2>(
    transform: Transform<ResOkRes2, Data1, Error1, Event, Options1, Service1>
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes2,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes1,
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
    transformError: TransformError<ResErr2, unknown, unknown, Event, Options1>
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr2,
    undefined,
    ResFatal1,
    ResFatalRes1,
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

  onFailRes: <ResErrRes2>(
    transformError: TransformError<ResErrRes2, FailureData1, FailureError1, Event, Options1>
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes2,
    ResFatal1,
    ResFatalRes1,
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
    transformFatal: TransformError<ResFatal2, unknown, unknown, Event, Options1>
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal2,
    undefined,
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

  onFatalRes: <ResFatalRes2>(
    transformFatal: TransformError<ResFatalRes2, ExceptionData1, ExceptionError1, Event, Options1>
  ) => Creator<
    Event,
    ResOk1,
    ResOkRes1,
    ResErr1,
    ResErrRes1,
    ResFatal1,
    ResFatalRes2,
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

  cr: () => MiddlewareCreator<Options1, Service1, ServiceError1, ServiceDeps, Event>;

  options: () => Options1;

  req: () => AwsHandler<
    Event,
    | GetReqRes<ResOk1, ResOkRes1>
    | GetReqRes<ResErr1, ResErrRes1>
    | GetReqRes<ResFatal1, ResFatalRes1>
  >;
}

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
  ExceptionError1,
  ResOkRes1 = undefined,
  ResErrRes1 = undefined,
  ResFatalRes1 = undefined
>(
  crtGen: number,
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1, ServiceContainer, Event>,
  options1: Options1,
  success1: Handler<Service1, Data1, Error1, Event, Options1>,
  error1: HandlerError<
    Service1,
    ServiceError1,
    FailureData1,
    FailureError1,
    never,
    Event,
    Options1
  >,
  exception1: HandlerException<ExceptionData1, ExceptionError1, Event, Options1>,
  transform1: Transform<ResOk1, unknown, unknown, Event, Options1, Service1>,
  transformRes1: Transform<ResOkRes1, Data1, Error1, Event, Options1, Service1> | undefined,
  transformError1: TransformError<ResErr1, unknown, unknown, Event, Options1>,
  transformErrorRes1:
    | TransformError<ResErrRes1, FailureData1, FailureError1, Event, Options1>
    | undefined,
  transformException1: TransformError<ResFatal1, unknown, unknown, Event, Options1>,
  transformExceptionRes1:
    | TransformError<ResFatalRes1, ExceptionData1, ExceptionError1, Event, Options1>
    | undefined
): Creator<
  Event,
  ResOk1,
  ResOkRes1,
  ResErr1,
  ResErrRes1,
  ResFatal1,
  ResFatalRes1,
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
      creator2: MiddlewareCreator<
        Options1 & Options2,
        Partial<Service1> & Service2,
        ServiceError2,
        Service1,
        Event
      >
    ) => {
      const creator12 = connect(crtGen + 1)(creator1)(creator2);

      return creatorHelper(
        crtGen + 1,
        creator12,
        options1 as Options1 & Options2,
        success1,
        error1 as HandlerError<
          Service1,
          ServiceError1 | ServiceError2,
          FailureData1,
          FailureError1,
          never,
          Event,
          Options1
        >,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformExceptionRes1
      );
    },

    opt: <Options2 extends ServiceContainer>(options2: Partial<Options1> & Options2) => {
      return creatorHelper(
        crtGen,
        creator1 as MiddlewareCreator<
          Options1 & Options2,
          Service1,
          ServiceError1,
          ServiceContainer,
          Event
        >,
        { ...options1, ...options2 },
        success1,
        error1,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformExceptionRes1
      );
    },

    ctx: <Event2 extends AwsEvent = AwsEvent>() => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformExceptionRes1
      ) as unknown as Creator<
        Event2,
        ResOk1,
        ResOkRes1,
        ResErr1,
        ResErrRes1,
        ResFatal1,
        ResFatalRes1,
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

    ok: <Data2, Error2>(success2: Handler<Service1, Data2, Error2, Event, Options1>) => {
      const success12 = join(success1, success2);

      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success12,
        error1,
        exception1,
        transform1,
        undefined,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformExceptionRes1
      );
    },

    fail: <FailureData2, FailureError2, HandledError2 = never>(
      error2: HandlerError<
        Service1,
        ServiceError1,
        FailureData2,
        FailureError2,
        HandledError2,
        Event,
        Options1
      >
    ) => {
      const error12 = joinFailure(crtGen)(error1, error2);

      return creatorHelper(
        crtGen,
        creator1 as MiddlewareCreator<
          Options1,
          Service1,
          Exclude<ServiceError1, HandledError2>,
          ServiceContainer,
          Event
        >,
        options1,
        success1,
        error12,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        undefined,
        transformException1,
        transformExceptionRes1
      );
    },

    fatal: <ExceptionData2, ExceptionError2>(
      exception2: HandlerException<ExceptionData2, ExceptionError2, Event, Options1>
    ) => {
      const exception12 = joinFatal(exception1, exception2);

      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception12,
        transform1,
        transformRes1,
        transformError1,
        transformErrorRes1,
        transformException1,
        undefined
      );
    },

    pack: <
      Options2 extends ServiceOptions,
      Service2 extends ServiceContainer,
      ServiceError2,
      Data2,
      Error2,
      FailureData2,
      FailureError2,
      HandledError2 = never
    >(
      thepackage: Package<
        Options1 & Options2,
        Partial<Service1> & Service2,
        ServiceError2,
        Data2,
        Error2,
        FailureData2,
        FailureError2,
        HandledError2,
        Service1,
        Event
      >
    ) => {
      const creator12 = connect(crtGen + 1)(creator1)(thepackage.srv) as MiddlewareCreator<
        Options1 & Options2,
        Service1 & Service2,
        Exclude<ServiceError1 | ServiceError2, HandledError2>,
        ServiceContainer,
        Event
      >;

      let success12;

      if ((thepackage as { ok?: unknown }).ok) {
        success12 = join(
          success1,
          (
            thepackage as unknown as {
              ok: Handler<Service1 & Service2, Data2, Error2, Event, Options1 & Options2>;
            }
          ).ok
        );
      } else {
        success12 = success1;
      }

      let error12;

      if ((thepackage as { fail?: unknown }).fail) {
        error12 = joinFailure(crtGen + 1)(
          error1,
          (
            thepackage as unknown as {
              fail: HandlerError<
                Service1 & Service2,
                ServiceError1 | ServiceError2,
                FailureData2,
                FailureError2,
                HandledError2,
                Event,
                Options1 & Options2
              >;
            }
          ).fail
        );
      } else {
        error12 = error1 as HandlerError<
          Service1 & Service2,
          ServiceError1 | ServiceError2,
          FailureData1,
          FailureError1,
          never,
          Event,
          Options1 & Options2
        >;
      }

      return creatorHelper(
        crtGen + 1,
        creator12,
        options1 as Options1 & Options2,
        success12,
        error12,
        exception1,
        transform1,
        transformRes1 as Transform<
          ResOkRes1,
          Data1 | Data2,
          Error1 | Error2,
          Event,
          Options1 & Options2,
          Service1 & Service2
        >,
        transformError1,
        transformErrorRes1 as TransformError<
          ResErrRes1,
          FailureData1 | FailureData2,
          FailureError1 | FailureError2,
          Event,
          Options1 & Options2
        >,
        transformException1,
        transformExceptionRes1
      );
    },

    on: <ResOk2, ResErr2, ResFatal2>(
      transform2:
        | Transform<ResOk2, unknown, unknown, Event, Options1, Service1>
        | TransformError<ResErr2, unknown, unknown, Event, Options1>
        | TransformError<ResFatal2, unknown, unknown, Event, Options1>
    ) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform2 as Transform<ResOk2, unknown, unknown, Event, Options1, Service1>,
        undefined,
        transform2 as TransformError<ResErr2, unknown, unknown, Event, Options1>,
        undefined,
        transform2 as TransformError<ResFatal2, unknown, unknown, Event, Options1>,
        undefined
      );
    },

    onOk: <ResOk2>(transform2: Transform<ResOk2, unknown, unknown, Event, Options1, Service1>) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform2,
        undefined,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformExceptionRes1
      );
    },

    onOkRes: <ResOkRes2>(
      transform2: Transform<ResOkRes2, Data1, Error1, Event, Options1, Service1>
    ) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transform2,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformExceptionRes1
      );
    },

    onFail: <ResErr2>(
      transformError2: TransformError<ResErr2, unknown, unknown, Event, Options1>
    ) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformRes1,
        transformError2,
        undefined,
        transformException1,
        transformExceptionRes1
      );
    },

    onFailRes: <ResErrRes2>(
      transformError2: TransformError<ResErrRes2, FailureData1, FailureError1, Event, Options1>
    ) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        transformError2,
        transformException1,
        transformExceptionRes1
      );
    },

    onFatal: <ResFatal2>(
      transformFatal2: TransformError<ResFatal2, unknown, unknown, Event, Options1>
    ) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        transformErrorRes1,
        transformFatal2,
        undefined
      );
    },

    onFatalRes: <ResFatal2>(
      transformFatal2: TransformError<ResFatal2, ExceptionData1, ExceptionError1, Event, Options1>
    ) => {
      return creatorHelper(
        crtGen,
        creator1,
        options1,
        success1,
        error1,
        exception1,
        transform1,
        transformRes1,
        transformError1,
        transformErrorRes1,
        transformException1,
        transformFatal2
      );
    },

    cr: () => {
      return creator1;
    },

    options: () => {
      return options1;
    },

    req: () => {
      const transform = transformRes1 || transform1;
      const transformError = transformErrorRes1 || transformError1;
      const transformException = transformExceptionRes1 || transformException1;

      return lambda(
        options1,
        creator1,
        exception1,
        error1,
        success1,
        transform as Transform<
          GetReqRes<ResOk1, ResOkRes1>,
          Data1,
          Error1,
          Event,
          Options1,
          Service1
        >,
        transformError as TransformError<
          GetReqRes<ResErr1, ResErrRes1>,
          FailureData1,
          FailureError1,
          Event,
          Options1
        >,
        transformException as TransformError<
          GetReqRes<ResFatal1, ResFatalRes1>,
          ExceptionData1,
          ExceptionError1,
          Event,
          Options1
        >
      );
    },
  };
};

export const success1: Success1 = () => {
  return Promise.resolve(fail('NotImplemented', { order: -1 }));
};

export const error1: Error1 = ({ error }) => {
  if (typeof error === 'object' && error !== null) {
    const type =
      typeof (error as { type: unknown }).type === 'string'
        ? (error as { type: string }).type
        : 'Unknown';

    return Promise.resolve(fail(type, { order: -1, ...error }));
  }

  return Promise.resolve(fail(typeof error === 'string' ? error : 'Unknown', { order: -1 }));
};

export const exception1: Exception1 = ({ exception }) => {
  return Promise.resolve(convertToFailure('UncaughtError', exception));
};

const transform1: Transform1 = json;
const transformError1: TransformError1 = json;
const transformException1: TransformError1 = json;

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
    0,
    creator1,
    options1,
    success1,
    error1,
    exception1,
    transform1,
    undefined,
    transformError1,
    undefined,
    transformException1,
    undefined
  );

  return creatorType;
};
