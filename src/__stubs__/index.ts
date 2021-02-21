import { fail, Err } from '@alexshelkov/result';
import { MiddlewareCreator, Request, ServiceContainer, AwsEvent, AwsContext } from '../types';
import { addService } from '../utils';

type MiddlewareError1 = Err & { type: 'err1' };
type MiddlewareError2 = Err & { type: 'err2' };
type MiddlewareError3 = Err & { type: 'err3' };
type MiddlewareError4 = Err & { type: 'err4' };
type MiddlewareError5 = Err & { type: 'err5' };

export type TestError<T extends string> = Err & {
  type: T;
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
> = (_options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (Math.random() === -1) {
      return fail('err1');
    }

    return addService(request, {
      test1: '1',
    });
  };

export const creatorTest2: MiddlewareCreator<
  { op2: string },
  { test2: string },
  MiddlewareError2
> = (_options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (Math.random() === -1) {
      return fail('err2');
    }

    return addService(request, {
      test2: '2',
    });
  };

export const creatorTest3: MiddlewareCreator<
  { op3: string },
  { test3: string },
  MiddlewareError3
> = (_options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (Math.random() === -1) {
      return fail('err3');
    }

    return addService(request, {
      test3: '3',
    });
  };

export const creatorTest4Error: MiddlewareCreator<
  { op4: string },
  { test4: string },
  MiddlewareError4
> = (_options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (Math.random() > -1) {
      return fail('err4');
    }

    return addService(request, {
      test4: '4',
    });
  };

export const creatorTest5Error: MiddlewareCreator<
  { op5: string },
  { test5: string },
  MiddlewareError5
> = (_options) =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (Math.random() > -1) {
      return fail('err5');
    }

    return addService(request, {
      test5: '5',
    });
  };

export const createEvent = (event: AwsEvent = {}): AwsEvent => event;

export const createContext = (): AwsContext => ({} as AwsContext);

export const createRequest = <S extends ServiceContainer>(s: S): Request<S> => ({
  event: createEvent(),
  context: createContext(),
  service: s,
});
