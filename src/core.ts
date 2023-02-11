import { Err, Response, Result, ThrowFailFn } from 'lambda-res';
import { APIGatewayProxyResult } from 'aws-lambda';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceContainer {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ServiceOptions {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AwsEvent<Event = any, Context = any> {
  event: Event;
  context: Context;
}

export interface AwsHandler<Event extends AwsEvent, Response> {
  (event: Event['event'], context: Event['context']): Promise<Response>;
}

// ---------------------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------------------

export interface RequestBase<Event extends AwsEvent, Options extends ServiceOptions> {
  readonly event: Event['event'];
  readonly context: Event['context'];
  options: Partial<Options>;
}

export interface Request<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer
> extends RequestBase<Event, Options> {
  service: Service;
}

export interface RequestError<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError
> extends RequestBase<Event, Options> {
  service: Partial<Service>;
  error: ServiceError;
}

export interface RequestException<Event extends AwsEvent, Options extends ServiceOptions>
  extends RequestBase<Event, Options> {
  exception: unknown;
}

// ---------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------

export interface MiddlewareCreatorLifecycle {
  throws: ThrowFailFn;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PrivateMiddlewareCreatorLifecycle extends MiddlewareCreatorLifecycle {
  gen: (creatorId: number, packId?: number) => void;
}

export interface MiddlewareLifecycle {
  destroy: (cb: () => Promise<void>) => void;
  end: (cb: () => Promise<void>) => void;
}

export interface PrivateMiddlewareLifecycle extends MiddlewareLifecycle {
  destroyed: () => Promise<void>;
  ended: () => Promise<void>;
}

export interface HandlerLifecycle<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError
> {
  returns(cb: (() => Promise<boolean> | boolean) | boolean): void;

  works<Works extends Promise<boolean> | boolean>(
    cb: (() => Works) | Works
  ): Works extends Promise<unknown> ? Promise<void> : void;

  worksForErr<
    Type extends readonly (ServiceError extends Err ? ServiceError['type'] : never)[],
    Works extends (() => Promise<boolean>) | (() => boolean) | boolean
  >(
    cb: (() => Type) | Type,
    returns?: (() => Works) | boolean
  ): Works extends () => Promise<unknown>
    ? Promise<RequestError<Event, Options, Service, Extract<ServiceError, { type: Type[number] }>>>
    : RequestError<Event, Options, Service, Extract<ServiceError, { type: Type[number] }>>;

  worksForErr<
    Type extends ServiceError extends Err ? ServiceError['type'] : never,
    Works extends (() => Promise<boolean>) | (() => boolean) | boolean
  >(
    cb: (() => Type) | Type,
    returns?: Works
  ): Works extends () => Promise<unknown>
    ? Promise<RequestError<Event, Options, Service, Extract<ServiceError, { type: Type[number] }>>>
    : RequestError<Event, Options, Service, Extract<ServiceError, { type: Type[number] }>>;

  worksForErr<
    Type extends Promise<readonly (ServiceError extends Err ? ServiceError['type'] : never)[]>
  >(
    cb: (() => Type) | Type,
    returns?: (() => Promise<boolean> | boolean) | boolean
  ): Type extends Promise<infer JustType>
    ? JustType extends string[]
      ? Promise<
          RequestError<Event, Options, Service, Extract<ServiceError, { type: JustType[number] }>>
        >
      : never
    : never;

  worksForErr<Type extends Promise<ServiceError extends Err ? ServiceError['type'] : never>>(
    cb: (() => Type) | Type,
    returns?: (() => Promise<boolean> | boolean) | boolean
  ): Type extends Promise<infer JustType>
    ? JustType extends string[]
      ? Promise<
          RequestError<Event, Options, Service, Extract<ServiceError, { type: JustType[number] }>>
        >
      : never
    : never;
}

export interface PrivateHandlerLifecycle extends HandlerLifecycle<never, never, never, never> {
  stops: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------------------

export interface Middleware<
  Options extends ServiceOptions,
  Service2 extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent
> {
  _o?: Partial<Options>;
  _s?: Partial<Service2>;

  <Service1 extends ServiceContainer>(
    request: Request<Event, Options, Service1 & ServiceDeps>,
    lifecycle: MiddlewareLifecycle
  ): Response<Service1 & Service2, ServiceError>;
}

export interface MiddlewareCreator<
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent
> {
  (options: Partial<Options>, lifecycle: MiddlewareCreatorLifecycle): Middleware<
    Options,
    Service,
    ServiceError,
    ServiceDeps,
    Event
  >;
}

// ---------------------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------------------

export interface Handler<
  Service extends ServiceContainer,
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: Request<Event, Options, Service>,
    handlerLifecycle: HandlerLifecycle<Event, Options, Service, never>
  ): Response<Data, Error>;
}

export interface HandlerError<
  Service extends ServiceContainer,
  ServiceError,
  Data,
  Error,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HandledError = never,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: RequestError<Event, Options, Service, ServiceError>,
    handlerLifecycle: HandlerLifecycle<Event, Options, Service, ServiceError>
  ): Response<Data, Error>;
}

export interface HandlerException<
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: RequestException<Event, Options>,
    handlerLifecycle: HandlerLifecycle<Event, Options, never, never>
  ): Response<Data, Error>;
}

// ---------------------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------------------

export interface Transform<
  Res,
  Data = never,
  Error = never,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions,
  Service extends ServiceContainer = ServiceContainer
> {
  (response: Result<Data, Error>, request: Request<Event, Options, Service>): Promise<Res>;
}

export interface TransformError<
  Res,
  Data = never,
  Error = never,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (response: Result<Data, Error>, request: RequestBase<Event, Options>): Promise<Res>;
}

// ---------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------

export type MiddlewareFail<Error> = {
  type: 'MiddlewareFail';
  creatorId: number;
  packId?: number;
  inner: Result<never, Error>;
};

export type SkippedError = Err<'Skipped', { works?: boolean }>;
export type NotImplementedError = Err<'NotImplemented'>;

export type RunnerUncaughtError = Err<'RunnerUncaught', { cause: string }>;
export type RunnerUncaughtErrorTransform = Err<'RunnerUncaughtTransform', { cause?: string }>;
export type FatalError = Err<'FatalError', { cause?: string }>;
export type UnhandledErrors = RunnerUncaughtError | RunnerUncaughtErrorTransform | FatalError;

// ---------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------

export type GetReqRes<R1, R2> = R2 extends undefined ? R1 : R2;

export type FallBackTransform = (result: Result<unknown, unknown>) => Promise<unknown>;

// ---------------------------------------------------------------------------------------
// Default handlers
// ---------------------------------------------------------------------------------------

export type Success1 = Handler<ServiceContainer, never, NotImplementedError>;
// eslint-disable-next-line @typescript-eslint/ban-types
export type Error1 = HandlerError<{}, unknown, never, Err>;
export type Exception1 = HandlerException<never, UnhandledErrors>;
export type Transform1 = Transform<APIGatewayProxyResult, unknown, unknown>;
export type TransformError1 = TransformError<APIGatewayProxyResult, unknown, unknown>;

// ---------------------------------------------------------------------------------------
// Runner types
// ---------------------------------------------------------------------------------------

export type MetaCreator = {
  creatorId: number;
  packId?: number;
  creator: MiddlewareCreator<ServiceOptions, ServiceContainer, unknown>;
};

export type MetaMiddleware = {
  creatorId: number;
  packId?: number;
  middleware: Middleware<ServiceOptions, ServiceContainer, unknown>;
};

export type MetaMiddlewareLifecycle = {
  creatorId: number;
  packId?: number;
  lifecycle: PrivateMiddlewareLifecycle;
};

export type MetaSuccess = {
  successId: number;
  creatorId: number;
  packId?: number;
  success: Handler<ServiceContainer, unknown, unknown>;
};

export type MetaFail = {
  failId: number;
  creatorId: number;
  packId?: number;
  failure: HandlerError<ServiceContainer, unknown, unknown, unknown>;
};

export type MetaFatal = {
  fatalId: number;
  creatorId: number;
  fatal: HandlerException<unknown, unknown>;
};

export interface Runner {
  (
    options: ServiceOptions,
    creators: readonly MetaCreator[],
    successes: readonly MetaSuccess[],
    fails: readonly MetaFail[],
    fatales: readonly MetaFatal[],
    transform: Transform<unknown, unknown, unknown>,
    transformFail: TransformError<unknown, unknown, unknown>,
    transformFatal: TransformError<unknown, unknown, unknown>
  ): AwsHandler<AwsEvent, unknown>;
}
