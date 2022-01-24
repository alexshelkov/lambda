import {
  AwsEvent,
  Handler,
  MiddlewareCreator,
  ServiceContainer,
  ServiceOptions,
  HandlerError,
} from './core';

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
