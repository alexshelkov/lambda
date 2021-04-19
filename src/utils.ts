import { compare, ok, fail, Success, Err, Failure } from 'lambda-res';

import {
  Handler,
  HandlerError,
  HandlerException,
  MiddlewareCreatorLifecycle,
  MiddlewareLifecycle,
  MiddlewareCreator,
  Request,
  RequestError,
  RequestException,
  ServiceContainer,
  ServiceOptions,
  AwsEvent,
  HandlerLifecycle,
  MiddlewareFail,
} from './types';

export const createMiddlewareLifecycle = (): MiddlewareCreatorLifecycle => {
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
  _lifecycle: MiddlewareCreatorLifecycle
): [MiddlewareCreatorLifecycle, MiddlewareCreatorLifecycle] => {
  let g1 = -1;
  let g2 = -1;

  const l1: MiddlewareCreatorLifecycle = {
    gen(g) {
      g1 = g;
    },
    throws(...params) {
      throw fail<MiddlewareFail<unknown>>('MiddlewareFail', { gen: g1, inner: fail(...params) });
    },
  };

  const l2: MiddlewareCreatorLifecycle = {
    gen(g) {
      g2 = g;
    },
    throws(...params) {
      throw fail<MiddlewareFail<unknown>>('MiddlewareFail', { gen: g2, inner: fail(...params) });
    },
  };

  return [l1, l2];
};

export const createLifecycle = (): MiddlewareLifecycle => {
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
  };
};

export const disconnectLifecycle = (
  lifecycle: MiddlewareLifecycle
): [MiddlewareLifecycle, MiddlewareLifecycle] => {
  let f1: () => Promise<void> = async () => {};
  let f2: () => Promise<void> = async () => {};

  const l1: MiddlewareLifecycle = {
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
  };

  const l2: MiddlewareLifecycle = {
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
      const [lm1, lm2] = disconnectMiddlewareLifecycle(middlewareLifecycle);

      const m1 = c1(options, lm1);
      const m2 = c2(options, lm2);

      return async (request, lifecycle) => {
        let r;

        const [l1, l2] = disconnectLifecycle(lifecycle);

        const r1 = await m1(request, l1);

        if (r1.isErr()) {
          r = r1;
        } else {
          r = await m2<typeof r1.data.service>(r1.data, l2);
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
        const [lm1, lm2] = disconnectMiddlewareLifecycle(middlewareLifecycle);

        lm1.gen(gen - 1);
        lm2.gen(gen);

        const m1 = c1(options, lm1);
        const m2 = c2(options, lm2);

        return async (request, lifecycle) => {
          let r;

          const [l1, l2] = disconnectLifecycle(lifecycle);

          const r1 = await m1(request, l1);

          let dec = false;

          if (r1.isErr()) {
            dec = true;
            r = r1;
          } else {
            r = await m2<typeof r1.data.service>(r1.data, l2);
          }

          if (r.isErr()) {
            lifecycle.error(dec ? gen - 1 : gen);
          }

          return r;
        };
      };
    };
  };
};

export const createHandlerLifecycle = (): HandlerLifecycle => {
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
  lifecycle: HandlerLifecycle
): [HandlerLifecycle, HandlerLifecycle] => {
  let s1: () => boolean = () => {
    return false;
  };
  let s2: () => boolean = () => {
    return false;
  };

  const l1: HandlerLifecycle = {
    ...lifecycle,
    stops() {
      return s1();
    },
    returns(cb) {
      s1 = cb;
    },
  };

  const l2: HandlerLifecycle = {
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
  return async (
    request: Request<Event, Service1 & Service2>,
    options: Partial<Options>,
    lifecycleHandler: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ) => {
    const [l1, l2] = disconnectHandlerLifecycle(lifecycleHandler);

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
  ServiceError1,
  ServiceError2,
  Data1,
  Error1,
  Data2,
  Error2,
  HandledError1 = never,
  HandledError2 = never
>(
  c1: HandlerError<ServiceError1, Data1, Error1, HandledError1, Event, Options>,
  c2: HandlerError<ServiceError2, Data2, Error2, HandledError2, Event, Options>
): HandlerError<
  Exclude<ServiceError1 | ServiceError2, HandledError1 | HandledError2>,
  Data1 | Data2,
  Error1 | Error2,
  HandledError1 | HandledError2,
  Event,
  Options
> => {
  return async (
    request: RequestError<Event, ServiceError1 | ServiceError2>,
    options: Partial<Options>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ) => {
    const [l1, l2] = disconnectHandlerLifecycle(handlerLifecycle);

    const r1 = await c1(request as RequestError<Event, ServiceError1>, options, l1, lifecycle);

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(request as RequestError<Event, ServiceError2>, options, l2, lifecycle);

    return compare(r1, r2);
  };
};

export const joinFailure = (failGen: number) => {
  return <
    Event extends AwsEvent,
    Options extends ServiceOptions,
    ServiceError1,
    ServiceError2,
    Data1,
    Error1,
    Data2,
    Error2,
    HandledError1 = never,
    HandledError2 = never
  >(
    c1: HandlerError<ServiceError1, Data1, Error1, HandledError1, Event, Options>,
    c2: HandlerError<ServiceError2, Data2, Error2, HandledError2, Event, Options>
  ): HandlerError<
    Exclude<ServiceError1 | ServiceError2, HandledError1 | HandledError2>,
    Data1 | Data2,
    Error1 | Error2,
    HandledError1 | HandledError2,
    Event,
    Options
  > => {
    return async (
      request: RequestError<Event, ServiceError1 | ServiceError2>,
      options: Partial<Options>,
      handlerLifecycle: HandlerLifecycle,
      lifecycle: MiddlewareLifecycle
    ) => {
      const [l1, l2] = disconnectHandlerLifecycle(handlerLifecycle);

      const r1 = await c1(request as RequestError<Event, ServiceError1>, options, l1, lifecycle);

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
        r2 = await c2(request as RequestError<Event, ServiceError2>, options, l2, lifecycle);
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
    const [l1, l2] = disconnectHandlerLifecycle(lifecycleHandler);

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
): Success<Request<Event, Service1 & Service2>> => {
  return ok({
    ...request,
    service: {
      ...request.service,
      ...addedService,
    },
  });
};
