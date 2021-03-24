import { Err, fail, ok } from '@alexshelkov/result';

import {
  creator,
  GetError,
  GetService,
  PickService,
  Handler,
  HandlerError,
  MiddlewareCreator,
  ServiceContainer,
  ServiceOptions,
  GetEvent,
  addService,
  RequestError,
  AwsEvent,
} from '../index';

import { error1 } from '../creator';

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
  it('empty service', async () => {
    expect.assertions(1);

    // eslint-disable-next-line @typescript-eslint/ban-types
    type EmptyOptions = {};
    // eslint-disable-next-line @typescript-eslint/ban-types
    type EmptyService = {};
    type EmptyErrors = Err;

    const empty: MiddlewareCreator<EmptyOptions, EmptyService, EmptyErrors> = () => {
      return async (request) => {
        return ok(request);
      };
    };

    const res = creator(empty);

    const resOk = res.ok(async (_r) => {
      return ok(undefined);
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '',
    });
  });

  it('returns 200 and empty body for undefined', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1).opt({ op1: '1' });

    const resOk = res.ok(async (_r) => {
      return ok(undefined);
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '',
    });
  });

  it('returns 400 and empty error for undefined', async () => {
    expect.assertions(1);

    const res = creator(creatorTest2).opt({ op2: '1' });

    const resOk = res.ok(async () => {
      return fail<undefined>(undefined);
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 400,
      body: '',
    });
  });

  it('returns 200 and data for success status', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1).opt({ op1: '1' });

    const resOk = res.ok(async (_r) => {
      return ok('success');
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });

  it('returns 400 and error for error status', async () => {
    expect.assertions(1);

    const res = creator(creatorTest2).opt({ op2: '1' });

    const resOk = res.ok(async () => {
      return fail<TestError<'error'>>('error');
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
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

    const resFail = res.fail(async (request) => {
      return fail<ServiceError>(request.error.type, { code: 500 });
    });

    expect(await resFail.req()(createEvent(), createContext())).toMatchObject({
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

    await resOk.req()(createEvent(), createContext());
  });

  it('will correctly works with handler types', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1)
      .srv(creatorTest2)
      .srv(creatorTest3)
      .opt({ op1: '1', op2: '1', op3: '1' });

    type ErrorType = GetError<typeof res>;
    type ServiceType = GetService<typeof res>;

    const h1: Handler<ServiceType, string, Err> = async () => {
      return ok('success');
    };
    const e1: HandlerError<ErrorType, string, Err> = async () => {
      return fail('error');
    };

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    expect(await resFail.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });

  it('will correctly works with event and context types', async () => {
    expect.assertions(1);

    const cr: MiddlewareCreator<
    ServiceOptions,
    ServiceContainer,
    never,
    ServiceContainer,
    { event: string; context: number }
    > = () => {
      return async (request) => {
        return ok(request);
      };
    };

    const res = creator(cr)
      .srv(creatorTest1)
      .srv(creatorTest3)
      .opt({ op1: '1', op2: '1', op3: '1' });

    type ErrorType = GetError<typeof res>;
    type ServiceType = GetService<typeof res>;
    type EventType = GetEvent<typeof res>;

    const h1: Handler<ServiceType, string, Err, EventType> = async () => {
      return ok('success');
    };
    const e1: HandlerError<ErrorType, string, Err, EventType> = async () => {
      return fail('error');
    };

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    expect(await resFail.req()(createEvent('event'), createContext(42))).toMatchObject({
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

    const resOk = res.ok(async () => {
      expect(called).toStrictEqual(4);

      called += 1;

      return ok(true);
    });

    expect(called).toStrictEqual(0);

    await resOk.req()(createEvent(), createContext());

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

    const dependentMiddleware: DependentMiddleware = (_options) => {
      return async (request) => {
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
    };

    const res2 = res.srv(dependentMiddleware);

    type Deps2 = PickService<typeof res2, 'testDependent'>;

    type DependentMiddleware2 = MiddlewareCreator<
    { opDependent: string },
    { testDependent2: Deps2 },
    Err & { type: 'errDependent' },
    Deps2
    >;

    const dependentMiddleware2: DependentMiddleware2 = (_options) => {
      return async (request) => {
        if (Math.random() === -1) {
          return fail('errDependent');
        }

        return addService(request, {
          testDependent2: {
            testDependent: request.service.testDependent,
          },
        });
      };
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

    await res3Ok.req()(createEvent(), createContext());
  });

  describe('handles exceptions', () => {
    const exceptionCreator: MiddlewareCreator<
    { throwError?: boolean },
    { error: () => void },
    Err
    > = () => {
      return async (r) => {
        return ok({
          ...r,
          service: {
            ...r.service,
            error: () => {
              throw new Error('Unhandled exception in middleware');
            },
          },
        });
      };
    };

    it('default handler', async () => {
      expect.assertions(1);

      const res2 = creator(creatorTest1);

      const res2Ok = res2.ok(async () => {
        if (Math.random() !== -1) {
          throw new Error('Test error');
        }

        return ok(true);
      });

      expect(await res2Ok.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"type":"Uncaught exception: Error","message":"Test error"}}',
      });
    });

    it('raw object error', async () => {
      expect.assertions(1);

      const res3 = creator(creatorTest1);

      const res3Ok = res3.ok(async () => {
        if (Math.random() !== -1) {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw { message: 'Test message' };
        }

        return ok(true);
      });

      expect(await res3Ok.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"Uncaught exception: unknown"}}',
      });
    });

    it('exception in middleware', async () => {
      expect.assertions(2);

      const res = creator(exceptionCreator);

      const resOk = res.ok(async ({ service: { error } }) => {
        error();

        return ok(true);
      });

      const resExc = resOk.fatal(async (request) => {
        expect((request.exception as Error).message).toStrictEqual(
          'Unhandled exception in middleware',
        );

        return ok(true);
      });

      expect(await resExc.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":true}',
      });
    });

    it('exception in callback', async () => {
      expect.assertions(2);

      const res1 = creator(creatorTest1);

      const res1Ok = res1.ok(async () => {
        if (Math.random() !== -1) {
          throw new Error('Unhandled exception in callback');
        }

        return ok(true);
      });

      const res1Exc = res1Ok.fatal(async (request) => {
        expect((request.exception as Error).message).toStrictEqual(
          'Unhandled exception in callback',
        );

        return ok(false);
      });

      expect(await res1Exc.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":false}',
      });
    });
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
    > = () => {
      return async (request) => {
        const logger: Logger = {
          log: (message: string) => {
            return request.service.transport.send(
              `${new Date().toISOString().split('T')[0]}: ${message}`,
            );
          },
        };

        return addService(request, {
          logger,
        });
      };
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

    await resFail.req()(createEvent(), createContext());

    expect(error).toBeNull();
    expect(dbLogs).toContain(`${new Date().toISOString().split('T')[0]}: test message 1`);

    const res2 = creator(dbLoggerCreator).srv(loggerCreator).opt({ throwError: true });

    const handle: Handler<
    GetService<typeof res2>,
    boolean,
    number,
    GetEvent<typeof res2>
    > = async ({ service: { logger } }) => {
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

    await res2Fail.req()(createEvent(), createContext());

    expect(error).toStrictEqual('Error: DbWriteError');
    expect(dbLogs).toHaveLength(0);
  });

  describe('works with custom transform', () => {
    it('everything success', async () => {
      expect.assertions(1);

      const res = creator(creatorTest1).opt({ op1: '1' });

      const resOk = res.ok(async () => {
        return ok('success');
      });

      const resTrans = resOk.onOk(async (_r, request) => {
        return {
          statusCode: 123,
          body: `Test 1 ${request.service.test1}`,
        };
      });

      expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 123,
        body: 'Test 1 1',
      });
    });

    it('callback fail', async () => {
      expect.assertions(1);

      const res = creator(creatorTest1).opt({ op1: '1' });

      const resErr = res.ok(async () => {
        return fail<TestError<'error'>>('error');
      });

      const resTrans = resErr.onOk(async (_r, request) => {
        return {
          statusCode: 456,
          body: `Test 2 ${request.service.test1}`,
        };
      });

      expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 456,
        body: 'Test 2 1',
      });
    });

    it('middleware fail', async () => {
      expect.assertions(1);

      const res = creator(creatorTest4Error).opt({ op4: '1' });

      const resOk = res.ok(async (_r) => {
        return ok('success');
      });

      const resTrans = resOk.onFail(async () => {
        return {
          statusCode: 789,
          body: 'Test 3',
        };
      });

      expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 789,
        body: 'Test 3',
      });
    });
  });

  describe('error1', () => {
    it('will be Unknown for non-string types', async () => {
      expect.assertions(1);

      const err1 = await error1({
        error: 1,
      } as RequestError<AwsEvent, number>);

      expect(err1.err().type).toStrictEqual('Unknown');
    });

    it('will return error type for string', async () => {
      expect.assertions(1);

      const err1 = await error1({
        error: 'test',
      } as RequestError<AwsEvent, string>);

      expect(err1.err().type).toStrictEqual('test');
    });

    it('will be Unknown for non-string Err types', async () => {
      expect.assertions(1);

      const err1 = await error1({
        error: {
          type: (1 as unknown) as string,
        },
      } as RequestError<AwsEvent, Err>);

      expect(err1.err().type).toStrictEqual('Unknown');
    });
  });

  it('ensure equivalence', async () => {
    expect.assertions(3);

    const options = { op1: '1' };

    const res = creator(creatorTest1).opt(options);

    expect(res.options()).toStrictEqual(options);
    expect(res.cr()).toStrictEqual(creatorTest1);
    expect(res.md()).not.toBeUndefined();
  });

  it('ignore jest assertions', async () => {
    expect.assertions(1);

    const res = creator(creatorTest1);

    class AssertError extends Error {
      matcherResult = {};
    }

    const resOk = res.ok(async () => {
      throw new AssertError('Ignore it');
    });

    await expect(() => {
      return resOk.req()(createEvent(), createContext());
    }).rejects.toThrow('Ignore it');
  });
});
