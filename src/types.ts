import { Response, Result } from '@alexshelkov/result';

export interface ServiceContainer {
  [K: string]: unknown;
}

export interface ServiceOptions {
  [K: string]: unknown;
}

export interface AwsEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any;
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

export interface MiddlewareEvents {
  destroy: () => Promise<void>;
}

export interface MiddlewareLifecycle {
  destroy: (cb: MiddlewareEvents['destroy']) => void;
}

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
  (options: Partial<Options>): Middleware<Service, ServiceError, ServiceDeps, Event>;
}

export interface Handler<
  Service extends ServiceContainer,
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (request: Request<Event, Service>, options: Partial<Options>): Response<Data, Error>;
}

export interface HandlerError<
  ServiceError,
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (request: RequestError<Event, ServiceError>, options: Partial<Options>): Response<Data, Error>;
}

export interface HandlerException<
  Data,
  Error,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (request: RequestException<Event>, options: Partial<Options>): Response<Data, Error>;
}

export interface Transform<
  Res,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions,
  Service extends ServiceContainer = ServiceContainer
> {
  (
    response: Result<unknown, unknown>,
    request: Request<Event, Service>,
    options: Partial<Options>
  ): Promise<Res>;
}

export interface TransformError<
  Res,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  (response: Result<unknown, unknown>, event: Event, options: Partial<Options>): Promise<Res>;
}
