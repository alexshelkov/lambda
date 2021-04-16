import { Response, Result, Failure, fail, Err } from '@alexshelkov/result';
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

export interface RequestBase<Event extends AwsEvent> {
  readonly event: Event['event'];
  readonly context: Event['context'];
}

export interface Request<Event extends AwsEvent, Service extends ServiceContainer>
  extends RequestBase<Event> {
  service: Service;
}

export interface RequestError<Event extends AwsEvent, ServiceError> extends RequestBase<Event> {
  error: ServiceError;
}

export interface RequestException<Event extends AwsEvent> extends RequestBase<Event> {
  exception: unknown;
}

export type MiddlewareFail<Error> = { type: 'MiddlewareFail'; gen: number; inner: Failure<Error> };

export type MiddlewareCreatorLifecycle = {
  gen: (gen: number) => void;
  throws: typeof fail;
};

export type MiddlewareLifecycle = {
  threw: (threw: number | undefined) => void;
  throws: () => number | undefined;
  finish: () => Promise<void>;
  error: (err: number) => void;
  errored: () => number;
  destroy: (cb: () => Promise<void>) => void;
};

export interface Middleware<
  Service2 extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent
> {
  <Service1 extends ServiceContainer>(
    request: Request<Event, Service1 & ServiceDeps>,
    lifecycle: MiddlewareLifecycle
  ): Response<Request<Event, Service1 & Service2>, ServiceError>;
}

export interface MiddlewareCreator<
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent
> {
  (options: Partial<Options>, lifecycle: MiddlewareCreatorLifecycle): Middleware<
    Service,
    ServiceError,
    ServiceDeps,
    Event
  >;
}

export interface HandlerLifecycle {
  returns: (cb: () => boolean) => void;
  stops: () => boolean;
}

export interface Handler<
  Service extends ServiceContainer,
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: Request<Event, Service>,
    options: Partial<Options>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ): Response<Data, Error>;
}

export interface HandlerError<
  ServiceError,
  Data,
  Error,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HandledError = never,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: RequestError<Event, ServiceError>,
    options: Partial<Options>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ): Response<Data, Error>;
}

export interface HandlerException<
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (
    request: RequestException<Event>,
    options: Partial<Options>,
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
  (
    response: Result<Data, Error>,
    request: Request<Event, Service>,
    options: Partial<Options>
  ): Promise<Res>;
}

export interface TransformError<
  Res,
  Data = never,
  Error = never,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (response: Result<Data, Error>, event: Event, options: Partial<Options>): Promise<Res>;
}

export type SkippedError = Err<'Skipped'>;

export type UnhandledError = { cause?: string };
export type UncaughtError = Err<'UncaughtError', UnhandledError>;
export type UncaughtErrorTransform = Err<'UncaughtTransformError', UnhandledError>;
export type UnhandledErrors = UncaughtError | UncaughtErrorTransform;

export type FallBackTransform = (result: Result<unknown, unknown>) => Promise<unknown>;

export type Success1 = Handler<ServiceContainer, never, Err<'NotImplemented'>>;
export type Error1 = HandlerError<unknown, never, Err>;
export type Exception1 = HandlerException<never, UnhandledErrors>;
export { APIGatewayProxyResult };
export type Transform1 = Transform<APIGatewayProxyResult, unknown, unknown>;
export type TransformError1 = TransformError<APIGatewayProxyResult, unknown, unknown>;
