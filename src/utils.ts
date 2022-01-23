import { compare, ok, fail, Err, Failure, Result } from 'lambda-res';

import {
  Handler,
  HandlerError,
  HandlerException,
  ProtectedMiddlewareLifecycle,
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
} from './types';

import {
  disconnectMiddlewareLifecycle,
  disconnectLifecycle,
  disconnectHandlerLifecycle,
} from './lifecycles';

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

        if (gen !== -1) {
          lm1.gen(gen - 1);
          lm2.gen(gen);
        }

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
            const srv = r1.ok();

            l1.service(srv);

            r = await m2<typeof srv>(
              {
                ...request,
                service: {
                  ...request.service,
                  ...srv,
                },
              },
              l2
            );
          }

          if (gen !== -1 && r.isErr()) {
            (lifecycle as PrivateMiddlewareLifecycle).error(dec ? gen - 1 : gen);
          }

          return r;
        };
      };
    };
  };
};

export const glue = connect(-1);

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
  return async (request, lifecycleHandler, lifecycle) => {
    const [l1, l2] = disconnectHandlerLifecycle(lifecycleHandler as PrivateHandlerLifecycle);

    const r1 = await c1(request, l1, lifecycle);

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(request, l2, lifecycle);

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
    request: RequestError<Event, Options, Service, ServiceError1 | ServiceError2>,
    handlerLifecycle: HandlerLifecycle,
    lifecycle: ProtectedMiddlewareLifecycle
  ) => {
    const [l1, l2] = disconnectHandlerLifecycle(handlerLifecycle as PrivateHandlerLifecycle);

    const r1 = await c1(
      request as RequestError<Event, Options, Service, ServiceError1>,
      l1,
      lifecycle
    );

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(
      request as RequestError<Event, Options, Service, ServiceError2>,
      l2,
      lifecycle
    );

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
      request: RequestError<Event, Options, Service, ServiceError1 | ServiceError2>,
      handlerLifecycle: HandlerLifecycle,
      protectedMiddlewareLifecycle: ProtectedMiddlewareLifecycle
    ) => {
      const lifecycle = protectedMiddlewareLifecycle as PrivateMiddlewareLifecycle;

      const [l1, l2] = disconnectHandlerLifecycle(handlerLifecycle as PrivateHandlerLifecycle);

      const r1 = await c1(
        request as RequestError<Event, Options, Service, ServiceError1>,
        l1,
        lifecycle
      );

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
        r2 = await c2(
          request as RequestError<Event, Options, Service, ServiceError2>,
          l2,
          lifecycle
        );
      } else {
        r2 = fail<Err>('Skipped', { skip: true }) as unknown as Failure<Error2>;
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
    request: RequestException<Event, Options>,
    lifecycleHandler: HandlerLifecycle,
    lifecycle: MiddlewareLifecycle
  ) => {
    const [l1, l2] = disconnectHandlerLifecycle(lifecycleHandler as PrivateHandlerLifecycle);

    const r1 = await c1(request, l1, lifecycle);

    if (l1.stops()) {
      return r1;
    }

    const r2 = await c2(request, l2, lifecycle);

    return compare(r1, r2);
  };
};

export const addService = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer
>(
  request: Request<Event, Options, Service1>,
  addedService?: Service2
): Result<Service1 & Service2, never> => {
  return ok({
    ...request.service,
    ...(addedService || ({} as Service2)),
  });
};
