import { compare, ok, Success } from '@alexshelkov/result';

import {
  Handler,
  HandlerError,
  HandlerException,
  MiddlewareEvents,
  MiddlewareLifecycle,
  MiddlewareCreator,
  Request,
  RequestError,
  RequestException,
  ServiceContainer,
  ServiceOptions,
  AwsEvent,
} from './types';

export const connectLifecycles = (
  lifecycle: MiddlewareLifecycle
): [MiddlewareLifecycle, MiddlewareLifecycle] => {
  const e1: MiddlewareEvents = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async destroy() {},
  };

  const e2: MiddlewareEvents = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async destroy() {},
  };

  lifecycle.destroy(async () => {
    await e2.destroy();
    await e1.destroy();
  });

  const l1: MiddlewareLifecycle = {
    destroy(cb) {
      e1.destroy = cb;
    },
  };

  const l2: MiddlewareLifecycle = {
    destroy(cb) {
      e2.destroy = cb;
    },
  };

  return [l1, l2];
};

export const connect = <
  Event extends AwsEvent,
  Options1 extends ServiceOptions,
  Service1 extends ServiceContainer,
  Error1
>(
  c1: MiddlewareCreator<Options1, Service1, Error1, ServiceContainer, Event>
) => {
  return <Options2 extends ServiceOptions, Service2 extends ServiceContainer, Error2>(
    c2: MiddlewareCreator<Options2, Service2, Error2, Service1, Event>
  ): MiddlewareCreator<
    Options1 & Options2,
    Service1 & Service2,
    Error1 | Error2,
    ServiceContainer,
    Event
  > => {
    return (options) => {
      const m1 = c1(options);
      const m2 = c2(options);

      return async (request, lifecycle) => {
        const [l1, l2] = connectLifecycles(lifecycle);

        const r1 = await m1(request, l1);

        if (r1.isOk()) {
          return m2<typeof r1.data.service>(r1.data, l2);
        }

        return r1;
      };
    };
  };
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
  return async (request: Request<Event, Service1 & Service2>, options: Partial<Options>) => {
    const r1 = await c1(request, options);
    const r2 = await c2(request, options);

    return compare(r1, r2);
  };
};

export const joinFailure = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  ServiceError1,
  ServiceError2,
  Data1,
  Error1,
  Data2,
  Error2
>(
  c1: HandlerError<ServiceError1, Data1, Error1, Event, Options>,
  c2: HandlerError<ServiceError2, Data2, Error2, Event, Options>
): HandlerError<ServiceError1 | ServiceError2, Data1 | Data2, Error1 | Error2, Event, Options> => {
  return async (
    request: RequestError<Event, ServiceError1 | ServiceError2>,
    options: Partial<Options>
  ) => {
    const r1 = await c1(request as RequestError<Event, ServiceError1>, options);
    const r2 = await c2(request as RequestError<Event, ServiceError2>, options);

    return compare(r1, r2);
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
  return async (request: RequestException<Event>, options: Partial<Options>) => {
    const r1 = await c1(request, options);
    const r2 = await c2(request, options);

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
