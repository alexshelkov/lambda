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
  Event extends AwsEvent = AwsEvent
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
  Event extends AwsEvent = AwsEvent
> {
  <Options extends ServiceOptions>(options: OptionsAdded & Options): Middleware<
    ServiceAdded,
    ServiceError,
    ServiceDeps,
    Event
  >;
}

export interface Handler<Event extends AwsEvent, Service extends ServiceContainer, Data, Error> {
  (request: Request<Event, Service>): Response<Data, Error>;
}

export interface HandlerError<Event extends AwsEvent, ServiceError, Data, Error> {
  (request: RequestError<Event, ServiceError>): Response<Data, Error>;
}

export interface HandlerException<Event extends AwsEvent, Data, Error> {
  (request: RequestException<Event>): Response<Data, Error>;
}

export interface Transform<Event extends AwsEvent, Response> {
  (response: Result<unknown, unknown>, event: Event): Promise<Response>;
}
