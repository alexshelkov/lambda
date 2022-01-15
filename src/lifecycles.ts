import { fail } from 'lambda-res';

import {
  PrivateMiddlewareCreatorLifecycle,
  PrivateMiddlewareLifecycle,
  PrivateHandlerLifecycle,
  ServiceContainer,
  MiddlewareFail,
} from './types';

export const createMiddlewareLifecycle = (): PrivateMiddlewareCreatorLifecycle => {
  let gen = -1;

  return {
    gen(g) {
      gen = g;
    },
    throws(...params) {
      throw fail<MiddlewareFail<unknown>>('MiddlewareFail', { gen, inner: fail(...params) });
    },
  };
};

export const disconnectMiddlewareLifecycle = (
  _lifecycle: PrivateMiddlewareCreatorLifecycle
): [PrivateMiddlewareCreatorLifecycle, PrivateMiddlewareCreatorLifecycle] => {
  let g1 = -1;
  let g2 = -1;

  const l1: PrivateMiddlewareCreatorLifecycle = {
    gen(g) {
      g1 = g;
    },
    throws(...params) {
      throw fail<MiddlewareFail<unknown>>('MiddlewareFail', { gen: g1, inner: fail(...params) });
    },
  };

  const l2: PrivateMiddlewareCreatorLifecycle = {
    gen(g) {
      g2 = g;
    },
    throws(...params) {
      throw fail<MiddlewareFail<unknown>>('MiddlewareFail', { gen: g2, inner: fail(...params) });
    },
  };

  return [l1, l2];
};

export const createLifecycle = (): PrivateMiddlewareLifecycle => {
  let srv: ServiceContainer = {};
  let threw: number | undefined;
  let error = -1;
  let destroyed: () => Promise<void> = async () => {};
  let ended: () => Promise<void> = async () => {};

  return {
    threw(th) {
      threw = th;
    },
    throws() {
      return threw;
    },
    error(err) {
      if (error === -1) {
        error = err;
      }
    },
    errored() {
      return error;
    },
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
    service(service) {
      srv = service;
    },
    partial() {
      return srv;
    },
  };
};

export const disconnectLifecycle = (
  lifecycle: PrivateMiddlewareLifecycle
): [PrivateMiddlewareLifecycle, PrivateMiddlewareLifecycle] => {
  let d1: () => Promise<void> = async () => {};
  let e1: () => Promise<void> = async () => {};
  let d2: () => Promise<void> = async () => {};
  let e2: () => Promise<void> = async () => {};

  const l1: PrivateMiddlewareLifecycle = {
    threw(th) {
      lifecycle.threw(th);
    },
    throws() {
      return lifecycle.throws();
    },
    error(err) {
      lifecycle.error(err);
    },
    errored() {
      return lifecycle.errored();
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async destroy(cb) {
      d1 = cb;
    },
    async destroyed() {
      return d1();
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async end(cb) {
      e1 = cb;
    },
    async ended() {
      return e1();
    },
    service(service) {
      lifecycle.service(service);
    },
    partial() {
      return lifecycle.partial();
    },
  };

  const l2: PrivateMiddlewareLifecycle = {
    error(err) {
      lifecycle.error(err);
    },
    throws() {
      return lifecycle.throws();
    },
    threw(th) {
      lifecycle.threw(th);
    },
    errored() {
      return lifecycle.errored();
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async destroy(cb) {
      d2 = cb;
    },
    async destroyed() {
      return d2();
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async end(cb) {
      e2 = cb;
    },
    async ended() {
      return e2();
    },
    service(service) {
      lifecycle.service(service);
    },
    partial() {
      return lifecycle.partial();
    },
  };

  lifecycle.destroy(async () => {
    await d2();
    await d1();
  });

  lifecycle.end(async () => {
    await e1();
    await e2();
  });

  return [l1, l2];
};

export const createHandlerLifecycle = (): PrivateHandlerLifecycle => {
  let stops: () => boolean = () => {
    return false;
  };

  return {
    returns(cb) {
      stops = cb;
    },
    stops() {
      return stops();
    },
  };
};

export const disconnectHandlerLifecycle = (
  lifecycle: PrivateHandlerLifecycle
): [PrivateHandlerLifecycle, PrivateHandlerLifecycle] => {
  let s1: () => boolean = () => {
    return false;
  };
  let s2: () => boolean = () => {
    return false;
  };

  const l1: PrivateHandlerLifecycle = {
    ...lifecycle,
    stops() {
      return s1();
    },
    returns(cb) {
      s1 = cb;
    },
  };

  const l2: PrivateHandlerLifecycle = {
    ...lifecycle,
    stops() {
      return s2();
    },
    returns(cb) {
      s2 = cb;
    },
  };

  lifecycle.returns(() => {
    if (l1.stops()) {
      return true;
    }

    return l2.stops();
  });

  return [l1, l2];
};
