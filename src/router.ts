import { fail } from 'lambda-res';

import {
  Handler,
  ServiceContainer,
  Request,
  AwsEvent,
  ServiceOptions,
  RequestError,
  HandlerError,
  SkippedError,
} from './types';

export interface Router<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  Routed extends ServiceContainer
> {
  (request: Request<Event, Options, Service>): Request<Event, Options, Routed> | false;
}

export interface RouterError<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError,
  RoutedService extends ServiceContainer,
  RoutedError
> {
  (request: RequestError<Event, Options, Service, ServiceError>):
    | RequestError<Event, Options, RoutedService, RoutedError>
    | false;
}

export const route = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  Routed extends ServiceContainer
>(
  router: Router<Event, Options, Service, Routed>
) => {
  return <Data, Error>(
    handler: Handler<Routed, Data, Error, Event, Options>
  ): Handler<Service, Data, SkippedError | Error, Event, Options> => {
    return async (request, handlerLifecycle, lifecycle) => {
      const routedRequest = router(request);

      if (!routedRequest) {
        return fail<SkippedError>('Skipped', { skip: true });
      }

      return handler(routedRequest, handlerLifecycle, lifecycle);
    };
  };
};

export const routeError = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError,
  RoutedService extends ServiceContainer,
  RoutedError
>(
  router: RouterError<Event, Options, Service, ServiceError, RoutedService, RoutedError>
) => {
  return <Data, Error, HandledError = never>(
    handler: HandlerError<RoutedService, RoutedError, Data, Error, HandledError, Event, Options>
  ): HandlerError<
    Service,
    ServiceError,
    Data,
    SkippedError | Error,
    HandledError,
    Event,
    Options
  > => {
    return async (request, handlerLifecycle, lifecycle) => {
      const routedRequest = router(request);

      if (!routedRequest) {
        return fail<SkippedError>('Skipped', { skip: true });
      }

      return handler(routedRequest, handlerLifecycle, lifecycle);
    };
  };
};
