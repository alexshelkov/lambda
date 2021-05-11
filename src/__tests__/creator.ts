import { Err, fail, ok } from 'lambda-res';

import {
  GetEvent,
  GetOpt,
  GetService,
  GetError,
  GetHandler,
  GetHandlerError,
  GetHandlerException,
  GetTransform,
  GetTransformFailure,
  PickService,
  Handler,
  HandlerError,
  MiddlewareCreator,
  ServiceContainer,
  ServiceOptions,
  RequestError,
  AwsEvent,
  GetOptionMdl,
  GetServiceMdl,
  GetErrorMdl,
  GetDepsMdl,
  GetEventMdl,
  Request,
  creator,
  addService,
  raw,
  json,
  resetFallBackTransform,
  createHandlerLifecycle,
  createLifecycle,
  Transform,
  TransformError,
  Middleware,
  GetTransformException,
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

describe('creator base', () => {
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

  it('create middleware only once', async () => {
    expect.assertions(3);

    let created = 0;
    let destroyed = 0;
    let requests = 0;

    const m1: MiddlewareCreator<ServiceOptions, { test1: string }, never> = (_o) => {
      created += 1;

      return async (r, lc) => {
        lc.destroy(async () => {
          destroyed += 1;
        });

        requests += 1;

        return addService(r, {
          test1: '1',
        });
      };
    };
    const res = creator(m1).ok(async ({ service: { test1 } }) => {
      return ok(test1);
    });

    const req = res.req();

    await req(createEvent(), createContext());
    await req(createEvent(), createContext());

    await req(createEvent(), createContext());

    expect(created).toStrictEqual(1);
    expect(destroyed).toStrictEqual(3);
    expect(requests).toStrictEqual(3);
  });

  describe('error1', () => {
    it('will be Unknown for non-string types', async () => {
      expect.assertions(1);

      const err1 = await error1(
        {
          error: 1,
        } as RequestError<AwsEvent, number>,
        {},
        createHandlerLifecycle(),
        createLifecycle()
      );

      expect(err1.err().type).toStrictEqual('Unknown');
    });

    it('will return error type for string', async () => {
      expect.assertions(1);

      const err1 = await error1(
        {
          error: 'test',
        } as RequestError<AwsEvent, string>,
        {},
        createHandlerLifecycle(),
        createLifecycle()
      );

      expect(err1.err().type).toStrictEqual('test');
    });

    it('will be Unknown for non-string Err types', async () => {
      expect.assertions(1);

      const err1 = await error1(
        {
          error: {
            type: (1 as unknown) as string,
          },
        } as RequestError<AwsEvent, Err>,
        {},
        createHandlerLifecycle(),
        createLifecycle()
      );

      expect(err1.err().type).toStrictEqual('Unknown');
    });
  });

  it('ensure equivalence', async () => {
    expect.assertions(2);

    const options = { op1: '1' };

    const res = creator(creatorTest1).opt(options);

    expect(res.options()).toStrictEqual(options);
    expect(res.cr()).toStrictEqual(creatorTest1);
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

describe('create middleware lazily and in correct order', () => {
  it('ok handlers order', async () => {
    expect.assertions(2);

    const steps: string[] = [];

    steps.push('start');

    const m1: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m1 created');

      return async (request) => {
        steps.push('m1 request');

        return ok(request);
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m2 created');

      return async (request) => {
        steps.push('m2 request');

        return ok(request);
      };
    };

    const res = creator(m1).srv(m2);

    const resOk = res
      .ok(async () => {
        steps.push('ok1');

        return ok(true);
      })
      .ok(async () => {
        steps.push('ok2');

        return ok(true);
      });

    expect(steps).toStrictEqual(['start']);

    await resOk.req()(createEvent(), createContext());

    expect(steps).toStrictEqual([
      'start',
      'm1 created',
      'm2 created',
      'm1 request',
      'm2 request',
      'ok1',
      'ok2',
    ]);
  });

  it('fail handlers order', async () => {
    expect.assertions(2);

    const steps = ['start'];

    const m1: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m1 created');

      return async (request) => {
        steps.push('m1 request');

        return ok(request);
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m2 created');

      return async () => {
        steps.push('m2 request');

        return fail('Err');
      };
    };

    const res = creator(m1).srv(m2);

    const resOk = res
      .fail(async () => {
        steps.push('fail1');

        return ok(true);
      })
      .fail(async () => {
        steps.push('fail2');

        return ok(true);
      });

    expect(steps).toStrictEqual(['start']);

    await resOk.req()(createEvent(), createContext());

    expect(steps).toStrictEqual([
      'start',
      'm1 created',
      'm2 created',
      'm1 request',
      'm2 request',
      'fail1',
      'fail2',
    ]);
  });

  it('fatal handlers order', async () => {
    expect.assertions(2);

    const steps = ['start'];

    const m1: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m1 created');

      return async (request) => {
        steps.push('m1 request');

        return ok(request);
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m2 created');

      return async (request) => {
        steps.push('m2 request');

        if (Math.random() > -1) {
          throw new Error('Fatal error');
        }

        return ok(request);
      };
    };

    const res = creator(m1).srv(m2);

    const resOk = res
      .fatal(async () => {
        steps.push('fatal1');

        return ok(true);
      })
      .fatal(async () => {
        steps.push('fatal2');

        return ok(true);
      });

    expect(steps).toStrictEqual(['start']);

    await resOk.req()(createEvent(), createContext());

    expect(steps).toStrictEqual([
      'start',
      'm1 created',
      'm2 created',
      'm1 request',
      'm2 request',
      'fatal1',
      'fatal2',
    ]);
  });
});

describe('creator types correctness', () => {
  it('will correctly works with handler types', async () => {
    expect.assertions(2);

    const e1GetMdl: GetHandlerError<typeof creatorTest1, string, Err> = async () => {
      return fail('error');
    };

    const res = creator(creatorTest1).fail(e1GetMdl).srv(creatorTest2).srv(creatorTest3);

    type ErrorType = GetError<typeof res>;
    type ServiceType = GetService<typeof res>;

    const h1: Handler<ServiceType, string, Err> = async () => {
      return ok('success');
    };

    const h1GetCrt: GetHandler<typeof res, string, number> = async () => {
      return ok('success');
    };

    const h1GetMdl: GetHandler<typeof creatorTest1, string, number> = async () => {
      return ok('success');
    };

    const e1: HandlerError<ErrorType, string, Err> = async () => {
      return fail('error');
    };

    const e1GetCrt: GetHandlerError<typeof res, string, Err> = async () => {
      return fail('error');
    };

    const resOk1 = res.ok(h1).ok(h1GetCrt).ok(h1GetMdl);
    const resFail1 = resOk1.fail(e1).fail(e1GetCrt);

    expect(await resFail1.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });

    const h2: GetHandler<typeof res, string, number> = async () => {
      return ok('success');
    };
    const e2: GetHandlerError<typeof res, string, Err> = async () => {
      return fail('error');
    };
    const f2: GetHandlerException<typeof res, string, Err> = async () => {
      return fail('error');
    };

    const resOk2 = res.ok(h2);
    const resFail2 = resOk2.fail(e2);
    const resFatal2 = resFail2.fatal(f2);

    expect(await resFatal2.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });

  it('infer types from middleware', async () => {
    expect.assertions(1);

    type InferMiddleware = MiddlewareCreator<
      { op1: string },
      { srv1: string },
      Err<'errInfer'>,
      { dep1: number }
    >;

    const dep1: MiddlewareCreator<ServiceOptions, GetDepsMdl<InferMiddleware>, Err> = () => {
      return async (request) => {
        return addService(request, {
          dep1: 1,
        });
      };
    };

    const inferMiddleware: InferMiddleware = (_o: Partial<GetOptionMdl<InferMiddleware>>) => {
      return async (request) => {
        return addService(request, {
          srv1: '1',
        });
      };
    };

    type InferredEvent = GetEventMdl<InferMiddleware>;
    type InferredService = GetServiceMdl<InferMiddleware> & GetServiceMdl<typeof dep1>;

    const res = creator(dep1)
      .srv(inferMiddleware)
      .ok(async (_r: Request<InferredEvent, InferredService>) => {
        return ok('success');
      });

    type InferredError = GetErrorMdl<InferMiddleware> | GetErrorMdl<typeof dep1>;

    const resErr = res.fail(async (_r: RequestError<InferredEvent, InferredError>) => {
      return ok('error');
    });

    expect(await resErr.req()(createEvent(), createContext())).toMatchObject({
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

    const res = creator(cr).srv(creatorTest1).srv(creatorTest3).opt({ op1: '1', op3: '1' }).opt({});

    type ErrorType = GetError<typeof res>;
    type ServiceType = GetService<typeof res>;
    type EventType = GetEvent<typeof res>;
    type ServiceOpt = GetOpt<typeof res>;

    const h1: Handler<ServiceType, string, Err, EventType, ServiceOpt> = async () => {
      return ok('success');
    };
    const e1: HandlerError<ErrorType, string, Err, never, EventType, ServiceOpt> = async () => {
      return fail('error');
    };

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    expect(await resFail.req()(createEvent('event'), createContext(42))).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });

  it('fail handler may exclude errors', async () => {
    expect.assertions(1);

    const f1: GetHandlerError<
      typeof creatorTest4Error,
      string,
      never,
      GetError<typeof creatorTest4Error>
    > = async (_r, _o, { returns }) => {
      returns(() => {
        return true;
      });

      return ok('f1');
    };

    const f2: GetHandlerError<
      typeof creatorTest1,
      string,
      never,
      GetError<typeof creatorTest1>
    > = async (_r, _o, { returns }) => {
      returns(() => {
        return true;
      });

      return ok('f2');
    };

    const res = creator(creatorTest4Error)
      .fail(f1)
      .srv(creatorTest1)
      .fail(f2)
      .srv(creatorTest2)
      .fail(async (request) => {
        const err = request.error;

        // eslint-disable-next-line prefer-destructuring
        const type: 'err2' = err.type;

        return ok(type);
      });

    expect(await res.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"f1"}',
    });
  });

  it('dependent middleware works with declared dependencies', async () => {
    expect.assertions(3);

    const res1 = creator(creatorTest1).srv(creatorTest2).srv(creatorTest3);

    type Deps1 = { test2: string; test3: string };

    type DependentMiddleware = MiddlewareCreator<
      ServiceOptions,
      { testDependent1: Deps1 },
      Err<'errDependent'>,
      Deps1
    >;

    const dependentMiddleware1: DependentMiddleware = (_options) => {
      return async (request) => {
        if (Math.random() === -1) {
          return fail('errDependent');
        }

        return addService(request, {
          testDependent1: {
            test2: request.service.test2,
            test3: request.service.test3,
          },
        });
      };
    };

    const res1dep = res1.srv(dependentMiddleware1);

    type Deps2 = PickService<typeof res1dep, 'testDependent1'>;

    type DependentMiddleware2 = MiddlewareCreator<
      ServiceOptions,
      { testDependent2: Deps2 },
      Err<'errDependent'>,
      Deps2
    >;

    const dependentMiddleware2: DependentMiddleware2 = (_options) => {
      return async (request) => {
        if (Math.random() === -1) {
          return fail('errDependent');
        }

        return addService(request, {
          testDependent2: {
            testDependent1: request.service.testDependent1,
          },
        });
      };
    };

    const res2dep = res1dep.srv(dependentMiddleware2);

    const res2Ok = res2dep.ok(async (request) => {
      expect(request.service).toMatchObject({
        testDependent1: {
          test2: '2',
          test3: '3',
        },
        testDependent2: {
          testDependent1: {
            test2: '2',
            test3: '3',
          },
        },
      });

      return ok('1');
    });

    await res2Ok.req()(createEvent(), createContext());

    type Deps3 = { test2: string } | { test3: string };

    type DependentMiddleware3 = MiddlewareCreator<
      ServiceOptions,
      { testDependent3: Deps3 },
      Err<'errDependent'>,
      Deps3
    >;

    const dependentMiddleware3: DependentMiddleware3 = (_options) => {
      return async (request) => {
        if (Math.random() === -1) {
          return fail('errDependent');
        }

        if ('test2' in request.service) {
          return addService(request, {
            testDependent3: {
              test2: request.service.test2,
            },
          });
        }
        if ('test3' in request.service) {
          return addService(request, {
            testDependent3: {
              test3: request.service.test3,
            },
          });
        }

        // also typesafe, may replace 2 returns above
        return addService(request, {
          testDependent3: request.service,
        });
      };
    };

    const res3 = creator(creatorTest2).srv(dependentMiddleware3);

    const res3Ok = res3.ok(async (request) => {
      expect(request.service).toMatchObject({
        testDependent3: {
          test2: '2',
        },
      });

      return ok('1');
    });

    await res3Ok.req()(createEvent(), createContext());

    const res4 = creator(creatorTest3).srv(dependentMiddleware3);

    const res4Ok = res4.ok(async (request) => {
      expect(request.service).toMatchObject({
        testDependent3: {
          test3: '3',
        },
      });

      return ok('1');
    });

    await res4Ok.req()(createEvent(), createContext());
  });

  it('allow create option based services', async () => {
    expect.assertions(2);

    const definedEnvs: Record<string, string> = {};

    const cr1: MiddlewareCreator<ServiceOptions, ServiceContainer, never> = () => {
      return async (request) => {
        return ok(request);
      };
    };

    const cr2: MiddlewareCreator<
      ServiceOptions,
      ServiceContainer,
      never,
      { appEnvs: { env2: string } }
    > = () => {
      return async (request) => {
        return ok(request);
      };
    };

    type Opts = { envs: readonly string[] };
    type Serv<O> = O extends { envs: infer X }
      ? X extends readonly string[]
        ? { [k in X[number]]: string }
        : never
      : unknown;
    type EnvError = Err<'EnvError', { name: string }>;

    const inferServices = <O extends Opts>(
      options: Partial<O>
    ): Middleware<{ appEnvs: Serv<O> }, EnvError> => {
      return async <Service1 extends ServiceContainer>(request: Request<AwsEvent, Service1>) => {
        const { envs } = options;

        const service: Record<string, string> = {};

        if (envs) {
          // eslint-disable-next-line no-restricted-syntax
          for (const name of envs) {
            const definedEnv = definedEnvs[name];
            if (definedEnv) {
              service[name] = definedEnv;
            } else {
              return fail<EnvError>('EnvError', { name });
            }
          }
        }

        return addService(request, {
          appEnvs: service as Serv<O>,
        });
      };
    };

    definedEnvs.env1 = 'env1=1';
    definedEnvs.env2 = 'env2=2';

    const opt = { envs: ['env1', 'env2'] as const };

    const res = creator(cr1).opt(opt).srv(inferServices).srv(cr2).on(raw);

    const resOk = res.ok(
      async ({
        service: {
          appEnvs: { env1, env2 },
        },
      }) => {
        return ok(`ok ${env1} ${env2}`);
      }
    );

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      status: 'success',
      data: 'ok env1=1 env2=2',
    });

    delete definedEnvs.env2;

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      status: 'error',
      error: {
        type: 'EnvError',
        name: 'env2',
      },
    });
  });
});

describe('creator handlers and transforms', () => {
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

  describe('returns lifecycle stops handlers', () => {
    it('works with ok handler', async () => {
      expect.assertions(4);

      const res = creator(creatorTest1);

      let okCalls = 0;

      const resOk = res
        .ok(async () => {
          okCalls += 1;
          return ok('1');
        })
        .ok(async (_r, _s, { returns }) => {
          returns(() => {
            return true;
          });
          okCalls += 1;
          return ok('2');
        })
        .ok(async () => {
          okCalls += 1;
          return ok('3');
        });

      expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"2"}',
      });

      expect(okCalls).toStrictEqual(2);

      const resOk2 = res
        .ok(async (_r, _s, { returns }) => {
          returns(() => {
            return true;
          });
          okCalls += 1;
          return ok('1');
        })
        .ok(async () => {
          okCalls += 1;
          return ok('2');
        });

      expect(await resOk2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"1"}',
      });

      expect(okCalls).toStrictEqual(3);
    });

    it('works with fail handler', async () => {
      expect.assertions(4);

      const res = creator(creatorTest4Error);

      let failCalls = 0;

      const resErr = res
        .fail(async () => {
          failCalls += 1;
          return ok('1');
        })
        .fail(async (_e, _s, { returns }) => {
          returns(() => {
            return true;
          });
          failCalls += 1;
          return ok('2');
        })
        .fail(async () => {
          failCalls += 1;
          return ok('3');
        });

      expect(await resErr.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"2"}',
      });

      expect(failCalls).toStrictEqual(2);

      const resFail2 = res
        .fail(async (_e, _s, { returns }) => {
          returns(() => {
            return true;
          });
          failCalls += 1;
          return ok('1');
        })
        .fail(async () => {
          failCalls += 1;
          return ok('2');
        })
        .fail(async () => {
          failCalls += 1;
          return ok('3');
        });

      expect(await resFail2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"1"}',
      });

      expect(failCalls).toStrictEqual(3);
    });

    it('works with fatal handler', async () => {
      expect.assertions(4);

      const creatorFatal: MiddlewareCreator<ServiceOptions, ServiceContainer, never> = () => {
        return async (request) => {
          if (Math.random() > -1) {
            throw new Error('Uncaught error');
          }

          return ok(request);
        };
      };

      const res = creator(creatorFatal);

      let fatal = 0;

      const resErr = res
        .fatal(async () => {
          fatal += 1;
          return ok('1');
        })
        .fatal(async (_e, _s, { returns }) => {
          returns(() => {
            return true;
          });
          fatal += 1;
          return ok('2');
        })
        .fatal(async () => {
          fatal += 1;
          return ok('3');
        });

      expect(await resErr.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"2"}',
      });

      expect(fatal).toStrictEqual(2);

      const resFail2 = res
        .fatal(async (_e, _s, { returns }) => {
          returns(() => {
            return true;
          });
          fatal += 1;
          return ok('1');
        })
        .fatal(async () => {
          fatal += 1;
          return ok('2');
        });

      expect(await resFail2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"1"}',
      });

      expect(fatal).toStrictEqual(3);
    });
  });

  it('lifecycles called in the right order', async () => {
    expect.assertions(10);

    let step = 'start';

    const m1: MiddlewareCreator<ServiceOptions, { test1: string }, never> = () => {
      expect(step).toStrictEqual('start');

      step = 'm1 created';

      return async (r, lc) => {
        lc.destroy(async () => {
          expect(step).toStrictEqual('m2 destroyed');

          step = 'm1 destroyed';
        });

        expect(step).toStrictEqual('m2 created');

        step = 'm1 request';

        return addService(r, {
          test1: '1',
        });
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, { test2: string }, never> = () => {
      expect(step).toStrictEqual('m1 created');

      step = 'm2 created';

      return async (r, lc) => {
        lc.destroy(async () => {
          expect(step).toStrictEqual('ok1');

          step = 'm2 destroyed';
        });

        expect(step).toStrictEqual('m1 request');

        step = 'm2 request';

        return addService(r, {
          test2: '2',
        });
      };
    };

    const res = creator(m1)
      .srv(m2)
      .ok(async ({ service: { test1, test2 } }) => {
        expect(step).toStrictEqual('m2 request');

        step = 'ok1';

        return ok(`${test1} & ${test2}`);
      });

    expect(step).toStrictEqual('start');

    expect(await res.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"1 & 2"}',
    });

    expect(step).toStrictEqual('m1 destroyed');
  });

  it('lifecycles may be called in parallel', async () => {
    expect.assertions(7);

    let destroyed = 0;
    let requests = 0;
    let creates = 0;

    const wait = (w: number) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(w);
        }, w);
      });
    };

    const m0: MiddlewareCreator<ServiceOptions, { test0: () => string }, never> = () => {
      return async (request) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const e = request.event.e as number;

        return addService(request, {
          test0: () => {
            return `test0: ${e}`;
          },
        });
      };
    };

    const m1: MiddlewareCreator<
      ServiceOptions,
      { test1: string },
      never,
      { test0: () => string }
    > = () => {
      return async (request, lc) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const e = request.event.e as number;

        lc.destroy(async () => {
          destroyed += 1;
          expect(request.service.test0()).toStrictEqual(`test0: ${e}`);
        });

        if (e === 1) {
          await wait(1350);
        }

        creates += 1;

        return addService(request, {
          test1: '1',
        });
      };
    };

    const res = creator(m0)
      .srv(m1)
      .ok(async ({ event, service: { test1 } }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const e = event.e as number;

        if (e === 1) {
          await wait(1250);
        }

        requests += 1;

        return ok(test1);
      });

    const req = res.req();

    await Promise.all([
      req(createEvent({ e: 1 }), createContext()),
      req(createEvent({ e: 2 }), createContext()),
      req(createEvent({ e: 3 }), createContext()),
      req(createEvent({ e: 4 }), createContext()),
    ]);

    expect(creates).toStrictEqual(4);
    expect(destroyed).toStrictEqual(4);
    expect(requests).toStrictEqual(4);
  });

  describe('works with custom transform', () => {
    it('everything success', async () => {
      expect.assertions(5);

      const res = creator(creatorTest1).opt({ op1: '1' });

      const resOk = res.ok(async () => {
        if (Math.random() < 0) {
          return fail<TestError<'error'>>('error');
        }

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

      const trans1: Transform<string, unknown, unknown> = async () => {
        return 'Test 2';
      };

      expect(await resOk.onOk(trans1).req()(createEvent(), createContext())).toStrictEqual(
        'Test 2'
      );

      const trans2: GetTransform<typeof resOk, string> = async (result, request) => {
        return `Test 3 ${result.ok()} ${request.service.test1}`;
      };

      const resTrans2 = resTrans.onOkRes(trans2);

      expect(await resTrans2.req()(createEvent(), createContext())).toStrictEqual(
        'Test 3 success 1'
      );

      const trans3: GetTransform<typeof creatorTest1, string> = async (result, request) => {
        return `Test 4 ${request.service.test1}`;
      };

      expect(await resTrans2.onOkRes(trans3).req()(createEvent(), createContext())).toStrictEqual(
        'Test 4 1'
      );

      const resOk2 = resTrans2.ok(async () => {
        return ok('success2');
      });

      expect(await resOk2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 123,
        body: 'Test 1 1',
      });
    });

    it('callback fail', async () => {
      expect.assertions(2);

      const res = creator(creatorTest1).opt({ op1: '1' });

      const resErr = res.ok(async () => {
        return fail<TestError<'error'>>('error');
      });

      const resTrans = resErr.onOk(async (_r, request) => {
        return {
          statusCode: 456,
          body: `Test 1 ${request.service.test1}`,
        };
      });

      expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 456,
        body: 'Test 1 1',
      });

      const trans1: Transform<string, unknown, unknown> = async () => {
        return 'Test 1';
      };

      expect(await resErr.onOk(trans1).req()(createEvent(), createContext())).toStrictEqual(
        'Test 1'
      );
    });

    it('middleware fail', async () => {
      expect.assertions(5);

      const res = creator(creatorTest4Error).opt({ op4: '1' });

      const resFail = res.fail(async (_r) => {
        if (Math.random() < 0) {
          return fail<TestError<'error'>>('error');
        }

        return ok('fail');
      });

      const resTrans = resFail.onFail(async () => {
        return {
          statusCode: 789,
          body: 'Test 1',
        };
      });

      expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 789,
        body: 'Test 1',
      });

      const trans1: TransformError<string, unknown, unknown> = async () => {
        return `Test 2`;
      };

      expect(await resFail.onFail(trans1).req()(createEvent(), createContext())).toStrictEqual(
        'Test 2'
      );

      const trans2: GetTransformFailure<typeof resFail, string> = async (result) => {
        return `Test ${result.ok()} 3`;
      };

      const restTrans2 = resTrans.onFailRes(trans2);

      expect(await restTrans2.req()(createEvent(), createContext())).toStrictEqual('Test fail 3');

      const trans3: GetTransformFailure<typeof creatorTest4Error, string> = async () => {
        return `Test 4`;
      };

      expect(await resFail.onFailRes(trans3).req()(createEvent(), createContext())).toStrictEqual(
        'Test 4'
      );

      const resFail2 = restTrans2.fail(async () => {
        return ok('fail2');
      });

      expect(await resFail2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 789,
        body: 'Test 1',
      });
    });

    it('fatal errors', async () => {
      expect.assertions(5);

      const res = creator(creatorTest1).ok(async () => {
        if (Math.random() > 0) {
          throw new Error('Unhandled error');
        }

        return ok(false);
      });

      const resFatal = res.fatal(async (_r) => {
        if (Math.random() < 0) {
          return fail<Err>('1');
        }

        return ok('fatal');
      });

      const resTrans = resFatal.onFatal(async () => {
        return {
          statusCode: 789,
          body: 'Test 1',
        };
      });

      expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 789,
        body: 'Test 1',
      });

      const trans1: TransformError<string, unknown, unknown> = async () => {
        return `Test 2`;
      };

      expect(await resFatal.onFatal(trans1).req()(createEvent(), createContext())).toStrictEqual(
        'Test 2'
      );

      const trans2: GetTransformException<typeof resFatal, string> = async (result) => {
        return `Test ${result.ok()} 3`;
      };

      const resTrans2 = resTrans.onFatalRes(trans2);

      expect(await resTrans2.req()(createEvent(), createContext())).toStrictEqual('Test fatal 3');

      const trans3: GetTransformException<typeof creatorTest1, string> = async () => {
        return `Test 4`;
      };

      expect(await resFatal.onFatalRes(trans3).req()(createEvent(), createContext())).toStrictEqual(
        'Test 4'
      );

      const resFatal2 = resTrans2.fatal(async () => {
        return ok('fatal2');
      });

      expect(await resFatal2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 789,
        body: 'Test 1',
      });
    });
  });
});

describe('creator exceptions', () => {
  describe('handles exceptions', () => {
    type CreationError = Err<'CreationError'>;
    type RequestError = Err<'RequestError'>;
    type ExceptionCreatorErrors = CreationError | RequestError;

    const exceptionCreator: MiddlewareCreator<
      { throwCreatorError?: number },
      { error: () => void },
      ExceptionCreatorErrors
    > = (options, lc) => {
      if (options.throwCreatorError === -1) {
        throw fail<CreationError>('CreationError');
      } else if (options.throwCreatorError === 1) {
        lc.throws<CreationError>('CreationError');
      } else if (options.throwCreatorError === 2) {
        throw new Error('Unhandled exception in creator');
      } else if (options.throwCreatorError === 3) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw { error: true };
      }

      return async (r) => {
        if (options.throwCreatorError === -2) {
          throw fail<RequestError>('RequestError');
        } else if (options.throwCreatorError === 4) {
          lc.throws<RequestError>('RequestError');
        }

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
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Test error"}}',
      });
    });

    it('raw object error', async () => {
      expect.assertions(1);

      const res = creator(creatorTest1);

      const resOk = res.ok(async () => {
        if (Math.random() !== -1) {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw { message: 'Test message' };
        }

        return ok(true);
      });

      expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"UncaughtError"}}',
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
          'Unhandled exception in middleware'
        );

        return ok(true);
      });

      expect(await resExc.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":true}',
      });
    });

    it('exception in creator', async () => {
      expect.assertions(5);

      const res = creator(exceptionCreator);

      expect(
        await res.opt({ throwCreatorError: -1 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"FailureException","type":"UncaughtError","message":"CreationError"}}',
      });

      expect(
        await res.opt({ throwCreatorError: 1 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"CreationError"}}',
      });

      expect(
        await res
          .opt({ throwCreatorError: 1 })
          .fail(async () => {
            throw new Error('Double error');
          })
          .req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Double error"}}',
      });

      expect(
        await res.opt({ throwCreatorError: 2 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Unhandled exception in creator"}}',
      });

      expect(
        await res.opt({ throwCreatorError: 3 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"UncaughtError"}}',
      });
    });

    it('failure exception in middleware', async () => {
      expect.assertions(3);

      const res = creator(exceptionCreator);

      expect(
        await res.opt({ throwCreatorError: 4 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"RequestError"}}',
      });

      expect(
        await res.opt({ throwCreatorError: -2 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"FailureException","type":"UncaughtError","message":"RequestError"}}',
      });

      const res1 = res.fail(async () => {
        if (Math.random() > -1) {
          throw new Error('Unhandled double error');
        }
        return ok('f1');
      });

      expect(
        await res1.opt({ throwCreatorError: 4 }).req()(createEvent(), createContext())
      ).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Unhandled double error"}}',
      });
    });

    it('exception in callback', async () => {
      expect.assertions(4);

      const res1 = creator(creatorTest1);

      const res1Ok = res1.ok(async () => {
        if (Math.random() > -1) {
          throw new Error('Unhandled exception in callback');
        }
        return ok(true);
      });

      const res1Exc = res1Ok.fatal(async (request) => {
        expect((request.exception as Error).message).toStrictEqual(
          'Unhandled exception in callback'
        );

        return ok(false);
      });

      expect(await res1Exc.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":false}',
      });

      const res2Ok = res1.ok(async () => {
        if (Math.random() > -1) {
          throw fail<Err>('UnhandledFailure');
        }
        return ok(true);
      });

      const res2Exc = res2Ok.fatal(async (request) => {
        expect((request.exception as Error).message).toStrictEqual('UnhandledFailure');

        return ok(false);
      });

      expect(await res2Exc.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":false}',
      });
    });

    it('exception in fatal handler', async () => {
      expect.assertions(2);

      const res = creator(creatorTest1);

      const resOk = res.ok(async () => {
        if (Math.random() !== -1) {
          throw new Error('Unhandled exception in callback');
        }

        return ok(true);
      });

      const resExc = resOk.fatal(async () => {
        if (Math.random() !== -1) {
          throw new Error('Unhandled exception in callback');
        }

        return ok(false);
      });

      const resExc1 = resOk.fatal(async () => {
        if (Math.random() !== -1) {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw { error: true };
        }

        return ok(false);
      });

      expect(await resExc.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Unhandled exception in callback"}}',
      });

      expect(await resExc1.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"UncaughtError"}}',
      });
    });
  });

  it('handle fatal exception in exception transform', async () => {
    expect.assertions(2);

    resetFallBackTransform(raw);

    const res = creator(creatorTest1)
      .ok(async () => {
        throw new Error('Fatal error');
      })
      .onOk(raw)
      .onFail(raw)
      .onFatal(raw);

    const resTrans = res.onFatal(() => {
      throw new Error('Double fatal error');
    });

    const resTrans1 = res.onFatal(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw { error: true };
    });

    expect(await resTrans.req()(createEvent(), createContext())).toMatchObject({
      status: 'error',
      error: {
        type: 'UncaughtTransformError',
        cause: 'Error',
        message: 'Double fatal error',
      },
    });

    expect(await resTrans1.req()(createEvent(), createContext())).toMatchObject({
      status: 'error',
      error: {
        type: 'UncaughtTransformError',
        cause: 'Unknown',
      },
    });

    resetFallBackTransform(json);
  });

  describe('handle failure and exceptions in lifecycle', () => {
    type DestroyError = Err<'ImpossibleToDestroy'>;
    type CreateError = Err<'ImpossibleToCreate'>;
    type MiddlewareErrors = DestroyError | CreateError;

    const m1: MiddlewareCreator<
      { errorType: number; createError: boolean },
      { test1: string },
      MiddlewareErrors
    > = (options, { throws }) => {
      return async (r, lc) => {
        lc.destroy(async () => {
          if (options.errorType === 1) {
            throw Error(
              !options.createError
                ? 'Fatal lifecycle error'
                : 'Fatal lifecycle error during middleware create'
            );
          } else if (options.errorType === 2) {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw { error: true };
          }

          throws<DestroyError>('ImpossibleToDestroy', {
            message: options.createError ? 'CreateError' : undefined,
          });
        });

        if (options.createError) {
          return fail('ImpossibleToCreate');
        }

        return addService(r, {
          test1: '1',
        });
      };
    };

    const res1 = creator(m1).ok(async ({ service: { test1 } }) => {
      return ok(test1);
    });

    const res2 = res1.ok(async () => {
      throw new Error('Fatal ok exception');
    });

    const res3 = res2.fail(async () => {
      throw new Error('Fatal fail exception');
    });

    const res4 = res1.opt({ createError: true });

    it('exception happens in lifecycle', async () => {
      expect.assertions(3);

      expect(await res1.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"ImpossibleToDestroy"}}',
      });

      expect(await res1.opt({ errorType: 1 }).req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Fatal lifecycle error"}}',
      });

      expect(await res1.opt({ errorType: 2 }).req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"UncaughtError"}}',
      });
    });

    it('exception happens in callback and after that in the lifecycle', async () => {
      expect.assertions(3);

      expect(await res2.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"ImpossibleToDestroy"}}',
      });

      expect(await res2.opt({ errorType: 1 }).req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Fatal lifecycle error"}}',
      });

      expect(await res2.opt({ errorType: 2 }).req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"UncaughtError"}}',
      });
    });

    it('exception happens in callback and after that in the lifecycle and in the fail handler', async () => {
      expect.assertions(1);

      expect(await res3.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Fatal fail exception"}}',
      });
    });

    it('exception happens during middleware creation', async () => {
      expect.assertions(3);

      expect(await res4.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"ImpossibleToDestroy","message":"CreateError"}}',
      });

      expect(await res4.opt({ errorType: 1 }).req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Fatal lifecycle error during middleware create"}}',
      });

      expect(await res4.opt({ errorType: 2 }).req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"UncaughtError"}}',
      });
    });
  });

  describe('handle exceptions in returns lifecycle handlers', () => {
    it('fatal error', async () => {
      expect.assertions(3);

      const res = creator(creatorTest1);

      let failsCalls = 0;
      let okCalls = 0;

      const resOk = res
        .ok(async () => {
          okCalls += 1;
          return ok('1');
        })
        .ok(async (_r, _s, { returns }) => {
          returns(() => {
            throw new Error('Fatal error');
          });
          okCalls += 1;
          return ok('2');
        })
        .ok(async () => {
          okCalls += 1;
          return ok('3');
        })
        .fail(async () => {
          failsCalls += 1;
          return ok('4');
        });

      expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
        statusCode: 400,
        body:
          '{"status":"error","error":{"cause":"Error","type":"UncaughtError","message":"Fatal error"}}',
      });

      expect(okCalls).toStrictEqual(2);
      expect(failsCalls).toStrictEqual(0);
    });
  });
});
