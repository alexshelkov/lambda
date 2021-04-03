import { fail } from '@alexshelkov/result';

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
  (request: Request<Event, Service>, options: Partial<Options>): Request<Event, Routed> | false;
}

export interface RouterError<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  ServiceError,
  Routed
> {
  (request: RequestError<Event, ServiceError>, options: Partial<Options>):
    | RequestError<Event, Routed>
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
    return async (request, options, handlerLifecycle, lifecycle) => {
      const routedRequest = router(request, options);

      if (!routedRequest) {
        return fail<SkippedError>('Skipped', { skip: true });
      }

      return handler(routedRequest, options, handlerLifecycle, lifecycle);
    };
  };
};

export const routeError = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  ServiceError,
  Routed
>(
  router: RouterError<Event, Options, ServiceError, Routed>
) => {
  return <Data, Error, HandledError = never>(
    handler: HandlerError<Routed, Data, Error, HandledError, Event, Options>
  ): HandlerError<ServiceError, Data, SkippedError | Error, HandledError, Event, Options> => {
    return async (request, options, handlerLifecycle, lifecycle) => {
      const routedRequest = router(request, options);

      if (!routedRequest) {
        return fail<SkippedError>('Skipped', { skip: true });
      }

      return handler(routedRequest, options, handlerLifecycle, lifecycle);
    };
  };
};
