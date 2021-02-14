import { Err, fail, ok } from '@alexshelkov/result';

import { creator, GetError, GetService, PickService } from '../creator';
import {
  Handler,
  HandlerError,
  MiddlewareCreator,
  ServiceContainer,
  ServiceOptions,
} from '../types';
import { addService } from '../utils';

import {
  creatorTest1,
  creatorTest2,
  creatorTest3,
  creatorTest4Error,
  createEvent,
  createContext,
  TestError,
} from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('creator', () => {
  it('returns 200 and data for success status', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1).opt({ op1: '1' });

    const resOk = res.ok(async (_r) => ok('success'));

    expect(await resOk.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });

  it('returns 200 and empty body for undefined', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1).opt({ op1: '1' });

    const resOk = res.ok(async (_r) => ok(undefined));

    expect(await resOk.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 200,
      body: '',
    });
  });

  it('returns 400 and error for error status', async () => {
    expect.assertions(1);

    const res = creator(creatorTest2).opt({ op2: '1' });

    const resOk = res.ok(async (_r) => fail<TestError<'error'>>('error'));

    expect(await resOk.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"error"}}',
    });
  });

  it('returns 500 for middleware with errors', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1).srv(creatorTest4Error).opt({
      op1: '1',
      op4: '1',
    });

    type ServiceError = GetError<typeof res>;

    const resFail = res.fail(async (request) =>
      fail<ServiceError>(request.error.type, { code: 500 })
    );

    expect(await resFail.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 500,
      body: '{"status":"error","error":{"type":"err4"}}',
    });
  });

  it('handler will receive services created by middleware', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1)
      .srv(creatorTest2)
      .srv(creatorTest3)
      .opt({ op1: '1', op2: '1', op3: '1' });

    const resOk = res.ok(async (request) => {
      expect(request.service).toMatchObject({
        test1: '1',
        test2: '2',
        test3: '3',
      });

      return ok('1');
    });

    await resOk.req()(createEvent(), createContext(), () => {});
  });

  it('will correctly works with handler types', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1)
      .srv(creatorTest2)
      .srv(creatorTest3)
      .opt({ op1: '1', op2: '1', op3: '1' });

    type ErrorType = GetError<typeof res>;
    type ServiceType = GetService<typeof res>;

    const h1: Handler<ServiceType, string, Err> = async (_r) => ok('success');

    const e1: HandlerError<ErrorType, string, Err> = async (_r) => fail('error');

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    expect(await resFail.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });

  it('create middleware lazily and in correct order', async () => {
    expect.assertions(7);

    let called = 0;

    const m1: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = (_options) => {
      expect(called).toStrictEqual(0);

      called += 1;

      return async (request) => {
        expect(called).toStrictEqual(2);

        called += 1;

        return ok(request);
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = (_options) => {
      expect(called).toStrictEqual(1);

      called += 1;

      return async (request) => {
        expect(called).toStrictEqual(3);

        called += 1;

        return ok(request);
      };
    };

    const res = creator(m1).srv(m2);

    const resOk = res.ok(async (_r) => {
      expect(called).toStrictEqual(4);

      called += 1;

      return ok(true);
    });

    expect(called).toStrictEqual(0);

    await resOk.req()(createEvent(), createContext(), () => {});

    expect(called).toStrictEqual(5);
  });

  it('dependent middleware works with declared dependencies', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1).srv(creatorTest2).srv(creatorTest3);

    type Deps = { test2: string; test3: string };

    type DependentMiddleware = MiddlewareCreator<
      { opDependent: string },
      { testDependent: Deps },
      Err & { type: 'errDependent' },
      Deps
    >;

    const dependentMiddleware: DependentMiddleware = (_options) => async (request) => {
      if (Math.random() === -1) {
        return fail('errDependent');
      }

      return addService(request, {
        testDependent: {
          test2: request.service.test2,
          test3: request.service.test3,
        },
      });
    };

    const res2 = res.srv(dependentMiddleware);

    type Deps2 = PickService<typeof res2, 'testDependent'>;

    type DependentMiddleware2 = MiddlewareCreator<
      { opDependent: string },
      { testDependent2: Deps2 },
      Err & { type: 'errDependent' },
      Deps2
    >;

    const dependentMiddleware2: DependentMiddleware2 = (_options) => async (request) => {
      if (Math.random() === -1) {
        return fail('errDependent');
      }

      return addService(request, {
        testDependent2: {
          testDependent: request.service.testDependent,
        },
      });
    };

    const res3 = res2.srv(dependentMiddleware2);

    const res3Ok = res3.ok(async (request) => {
      expect(request.service).toMatchObject({
        testDependent: {
          test2: '2',
          test3: '3',
        },
        testDependent2: {
          testDependent: {
            test2: '2',
            test3: '3',
          },
        },
      });

      return ok('1');
    });

    await res3Ok.req()(createEvent(), createContext(), () => {});
  });

  it('handles exceptions', async () => {
    expect.assertions(2);

    const exceptionCreator: MiddlewareCreator<
      { throwError?: boolean },
      { error: () => void },
      Err
    > = () => async (r) =>
      ok({
        ...r,
        service: {
          ...r.service,
          error: () => {
            throw new Error('Unhandled exception in middleware');
          },
        },
      });

    const res = creator(exceptionCreator);

    const resOk = res.ok(async ({ service: { error } }) => {
      error();

      return ok(true);
    });

    const resExc = resOk.unexpected(async (request) => {
      expect((request.exception as Error).message).toStrictEqual(
        'Unhandled exception in middleware'
      );

      return ok(true);
    });

    await resExc.req()(createEvent(), createContext(), () => {});

    const res1 = creator(creatorTest1);

    const res1Ok = res1.ok(async () => {
      if (Math.random() !== -1) {
        throw new Error('Unhandled exception in callback');
      }

      return ok(true);
    });

    const res1Exc = res1Ok.unexpected(async (request) => {
      expect((request.exception as Error).message).toStrictEqual('Unhandled exception in callback');

      return ok(true);
    });

    await res1Exc.req()(createEvent(), createContext(), () => {});
  });

  it('works with dummy logger', async () => {
    expect.assertions(4);

    type TransportOptions = {
      throwError?: boolean;
    };

    type Transport = {
      send: (message: string) => void;
    };

    interface DbWriteError extends Err {
      type: 'DbWriteError';
    }

    type TransportErrors = DbWriteError;

    let dbLogs: string[] = [];

    const dbLoggerCreator: MiddlewareCreator<
      TransportOptions,
      { transport: Transport },
      TransportErrors
    > = (options) => {
      dbLogs = [];

      return async (request) => {
        const transport: Transport = {
          send: (message: string) => {
            if (options.throwError) {
              throw fail<DbWriteError>('DbWriteError');
            }

            dbLogs.push(message);
          },
        };

        return addService(request, {
          transport,
        });
      };
    };

    type Logger = {
      log: (message: string) => void;
    };

    interface DummyError extends Err {
      type: 'DummyError';
    }

    type LoggerError = DummyError;

    const loggerCreator: MiddlewareCreator<
      // eslint-disable-next-line @typescript-eslint/ban-types
      {},
      { logger: Logger },
      LoggerError,
      { transport: Transport }
    > = () => async (request) => {
      const logger: Logger = {
        log: (message: string) =>
          request.service.transport.send(`${new Date().toISOString().split('T')[0]}: ${message}`),
      };

      return addService(request, {
        logger,
      });
    };

    const res = creator(dbLoggerCreator).srv(loggerCreator);

    const resOk = res.ok(async ({ service: { logger } }) => {
      logger.log('test message 1');

      return ok(true);
    });

    let error: null | 'Error: DbWriteError' | 'Error: DummyError' = null;

    const resFail = resOk.fail(async ({ error: { type } }) => {
      if (type === 'DbWriteError') {
        error = 'Error: DbWriteError';
      } else if (type === 'DummyError') {
        error = 'Error: DummyError';
      }

      return ok(true);
    });

    await resFail.req()(createEvent(), createContext(), () => {});

    expect(error).toBeNull();
    expect(dbLogs).toContain(`${new Date().toISOString().split('T')[0]}: test message 1`);

    const res2 = creator(dbLoggerCreator).srv(loggerCreator).opt({ throwError: true });

    const handle: Handler<GetService<typeof res2>, boolean, number> = async ({
      service: { logger },
    }) => {
      logger.log('test message 2');

      return ok(true);
    };

    const res2Ok = res2.ok(handle);

    const res2Fail = res2Ok.fail(async ({ error: { type } }) => {
      if (type === 'DbWriteError') {
        error = 'Error: DbWriteError';
      } else if (type === 'DummyError') {
        error = 'Error: DummyError';
      }

      return ok(true);
    });

    await res2Fail.req()(createEvent(), createContext(), () => {});

    expect(error).toStrictEqual('Error: DbWriteError');
    expect(dbLogs).toHaveLength(0);
  });
});
