import { fail, isErr } from 'lambda-res';

import {
  PrivateMiddlewareCreatorLifecycle,
  PrivateMiddlewareLifecycle,
  PrivateHandlerLifecycle,
  ServiceContainer,
  MiddlewareFail,
  SkippedError,
  AwsEvent,
  ServiceOptions,
  RequestError,
  Request,
  RequestException,
  EarlyReturns,
  WorksCb,
} from './core';
import { isPromise } from './utils';

export const createCreatorLifecycle = (): PrivateMiddlewareCreatorLifecycle => {
  let creatorId = -1;
  let packId: number | undefined;

  return {
    gen(c, p) {
      creatorId = c;
      packId = p;
    },
    throws(...params) {
      throw fail<MiddlewareFail<unknown>>('MiddlewareFail', {
        creatorId,
        packId,
        inner: fail(...params),
      });
    },
  };
};

export const createLifecycle = (): PrivateMiddlewareLifecycle => {
  let destroyed: () => Promise<void> = async () => {};
  let ended: () => Promise<void> = async () => {};

  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    async destroy(cb) {
      destroyed = cb;
    },
    async destroyed() {
      return destroyed();
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async end(cb) {
      ended = cb;
    },
    async ended() {
      return ended();
    },
  };
};

export const createHandlerLifecycle = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError
>(
  request:
    | Request<Event, Options, Service>
    | RequestError<Event, Options, Service, ServiceError>
    | RequestException<Event, Options>
): PrivateHandlerLifecycle => {
  let isStopped = false;
  // eslint-disable-next-line @typescript-eslint/require-await
  let stops: () => Promise<boolean> | boolean = async () => {
    return isStopped;
  };

  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    async returns(cb) {
      if (typeof cb === 'boolean') {
        isStopped = cb;
      } else {
        stops = cb;
      }
    },
    async stops() {
      return stops();
    },
    works<Works extends EarlyReturns>(
      cb: Works
    ): Works extends () => Promise<unknown> ? Promise<void> : void {
      const working = typeof cb === 'function' ? cb() : cb;

      if (isPromise(working)) {
        return working.then((worked) => {
          if (!worked) {
            throw fail<SkippedError>('Skipped', { works: true });
          }
        }) as never;
      } else if (!working) {
        throw fail<SkippedError>('Skipped', { works: true });
      }

      return undefined as never;
    },
    worksForErr(cb: WorksCb<string>, returns?: EarlyReturns): never {
      if (returns) {
        if (typeof returns === 'boolean') {
          isStopped = returns;
        } else {
          stops = returns;
        }
      }

      const working = typeof cb === 'function' ? cb() : cb;

      const isSkip = (worked: string | readonly string[]) => {
        if (!Array.isArray(worked)) {
          worked = [worked as string];
        }

        return (
          'error' in request && isErr(request.error) && worked.indexOf(request.error.type) === -1
        );
      };

      if (isPromise(working)) {
        return working.then((worked) => {
          if (isSkip(worked)) {
            throw fail<SkippedError>('Skipped', { works: true });
          }

          return request;
        }) as never;
      } else if (isSkip(working)) {
        throw fail<SkippedError>('Skipped', { works: true });
      }

      return request as never;
    },
  };
};
