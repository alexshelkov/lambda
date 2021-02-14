import { APIGatewayProxyResult, Context, Handler as BaseAwsHandler } from 'aws-lambda';

import { Response, Result } from '@alexshelkov/result';

export interface ServiceContainer {
  [K: string]: unknown;
}

export interface ServiceOptions {
  [K: string]: unknown;
}

export type AwsEvent = {
  [key: string]: unknown;
};

export type AwsResult = APIGatewayProxyResult;

export type AwsHandler = BaseAwsHandler;

export type AwsContext = Context;

export interface RequestBase {
  readonly event: AwsEvent;
  readonly context: AwsContext;
}

export interface Request<Service extends ServiceContainer> extends RequestBase {
  service: Service;
}

export interface RequestError<ServiceError> extends RequestBase {
  error: ServiceError;
}

export interface RequestException extends RequestBase {
  exception: unknown;
}

export interface Middleware<
  ServiceAdded extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer
> {
  <Service extends ServiceContainer>(request: Request<Service & ServiceDeps>): Response<
    Request<Service & ServiceAdded>,
    ServiceError
  >;
}

export interface MiddlewareCreator<
  OptionsAdded extends ServiceOptions,
  ServiceAdded extends ServiceContainer,
  ServiceError,
  ServiceDeps extends ServiceContainer = ServiceContainer
> {
  <Options extends ServiceOptions>(options: OptionsAdded & Options): Middleware<
    ServiceAdded,
    ServiceError,
    ServiceDeps
  >;
}

export interface Handler<Service extends ServiceContainer, Data, Error> {
  (request: Request<Service>): Response<Data, Error>;
}

export interface HandlerError<ServiceError, Data, Error> {
  (request: RequestError<ServiceError>): Response<Data, Error>;
}

export interface HandlerException<Data, Error> {
  (request: RequestException): Response<Data, Error>;
}

export interface Transform {
  (response: Result<unknown, unknown>): Promise<AwsResult>;
}
