import { Err, fail } from '@alexshelkov/result';

import { Handler, ServiceContainer, Request, AwsEvent, ServiceOptions } from './types';

export interface Router<
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  Routed extends ServiceContainer
> {
  (request: Request<Event, Service>, options: Partial<Options>): Request<Event, Routed> | false;
}

export type SkippedError = {
  type: 'Skipped';
} & Err;

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
    return async (request: Request<Event, Service>, options: Partial<Options>) => {
      const routedRequest = router(request, options);

      if (!routedRequest) {
        return fail<SkippedError>('Skipped', { skip: true });
      }

      return handler(routedRequest, options);
    };
  };
};
