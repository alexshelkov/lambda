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
  MetaCreator,
  MetaSuccess,
  MetaFail,
  MetaFatal,
  Runner,
} from './core';
import { Package } from './package';
import { convertToFailure } from './utils';
import { runner } from './runner';
import { json } from './transform';

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
  srv<Options2 extends ServiceOptions, Service2 extends ServiceContainer, ServiceError2>(
    creator: MiddlewareCreator<
      Options1 & Options2,
      Partial<Service1> & Service2,
      ServiceError2,
      ServiceDeps,
      Event
    >
  ): Creator<
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

  opt<Options2 extends ServiceContainer>(
    options: Partial<Options1> & Options2
  ): Creator<
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

  ctx<Event2 extends AwsEvent>(): Creator<
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

  ok<Data2, Error2>(
    handler: Handler<Service1, Data2, Error2, Event, Options1>
  ): Creator<
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

  fail<FailureData2, FailureError2, HandledError2 = never>(
    handlerError: HandlerError<
      Service1,
      ServiceError1,
      FailureData2,
      FailureError2,
      HandledError2,
      Event,
      Options1
    >
  ): Creator<
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

  fatal<ExceptionData2, ExceptionError2>(
    handlerFatal: HandlerException<ExceptionData2, ExceptionError2, Event, Options1>
  ): Creator<
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

  pack<
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
  ): Creator<
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

  on<ResOk2, ResErr2, ResFatal2>(
    transform: Transform<ResOk2, unknown, unknown, Event, Options1, Service1> &
      TransformError<ResErr2, unknown, unknown, Event, Options1> &
      TransformError<ResFatal2, unknown, unknown, Event, Options1>
  ): Creator<
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

  onOk<ResOk2>(
    transform: Transform<ResOk2, unknown, unknown, Event, Options1, Service1>
  ): Creator<
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

  onOkRes<ResOkRes2>(
    transform: Transform<ResOkRes2, Data1, Error1, Event, Options1, Service1>
  ): Creator<
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

  onFail<ResErr2>(
    transformError: TransformError<ResErr2, unknown, unknown, Event, Options1>
  ): Creator<
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

  onFailRes<ResErrRes2>(
    transformError: TransformError<ResErrRes2, FailureData1, FailureError1, Event, Options1>
  ): Creator<
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

  onFatal<ResFatal2>(
    transformFatal: TransformError<ResFatal2, unknown, unknown, Event, Options1>
  ): Creator<
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

  onFatalRes<ResFatalRes2>(
    transformFatal: TransformError<ResFatalRes2, ExceptionData1, ExceptionError1, Event, Options1>
  ): Creator<
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

  options(): Options1;

  req(): AwsHandler<
    Event,
    | GetReqRes<ResOk1, ResOkRes1>
    | GetReqRes<ResErr1, ResErrRes1>
    | GetReqRes<ResFatal1, ResFatalRes1>
  >;
}

export const creatorHelper = (
  runs: Runner,

  packsId: number,
  creatorsId: number,
  successHandlersId: number,
  failHandlersId: number,
  fatalHandlersId: number,

  options: ServiceOptions,

  lastHandler: Handler<ServiceContainer, unknown, unknown>,
  lastFailHandler: HandlerError<ServiceContainer, unknown, unknown, unknown>,
  lastFatalHandler: HandlerException<unknown, unknown>,

  creators: MetaCreator[],
  handlers: MetaSuccess[],
  failHandlers: MetaFail[],
  fatalHandlers: MetaFatal[],

  transform: Transform<unknown, unknown, unknown>,
  transformFail: TransformError<unknown, unknown, unknown>,
  transformFatal: TransformError<unknown, unknown, unknown>,

  transformRes: Transform<unknown, unknown, unknown> | undefined,
  transformFailRes: TransformError<unknown, unknown, unknown> | undefined,
  transformFatalRes: TransformError<unknown, unknown, unknown> | undefined
) => {
  const creator = {
    srv: (creator2: MiddlewareCreator<ServiceOptions, ServiceContainer, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId + 1,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators.concat({ creatorId: creatorsId + 1, creator: creator2 }),
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transformRes,
        transformFailRes,
        transformFatalRes
      );
    },

    opt: (options2: ServiceOptions) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        { ...options, ...options2 },

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transformRes,
        transformFailRes,
        transformFatalRes
      );
    },

    ctx: () => {
      return creator;
    },

    ok: (success2: Handler<ServiceContainer, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId + 1,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers.concat({
          successId: successHandlersId + 1,
          creatorId: creatorsId,
          success: success2,
        }),
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        undefined,
        transformFailRes,
        transformFatalRes
      );
    },

    fail: (error2: HandlerError<ServiceContainer, unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId + 1,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers.concat({
          failId: failHandlersId + 1,
          creatorId: creatorsId,
          failure: error2,
        }),
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transformRes,
        undefined,
        transformFatalRes
      );
    },

    fatal: (exception2: HandlerException<unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId + 1,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers.concat({
          fatalId: fatalHandlersId + 1,
          creatorId: creatorsId,
          fatal: exception2,
        }),

        transform,
        transformFail,
        transformFatal,

        transformRes,
        transformFailRes,
        undefined
      );
    },

    pack: (
      pack: Package<ServiceOptions, ServiceOptions, unknown, unknown, unknown, unknown, unknown>
    ) => {
      let successAdded = 0;
      let handlersAdded = handlers;

      if ((pack as { ok?: unknown }).ok) {
        successAdded = 1;

        handlersAdded = handlersAdded.concat({
          successId: successHandlersId + 1,
          creatorId: creatorsId + 1,
          packId: packsId,
          success: pack.ok,
        });
      }

      let failAdded = 0;
      let failsHandlersAdded = failHandlers;

      if ((pack as { fail?: unknown }).fail) {
        failAdded = 1;

        failsHandlersAdded = failsHandlersAdded.concat({
          failId: failHandlersId + 1,
          creatorId: creatorsId + 1,
          packId: packsId,
          failure: pack.fail,
        });
      }

      return creatorHelper(
        runs,

        packsId + 1,
        creatorsId + 1,
        successHandlersId + successAdded,
        failHandlersId + failAdded,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators.concat({ creatorId: creatorsId + 1, packId: packsId, creator: pack.srv }),
        handlersAdded,
        failsHandlersAdded,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transformRes,
        transformFailRes,
        transformFatalRes
      );
    },

    on: (
      transform2: Transform<unknown, unknown, unknown> & TransformError<unknown, unknown, unknown>
    ) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform2,
        transform2,
        transform2,

        undefined,
        undefined,
        undefined
      );
    },

    onOk: (transform2: Transform<unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform2,
        transformFail,
        transformFatal,

        undefined,
        transformFailRes,
        transformFatalRes
      );
    },

    onOkRes: (transform2: Transform<unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transform2,
        transformFailRes,
        transformFatalRes
      );
    },

    onFail: (transformFail2: TransformError<unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail2,
        transformFatal,

        transformRes,
        undefined,
        transformFatalRes
      );
    },

    onFailRes: (transformFail2: TransformError<unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transformRes,
        transformFail2,
        transformFatalRes
      );
    },

    onFatal: (transformFatal2: TransformError<unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal2,

        transformRes,
        transformFailRes,
        undefined
      );
    },

    onFatalRes: (transformFatal2: TransformError<unknown, unknown, unknown>) => {
      return creatorHelper(
        runs,

        packsId,
        creatorsId,
        successHandlersId,
        failHandlersId,
        fatalHandlersId,

        options,

        lastHandler,
        lastFailHandler,
        lastFatalHandler,

        creators,
        handlers,
        failHandlers,
        fatalHandlers,

        transform,
        transformFail,
        transformFatal,

        transformRes,
        transformFailRes,
        transformFatal2
      );
    },

    options: () => {
      return options;
    },

    req: () => {
      return runs(
        options,
        creators,
        handlers.concat({
          successId: successHandlersId + 1,
          creatorId: creatorsId,
          success: lastHandler,
        }),
        failHandlers.concat({
          failId: failHandlersId + 1,
          creatorId: creatorsId,
          failure: lastFailHandler,
        }),
        fatalHandlers.concat({
          fatalId: fatalHandlersId + 1,
          creatorId: creatorsId,
          fatal: lastFatalHandler,
        }),
        transformRes ? transformRes : transform,
        transformFailRes ? transformFailRes : transformFail,
        transformFatalRes ? transformFatalRes : transformFatal
      );
    },
  };

  return creator as unknown as Creator<
    AwsEvent,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    ServiceOptions,
    ServiceContainer,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  >;
};

// eslint-disable-next-line @typescript-eslint/require-await
export const success1: Success1 = async () => {
  return fail('NotImplemented', { order: -1 });
};

// eslint-disable-next-line @typescript-eslint/require-await
export const error1: Error1 = async ({ error }) => {
  if (typeof error === 'object' && error !== null) {
    const type =
      typeof (error as { type: unknown }).type === 'string'
        ? (error as { type: string }).type
        : 'Unknown';

    return fail(type, { order: -1, ...error });
  }

  return fail(typeof error === 'string' ? error : 'Unknown', { order: -1 });
};

// eslint-disable-next-line @typescript-eslint/require-await
export const exception1: Exception1 = async ({ exception }) => {
  return convertToFailure('FatalError', exception);
};

const transform1: Transform1 = json;
const transformError1: TransformError1 = json;
const transformException1: TransformError1 = json;

export const creatorStart = <
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
  runner1: Runner,
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1, ServiceContainer, Event>,
  options: Options1,
  success: Handler<Service1, Data1, Error1, Event, Options1>,
  error: HandlerError<Service1, ServiceError1, FailureData1, FailureError1, never, Event, Options1>,
  fatal: HandlerException<ExceptionData1, ExceptionError1, Event, Options1>,
  transform: Transform<ResOk1, unknown, unknown, Event, Options1, Service1>,
  transformFail: TransformError<ResErr1, unknown, unknown, Event, Options1>,
  transformFatal: TransformError<ResFatal1, unknown, unknown, Event, Options1>,
  transformRes: Transform<ResOkRes1, Data1, Error1, Event, Options1, Service1> | undefined,
  transformFailRes:
    | TransformError<ResErrRes1, FailureData1, FailureError1, Event, Options1>
    | undefined,
  transformFatalRes:
    | TransformError<ResFatalRes1, ExceptionData1, ExceptionError1, Event, Options1>
    | undefined
) => {
  return creatorHelper(
    runner1,
    0,
    0,
    0,
    0,
    0,
    options,
    success as Handler<ServiceContainer, unknown, unknown>,
    error as HandlerError<ServiceContainer, unknown, unknown, unknown>,
    fatal,
    [
      {
        creatorId: 0,
        creator: creator1,
      },
    ],
    [],
    [],
    [],
    transform as Transform<unknown, unknown, unknown>,
    transformFail as TransformError<unknown, unknown, unknown>,
    transformFatal as TransformError<unknown, unknown, unknown>,
    transformRes as Transform<unknown, unknown, unknown>,
    transformFailRes as TransformError<unknown, unknown, unknown>,
    transformFatalRes as TransformError<unknown, unknown, unknown>
  ) as unknown as Creator<
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
  >;
};

export const creator = <
  Event extends AwsEvent,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  ServiceError1 extends Err
>(
  creator1: MiddlewareCreator<Options1, Service1, ServiceError1, ServiceContainer, Event>
): typeof creatorType => {
  const options1: Options1 = {} as Options1;

  const creatorType = creatorStart(
    runner,
    creator1,
    options1,
    success1,
    error1,
    exception1,
    transform1,
    transformError1,
    transformException1,
    undefined,
    undefined,
    undefined
  );

  return creatorType;
};
