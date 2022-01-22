import { fail, Err, ok } from 'lambda-res';
import {
  MiddlewareCreator,
  Request,
  ServiceContainer,
  AwsEvent,
  RequestError,
  MiddlewareLifecycle,
  HandlerError,
  addService,
  ServiceOptions,
} from '../index';

/* eslint-disable @typescript-eslint/require-await */

export type MiddlewareError1 = Err<'err1'>;
type MiddlewareError2 = Err<'err2'>;
type MiddlewareError3 = Err<'err3'>;
type MiddlewareError4 = Err<'err4'>;
type MiddlewareError5 = Err<'err5'>;

export type TestError<T extends string> = Err & {
  type: T;
  test: string;
};

export type MiddlewareErrors =
  | MiddlewareError1
  | MiddlewareError2
  | MiddlewareError3
  | MiddlewareError4
  | MiddlewareError5;

export const creatorTest1: MiddlewareCreator<
  { op1: string },
  { test1: string },
  MiddlewareError1
> = (_options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (Math.random() === -1) {
      return fail('err1');
    }

    return addService(request, {
      test1: '1',
    });
  };
};

export const creatorTest2: MiddlewareCreator<
  { op2: string },
  { test2: string },
  MiddlewareError2
> = (_options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (Math.random() === -1) {
      return fail('err2');
    }

    return addService(request, {
      test2: '2',
    });
  };
};

export const creatorTest3: MiddlewareCreator<
  { op3: string },
  { test3: string },
  MiddlewareError3
> = (_options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (Math.random() === -1) {
      return fail('err3');
    }

    return addService(request, {
      test3: '3',
    });
  };
};

export const creatorTest4Error: MiddlewareCreator<
  { op4: string },
  { test4: string },
  MiddlewareError4
> = (_options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (Math.random() > -1) {
      return fail('err4');
    }

    return addService(request, {
      test4: '4',
    });
  };
};

export const creatorTest5Error: MiddlewareCreator<
  { op5: string },
  { test5: string },
  MiddlewareError5
> = (_options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (Math.random() > -1) {
      return fail('err5');
    }

    return addService(request, {
      test5: '5',
    });
  };
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
export const createEvent = <Event extends AwsEvent['event']>(event: Event = {} as Event): Event => {
  return event;
};

export const createContext = <Context extends AwsEvent['context']>(
  context: Context = {} as Context
): Context => {
  return context;
};

export const createRequest = <
  Service extends ServiceContainer,
  Options extends ServiceOptions = ServiceOptions
>(
  service: Service,
  options: Options = {} as Options
): Request<AwsEvent, Options, Service> => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    event: createEvent(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    context: createContext(),
    service,
    options,
  };
};

export const createErrorRequest = <
  Service extends ServiceContainer,
  Error,
  Options extends ServiceOptions = ServiceOptions
>(
  error: Error,
  options: Options = {} as Options
): RequestError<AwsEvent, Options, Service, Error> => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    event: createEvent(),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    context: createContext(),
    error,
    service: {},
    options,
  };
};

export const createMdl = <T extends string>(
  name: T,
  steps: string[]
): MiddlewareCreator<
  {
    throwError: string;
    throwMdl: boolean;
    throwService: boolean;
    throwCreator: boolean;
    destroyThrow: boolean;
  },
  { [k in T as `${k}Throws`]: () => void },
  Err
> => {
  return (options, { throws }) => {
    if (name === options.throwError && options.throwCreator) {
      steps.push(`${name} create fail`);
      throws<Err>(name);
    }

    return async (request, { destroy }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
      const serviceFail: string = request.event?.throwError || options.throwError;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions,@typescript-eslint/no-unsafe-member-access
      const currentName = `${request.event?.name || ''}${name}`;

      if (name === serviceFail && options.destroyThrow) {
        destroy(async () => {
          steps.push(`${currentName} destroy`);

          throws<Err>(name);
        });
      }

      steps.push(`${currentName} req`);

      if (name === serviceFail && options.throwMdl) {
        steps.push(`${currentName} throws`);

        throws<Err>(name);
      }

      if (
        name === serviceFail &&
        !options.throwService &&
        !options.throwCreator &&
        !options.throwMdl &&
        !options.destroyThrow
      ) {
        steps.push(`${currentName} fail`);

        return fail(name);
      }

      return addService(request, {
        [`${name}Throws`]: () => {
          if (name === serviceFail && options.throwService) {
            steps.push(`${currentName} service fail`);
            throws<Err>(name);
          }
        },
      } as { [k in T as `${k}Throws`]: () => void });
    };
  };
};

export const createFail = <
  Service extends ServiceContainer,
  ServiceError,
  Data,
  Error,
  Event extends AwsEvent
>(
  name: string,
  steps: string[]
): HandlerError<Service, ServiceError, Data, Error, never, Event> => {
  return async (request) => {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    steps.push(`${request.event?.name || ''}${name} runs`);

    return ok(name as unknown as Data);
  };
};

export const reset = (steps: string[]): void => {
  // eslint-disable-next-line no-empty
  while (steps.pop()) {}
};
