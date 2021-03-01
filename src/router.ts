import { Err, fail } from '@alexshelkov/result';

import { Handler, ServiceContainer, Request, AwsEvent } from './types';

export interface Router<
  Event extends AwsEvent,
  Service extends ServiceContainer,
  Routed extends ServiceContainer
> {
  (request: Request<Event, Service>): Request<Event, Routed> | false;
}

export type SkippedError = {
  type: 'Skipped';
} & Err;

export const route = <
  Event extends AwsEvent,
  Service extends ServiceContainer,
  Routed extends ServiceContainer
>(
  router: Router<Event, Service, Routed>
) => {
  return <Data, Error>(
    handler: Handler<Routed, Data, Error, Event>
  ): Handler<Service, Data, SkippedError | Error, Event> => {
    return async (request: Request<Event, Service>) => {
      const routedRequest = router(request);

      if (!routedRequest) {
        return fail<SkippedError>('Skipped', { skip: true });
      }

      return handler(routedRequest);
    };
  };
};
