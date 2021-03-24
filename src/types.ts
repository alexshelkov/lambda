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

export interface Middleware<
  ServiceAdded extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent,
> {
  <Service extends ServiceContainer>(request: Request<Event, Service & ServiceDeps>): Response<
  Request<Event, Service & ServiceAdded>,
  ServiceError
  >;
}

export interface MiddlewareCreator<
  OptionsAdded extends ServiceOptions,
  ServiceAdded extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer,
  Event extends AwsEvent = AwsEvent,
> {
  <Options extends ServiceOptions>(options: OptionsAdded & Options): Middleware<
  ServiceAdded,
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
> {
  (request: Request<Event, Service>): Response<Data, Error>;
}

export interface HandlerError<ServiceError, Data, Error, Event extends AwsEvent = AwsEvent> {
  (request: RequestError<Event, ServiceError>): Response<Data, Error>;
}

export interface HandlerException<Data, Error, Event extends AwsEvent = AwsEvent> {
  (request: RequestException<Event>): Response<Data, Error>;
}

export interface Transform<Event extends AwsEvent, Service extends ServiceContainer, Res> {
  (response: Result<unknown, unknown>, request: Request<Event, Service>): Promise<Res>;
}

export interface TransformError<Event extends AwsEvent, Res> {
  (response: Result<unknown, unknown>, event: Event): Promise<Res>;
}
