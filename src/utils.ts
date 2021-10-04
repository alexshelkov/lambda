import { compare, ok, fail, Err, Failure, Result } from 'lambda-res';

import {
  Handler,
  HandlerError,
  HandlerException,
  PrivateMiddlewareCreatorLifecycle,
  MiddlewareLifecycle,
  PrivateMiddlewareLifecycle,
  HandlerLifecycle,
  PrivateHandlerLifecycle,
  MiddlewareCreator,
  Request,
  RequestError,
  RequestException,
  ServiceContainer,
  ServiceOptions,
  AwsEvent,
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
  let finish: () => Promise<void> = async () => {};

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
      finish = cb;
    },
    async finish() {
      return finish();
    },
    service(service) {
      srv = service;
    },
    partial() {
      return srv;
    }
  };
};

export const disconnectLifecycle = (
  lifecycle: PrivateMiddlewareLifecycle
): [PrivateMiddlewareLifecycle, PrivateMiddlewareLifecycle] => {
  let f1: () => Promise<void> = async () => {};
  let f2: () => Promise<void> = async () => {};

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
      f1 = cb;
    },
    async finish() {
      return f1();
    },
    service(service) {
      lifecycle.service(service);
    },
    partial() {
      return lifecycle.partial();
    }
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
      f2 = cb;
    },
    async finish() {
      return f2();
    },
    service(service) {
      lifecycle.service(service);
    },
    partial() {
      return lifecycle.partial();
    }
  };

  lifecycle.destroy(async () => {
    await f2();
    await f1();
  });

  return [l1, l2];
};

export const glue = <
  Event extends AwsEvent,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  Error1
>(
  c1: MiddlewareCreator<Options1, Service1, Error1, ServiceContainer, Event>
) => {
  return <Options2 extends ServiceOptions, Service2 extends ServiceContainer, Error2>(
    c2: MiddlewareCreator<Options1 & Options2, Service2, Error2, Service1, Event>
  ): MiddlewareCreator<
    Options1 & Options2,
    Service1 & Service2,
    Error1 | Error2,
    ServiceContainer,
    Event
  > => {
    return (options, middlewareLifecycle) => {
      const [lm1, lm2] = disconnectMiddlewareLifecycle(
        middlewareLifecycle as PrivateMiddlewareCreatorLifecycle
      );

      const m1 = c1(options, lm1);
      const m2 = c2(options, lm2);

      return async (request, lifecycle) => {
        let r;

        const [l1, l2] = disconnectLifecycle(lifecycle as PrivateMiddlewareLifecycle);

        const r1 = await m1(request, l1);

        if (r1.isErr()) {
          r = r1;
        } else {
          const data = r1.ok();

          l1.service(data.service);

          r = await m2<typeof data.service>(data, l2);
        }

        return r;
      };
    };
  };
};

export const connect = (gen: number) => {
  return <
    Event extends AwsEvent,
    Options1 extends ServiceOptions,
    Service1 extends ServiceContainer,
    Error1
  >(
    c1: MiddlewareCreator<Options1, Service1, Error1, ServiceContainer, Event>
  ) => {
    return <Options2 extends ServiceOptions, Service2 extends ServiceContainer, Error2>(
      c2: MiddlewareCreator<Options1 & Options2, Service2, Error2, Service1, Event>
    ): MiddlewareCreator<
      Options1 & Options2,
      Service1 & Service2,
      Error1 | Error2,
      ServiceContainer,
      Event
    > => {
      return (options, middlewareLifecycle) => {
        const [lm1, lm2] = disconnectMiddlewareLifecycle(
          middlewareLifecycle as PrivateMiddlewareCreatorLifecycle
        );

        lm1.gen(gen - 1);
        lm2.gen(gen);

        const m1 = c1(options, lm1);
        const m2 = c2(options, lm2);

        return async (request, lifecycle) => {
          let r;

          const [l1, l2] = disconnectLifecycle(lifecycle as PrivateMiddlewareLifecycle);

          const r1 = await m1(request, l1);

          let dec = false;

          if (r1.isErr()) {
            dec = true;
            r = r1;
          } else {
            const data = r1.ok();

            l1.service(data.service);

            r = await m2<typeof data.service>(data, l2);
          }

          if (r.isErr()) {
            (lifecycle as PrivateMiddlewareLifecycle).error(dec ? gen - 1 : gen);
          }

          return r;
        };
      };
    };
  };
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

export const join = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: Handler<Service1, Data1, Error1, Event, Options>,
  c2: Handler<Service2, Data2, Error2, Event, Options>
): Handler<Service1 & Service2, Data1 | Data2, Error1 | Error2, Event, Options> => {
  return async (request, options, lifecycleHandler, lifecycle) => {
    const [l1, l2] = disconnectHandlerLifecycle(lifecycleHandler as PrivateHandlerLifecycle);

    const r1 = await c1(request, options, l1, lifecycle);

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(request, options, l2, lifecycle);

    return compare(r1, r2);
  };
};

export const glueFailure = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service extends ServiceContainer,
  ServiceError1,
  ServiceError2,
  Data1,
  Error1,
  Data2,
  Error2,
  HandledError1 = never,
  HandledError2 = never
>(
  c1: HandlerError<Service, ServiceError1, Data1, Error1, HandledError1, Event, Options>,
  c2: HandlerError<Service, ServiceError2, Data2, Error2, HandledError2, Event, Options>
): HandlerError<
  Service,
  Exclude<ServiceError1 | ServiceError2, HandledError1 | HandledError2>,
  Data1 | Data2,
  Error1 | Error2,
  HandledError1 | HandledError2,
  Event,
  Options
> => {
  return async (
    request: RequestError<Event, Service, ServiceError1 | ServiceError2>,
    options: Partial<Options>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ) => {
    const [l1, l2] = disconnectHandlerLifecycle(handlerLifecycle as PrivateHandlerLifecycle);

    const r1 = await c1(request as RequestError<Event, Service, ServiceError1>, options, l1, lifecycle);

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(request as RequestError<Event, Service, ServiceError2>, options, l2, lifecycle);

    return compare(r1, r2);
  };
};

export const joinFailure = (failGen: number) => {
  return <
    Event extends AwsEvent,
    Options extends ServiceOptions,
    Service extends ServiceContainer,
    ServiceError1,
    ServiceError2,
    Data1,
    Error1,
    Data2,
    Error2,
    HandledError1 = never,
    HandledError2 = never
  >(
    c1: HandlerError<Service, ServiceError1, Data1, Error1, HandledError1, Event, Options>,
    c2: HandlerError<Service, ServiceError2, Data2, Error2, HandledError2, Event, Options>
  ): HandlerError<
    Service,
    Exclude<ServiceError1 | ServiceError2, HandledError1 | HandledError2>,
    Data1 | Data2,
    Error1 | Error2,
    HandledError1 | HandledError2,
    Event,
    Options
  > => {
    return async (
      request: RequestError<Event, Service, ServiceError1 | ServiceError2>,
      options: Partial<Options>,
      handlerLifecycle: HandlerLifecycle,
      publicLifecycle: MiddlewareLifecycle
    ) => {
      const lifecycle = publicLifecycle as PrivateMiddlewareLifecycle;

      const [l1, l2] = disconnectHandlerLifecycle(handlerLifecycle as PrivateHandlerLifecycle);

      const r1 = await c1(request as RequestError<Event, Service, ServiceError1>, options, l1, lifecycle);

      if (l1.stops()) {
        return r1;
      }

      let r2;

      let gen = lifecycle.errored();
      const mdlGen = lifecycle.throws();

      if (mdlGen !== undefined) {
        gen = mdlGen;
      }

      if (failGen >= gen) {
        r2 = await c2(request as RequestError<Event, Service, ServiceError2>, options, l2, lifecycle);
      } else {
        r2 = (fail<Err>('Skipped', { skip: true }) as unknown) as Failure<Error2>;
      }

      return compare(r1, r2);
    };
  };
};

export const joinFatal = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: HandlerException<Data1, Error1, Event, Options>,
  c2: HandlerException<Data2, Error2, Event, Options>
): HandlerException<Data1 | Data2, Error1 | Error2, Event, Options> => {
  return async (
    request: RequestException<Event>,
    options: Partial<Options>,
    lifecycleHandler: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ) => {
    const [l1, l2] = disconnectHandlerLifecycle(lifecycleHandler as PrivateHandlerLifecycle);

    const r1 = await c1(request, options, l1, lifecycle);

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(request, options, l2, lifecycle);

    return compare(r1, r2);
  };
};

export const addService = <
  Event extends AwsEvent,
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer
>(
  request: Request<Event, Service1>,
  addedService: Service2
): Result<Request<Event, Service1 & Service2>, never> => {
  return ok({
    ...request,
    service: {
      ...request.service,
      ...addedService,
    },
  });
};
