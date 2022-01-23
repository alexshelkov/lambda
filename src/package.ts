import { Response } from 'lambda-res';

import {
  AwsEvent,
  Handler,
  HandlerLifecycle,
  MiddlewareCreator,
  ProtectedMiddlewareLifecycle,
  RequestError,
  ServiceContainer,
  ServiceOptions,
} from './types';

type IsBothNever<Data, Error> = [Data] extends [never]
  ? [Error] extends [never]
    ? true
    : false
  : false;

// MUST be compatible HandlerError
interface PackageHandlerError<
  Service extends ServiceContainer,
  ServiceError2,
  Data,
  Error,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HandledError = never,
  Event extends AwsEvent = AwsEvent,
  Options extends ServiceOptions = ServiceOptions
> {
  <ServiceError1>(
    request: RequestError<Event, Options, Service, ServiceError1 | ServiceError2>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: ProtectedMiddlewareLifecycle
  ): Response<Data, Error>;
}

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
        fail: PackageHandlerError<
          Service & ServiceDeps,
          ServiceError,
          FailureData,
          FailureError,
          HandledError,
          Event,
          Options
        >;
      });
