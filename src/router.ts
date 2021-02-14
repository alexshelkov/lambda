import { Err, fail } from '@alexshelkov/result';

import { Handler, ServiceContainer, Request } from './types';

export interface Router<Service extends ServiceContainer, Routed extends ServiceContainer> {
  (request: Request<Service>): Request<Routed> | false;
}

export type SkippedError = {
  type: 'Skipped';
} & Err;

export const route = <Service extends ServiceContainer, Routed extends ServiceContainer>(
  router: Router<Service, Routed>
) => <Data, Error>(
  handler: Handler<Routed, Data, Error>
): Handler<Service, Data, SkippedError | Error> => async (request: Request<Service>) => {
  const routedRequest = router(request);

  if (!routedRequest) {
    return fail<SkippedError>('Skipped', { skip: true });
  }

  return handler(routedRequest);
};
