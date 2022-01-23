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

export type MiddlewareFail<Error> = {
  type: 'MiddlewareFail';
  gen: number;
  inner: Result<never, Error>;
};

export interface MiddlewareCreatorLifecycle {
  throws: ThrowFailFn;
}

export interface PrivateMiddlewareCreatorLifecycle extends MiddlewareCreatorLifecycle {
  gen: (gen: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ProtectedMiddlewareLifecycle {}

export interface MiddlewareLifecycle extends ProtectedMiddlewareLifecycle {
  destroy: (cb: () => Promise<void>) => void;
  end: (cb: () => Promise<void>) => void;
}

export interface PrivateMiddlewareLifecycle extends MiddlewareLifecycle {
  destroyed: () => Promise<void>;
  ended: () => Promise<void>;
  threw: (threw: number | undefined) => void;
  throws: () => number | undefined;
  errored: () => number;
  error: (err: number) => void;
  service: (service: ServiceContainer) => void;
  partial: () => ServiceContainer;
}

export interface HandlerLifecycle {
  returns: (cb: () => boolean) => void;
}

export interface PrivateHandlerLifecycle extends HandlerLifecycle {
  stops: () => boolean;
}

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

export interface Handler<
  Service extends ServiceContainer,
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: Request<Event, Options, Service>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: ProtectedMiddlewareLifecycle
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
    handlerLifecycle: HandlerLifecycle,
    lifecycle: ProtectedMiddlewareLifecycle
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
    handlerLifecycle: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ): Response<Data, Error>;
}

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

export type GetReqRes<R1, R2> = R2 extends undefined ? R1 : R2;

export type SkippedError = Err<'Skipped'>;
export type NotImplementedError = Err<'NotImplemented'>;

export type UnhandledError = { cause?: string };
export type UncaughtError = Err<'UncaughtError', UnhandledError>;
export type UncaughtErrorTransform = Err<'UncaughtTransformError', UnhandledError>;
export type UnhandledErrors = UncaughtError | UncaughtErrorTransform;

export type FallBackTransform = (result: Result<unknown, unknown>) => Promise<unknown>;

export type Success1 = Handler<ServiceContainer, never, NotImplementedError>;
// eslint-disable-next-line @typescript-eslint/ban-types
export type Error1 = HandlerError<{}, unknown, never, Err>;
export type Exception1 = HandlerException<never, UnhandledErrors>;
export type Transform1 = Transform<APIGatewayProxyResult, unknown, unknown>;
export type TransformError1 = TransformError<APIGatewayProxyResult, unknown, unknown>;
