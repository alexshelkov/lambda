import { Err, fail, ok, err as failErr } from 'lambda-res';

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
  Transform,
  TransformError,
  Middleware,
  GetTransformException,
  creator,
  addService,
  raw,
  json,
  resetFallBackTransform,
  createHandlerLifecycle,
  empty,
  safe,
  createEvent,
  createContext,
} from '../index';

import { error1 } from '../creator';

import {
  creatorTest1,
  creatorTest2,
  creatorTest3,
  creatorTest4Error,
  TestError,
  reset,
  req,
} from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('creator base', () => {
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

  it('works with empty service', async () => {
    expect.assertions(1);

    const res = creator(empty);

    const resOk = res.ok(async (_r) => {
      return ok(undefined);
    });

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
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

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '',
    });
  });

  it('returns 400 and empty error for undefined', async () => {
    expect.assertions(1);

    const res = creator(creatorTest2).opt({ op2: '1' });

    const resOk = res.ok(async () => {
      return failErr(undefined);
    });

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
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

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
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

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
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

    await expect(resFail.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 500,
      body: '{"status":"error","error":{"type":"err4"}}',
    });
  });

  describe('default fail handler', () => {
    it('will be Unknown for non-string types', async () => {
      expect.assertions(1);

      const reqObj = {
        error: 1,
      } as RequestError<AwsEvent, ServiceOptions, ServiceContainer, number>;

      const err1 = await error1(reqObj, createHandlerLifecycle(reqObj));

      expect(err1.err().type).toStrictEqual('Unknown');
    });

    it('will return error type for string', async () => {
      expect.assertions(1);

      const reqObj = {
        error: 'test',
      } as RequestError<AwsEvent, ServiceOptions, ServiceContainer, string>;

      const err1 = await error1(reqObj, createHandlerLifecycle(reqObj));

      expect(err1.err().type).toStrictEqual('test');
    });

    it('will be Unknown for non-string Err types', async () => {
      expect.assertions(1);

      const reqObj = {
        error: {
          type: 1 as unknown as string,
        },
      } as RequestError<AwsEvent, ServiceOptions, ServiceContainer, Err>;

      const err1 = await error1(reqObj, createHandlerLifecycle(reqObj));

      expect(err1.err().type).toStrictEqual('Unknown');
    });
  });

  it('get options', async () => {
    expect.assertions(1);

    const options = { op1: '1' };

    const res = creator(creatorTest1).opt(options);

    expect(res.options()).toStrictEqual(options);
  });
});

describe('create middleware lazily and in correct order', () => {
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

    const handle = res.req();

    await handle(createEvent(), createContext());
    await handle(createEvent(), createContext());
    await handle(createEvent(), createContext());

    expect(created).toStrictEqual(1);
    expect(destroyed).toStrictEqual(3);
    expect(requests).toStrictEqual(3);
  });

  it('ok handlers order', async () => {
    expect.assertions(2);

    const steps: string[] = [];

    steps.push('start');

    const m1: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m1 created');

      return async (request) => {
        steps.push('m1 request');

        return addService(request);
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m2 created');

      return async (request) => {
        steps.push('m2 request');

        return addService(request);
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

        return addService(request);
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

        return addService(request);
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, ServiceContainer, Err> = () => {
      steps.push('m2 created');

      return async (request) => {
        steps.push('m2 request');

        if (Math.random() > -1) {
          throw new Error('Fatal error');
        }

        return addService(request);
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

    const e1: HandlerError<ServiceType, ErrorType, string, Err> = async () => {
      return fail('error');
    };

    const e1GetCrt: GetHandlerError<typeof res, string, Err> = async () => {
      return fail('error');
    };

    const resOk1 = res.ok(h1).ok(h1GetCrt).ok(h1GetMdl);
    const resFail1 = resOk1.fail(e1).fail(e1GetCrt);

    await expect(resFail1.req()(createEvent(), createContext())).resolves.toMatchObject({
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

    await expect(resFatal2.req()(createEvent(), createContext())).resolves.toMatchObject({
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
    type InferredOptions = GetOpt<InferMiddleware>;
    type InferredService = GetServiceMdl<InferMiddleware> & GetServiceMdl<typeof dep1>;

    const res = creator(dep1)
      .srv(inferMiddleware)
      .ok(async (_r: Request<InferredEvent, InferredOptions, InferredService>) => {
        return ok('success');
      });

    type InferredError = GetErrorMdl<InferMiddleware> | GetErrorMdl<typeof dep1>;

    const resErr = res.fail(
      async (_r: RequestError<InferredEvent, InferredOptions, InferredService, InferredError>) => {
        return ok('error');
      }
    );

    await expect(resErr.req()(createEvent(), createContext())).resolves.toMatchObject({
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
        return addService(request);
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
    const e1: HandlerError<
      ServiceType,
      ErrorType,
      string,
      Err,
      never,
      EventType,
      ServiceOpt
    > = async () => {
      return fail('error');
    };

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    await expect(resFail.req()(createEvent('event'), createContext(42))).resolves.toMatchObject({
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
    > = async (_r, { returns }) => {
      returns(async () => {
        return true;
      });

      return ok('f1');
    };

    const f2: GetHandlerError<
      typeof creatorTest1,
      string,
      never,
      GetError<typeof creatorTest1>
    > = async (_r, { returns }) => {
      returns(async () => {
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

    await expect(res.req()(createEvent(), createContext())).resolves.toMatchObject({
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
        return addService(request);
      };
    };

    const cr2: MiddlewareCreator<
      ServiceOptions,
      ServiceContainer,
      never,
      { appEnvs: { env2: string } }
    > = () => {
      return async (request) => {
        return addService(request);
      };
    };

    type BaseOpts = { envs: readonly string[] };
    type Serv<O> = O extends { envs: infer X }
      ? X extends readonly string[]
        ? { [k in X[number]]: string }
        : never
      : unknown;
    type EnvError = Err<'EnvError', { name: string }>;

    const inferServices = <Opt extends BaseOpts>(
      options: Partial<Opt>
    ): Middleware<Opt, { appEnvs: Serv<Opt> }, EnvError> => {
      return async <Service1 extends ServiceContainer>(
        request: Request<AwsEvent, Opt, Service1>
      ) => {
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
          appEnvs: service as Serv<Opt>,
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

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      status: 'success',
      data: 'ok env1=1 env2=2',
    });

    delete definedEnvs.env2;

    await expect(() => {
      return resOk.req()(createEvent(), createContext());
    }).rejects.toMatchObject({
      status: 'error',
      error: {
        type: 'EnvError',
        name: 'env2',
      },
    });
  });

  it('fail handler may have an access to partial service', async () => {
    expect.assertions(3);

    const f1: GetHandlerError<
      [typeof creatorTest1, typeof creatorTest4Error],
      string,
      never,
      never,
      GetService<typeof creatorTest1>
    > = async ({ service, error }) => {
      expect(error.type).toStrictEqual('err4');
      expect(service.test1).toStrictEqual('1');

      return ok(`f1: ${service.test1 || ''}`);
    };

    const res = creator(creatorTest1).srv(creatorTest4Error).fail(f1);

    await expect(res.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"f1: 1"}',
    });
  });
});

describe('creator and handler lifecycles', () => {
  describe('returns lifecycle stops handlers', () => {
    it('works with ok handler', async () => {
      expect.assertions(6);

      const res = creator(creatorTest1);

      let okCalls = 0;

      const resOk = res
        .ok(async () => {
          okCalls += 1;
          return ok('1');
        })
        .ok(async (_, { returns }) => {
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

      await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"2"}',
      });

      expect(okCalls).toStrictEqual(2);

      const resOk2 = res
        .ok(async (_, { returns }) => {
          returns(async () => {
            return true;
          });
          okCalls += 1;
          return ok('1');
        })
        .ok(async () => {
          okCalls += 1;
          return ok('2');
        });

      await expect(resOk2.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"1"}',
      });

      expect(okCalls).toStrictEqual(3);

      const resOk3 = res
        .ok(async (_, { returns }) => {
          returns(true);
          okCalls += 1;
          return ok('1');
        })
        .ok(async () => {
          okCalls += 1;
          return ok('2');
        });

      await expect(resOk3.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"1"}',
      });

      expect(okCalls).toStrictEqual(4);
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
        .fail(async (_, { returns }) => {
          returns(async () => {
            return true;
          });
          failCalls += 1;
          return ok('2');
        })
        .fail(async () => {
          failCalls += 1;
          return ok('3');
        });

      await expect(resErr.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"2"}',
      });

      expect(failCalls).toStrictEqual(2);

      const resFail2 = res
        .fail(async (_, { returns }) => {
          returns(async () => {
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

      await expect(resFail2.req()(createEvent(), createContext())).resolves.toMatchObject({
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

          return addService(request);
        };
      };

      const res = creator(creatorFatal);

      let fatal = 0;

      const resErr = res
        .fatal(async () => {
          fatal += 1;
          return ok('1');
        })
        .fatal(async (_, { returns }) => {
          returns(async () => {
            return true;
          });
          fatal += 1;
          return ok('2');
        })
        .fatal(async () => {
          fatal += 1;
          return ok('3');
        });

      await expect(resErr.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"2"}',
      });

      expect(fatal).toStrictEqual(2);

      const resFail2 = res
        .fatal(async (_, { returns }) => {
          returns(async () => {
            return true;
          });
          fatal += 1;
          return ok('1');
        })
        .fatal(async () => {
          fatal += 1;
          return ok('2');
        });

      await expect(resFail2.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 200,
        body: '{"status":"success","data":"1"}',
      });

      expect(fatal).toStrictEqual(3);
    });
  });

  describe('works lifecycle', () => {
    it('prevent ok handler execution', async () => {
      expect.assertions(3);

      const res = creator(creatorTest1).on(safe);

      let okCalls = 0;
      let okRuns = 0;

      const resOk = res
        .ok(async (_, { works }) => {
          okCalls += 1;
          works(true);
          okRuns += 1;
          return ok('1');
        })
        .ok(async (_, { works }) => {
          okCalls += 1;
          works(false);
          okRuns += 1;
          return ok('2');
        })
        .ok(async (_, { works }) => {
          okCalls += 1;
          works(() => {
            return false;
          });
          okRuns += 1;
          return ok('3');
        })
        .ok(async (_, { works }) => {
          okCalls += 1;
          await works(async () => {
            return false;
          });
          okRuns += 1;
          return ok('4');
        });

      await expect(req(resOk)).resolves.toMatchObject({
        status: 'success',
        data: '1',
      });

      expect(okCalls).toStrictEqual(4);
      expect(okRuns).toStrictEqual(1);
    });

    it('prevent fail handler execution', async () => {
      expect.assertions(3);

      const res = creator(creatorTest4Error).on(safe);

      let failCalls = 0;
      let failRuns = 0;

      const resFail = res
        .fail(async (_, { works }) => {
          failCalls += 1;
          works(true);
          failRuns += 1;
          return ok('1');
        })
        .fail(async (_, { works }) => {
          failCalls += 1;
          works(false);
          failRuns += 1;
          return ok('2');
        });

      await expect(req(resFail)).resolves.toMatchObject({
        status: 'success',
        data: '1',
      });

      expect(failCalls).toStrictEqual(2);
      expect(failRuns).toStrictEqual(1);
    });

    it('prevent fatal handler execution', async () => {
      expect.assertions(3);

      const creatorFatal: MiddlewareCreator<ServiceOptions, ServiceContainer, never> = () => {
        return async (request) => {
          if (Math.random() > -1) {
            throw new Error('Uncaught error');
          }

          return addService(request);
        };
      };

      const res = creator(creatorFatal).on(safe);

      let fatalCalls = 0;
      let fatalRuns = 0;

      const resFatal = res
        .fatal(async (_, { works }) => {
          fatalCalls += 1;
          works(true);
          fatalRuns += 1;
          return ok('1');
        })
        .fatal(async (_, { works }) => {
          fatalCalls += 1;
          works(false);
          fatalRuns += 1;
          return ok('2');
        });

      await expect(req(resFatal)).resolves.toMatchObject({
        status: 'success',
        data: '1',
      });

      expect(fatalCalls).toStrictEqual(2);
      expect(fatalRuns).toStrictEqual(1);
    });

    it('worksForErr lifecycle prevent execution of fails with wrong error type', async () => {
      expect.assertions(9);

      const cr1: MiddlewareCreator<
        { cr3Err: boolean; cr2Err: boolean },
        never,
        Err<'cr1'> | Err<'cr2'> | Err<'cr3'>
      > = (options) => {
        // eslint-disable-next-line @typescript-eslint/require-await
        return async () => {
          if (options.cr3Err) {
            return fail('cr3');
          } else if (options.cr2Err) {
            return fail('cr2');
          }

          return fail('cr1');
        };
      };

      const res = creator(cr1).on(safe);

      let failCalls = 0;
      let failRuns = 0;

      const resErr = res
        .fail(async (_, { worksForErr }) => {
          failCalls += 1;
          const { error } = worksForErr(() => {
            return ['cr1'];
          }, true);
          failRuns += 1;
          return ok(`fail 1: ${error.type}`);
        })
        .fail(async (_, { worksForErr }) => {
          failCalls += 1;
          const { error } = await worksForErr(
            async () => {
              return ['cr2'];
            },
            async () => {
              return true;
            }
          );
          failRuns += 1;
          return ok(`fail 2: ${error.type}`);
        })
        .fail(async (_, { worksForErr }) => {
          failCalls += 1;
          const { error } = worksForErr(['cr3'], () => {
            return true;
          });
          failRuns += 1;
          return ok(`fail 3: ${error.type}`);
        })
        .fail(async ({ error }) => {
          failCalls += 1;
          failRuns += 1;
          return ok(`fail 4: ${error.type}`);
        });

      await expect(req(resErr)).resolves.toMatchObject({
        status: 'success',
        data: 'fail 1: cr1',
      });

      expect(failCalls).toStrictEqual(1);
      expect(failRuns).toStrictEqual(1);

      failCalls = 0;
      failRuns = 0;

      await expect(req(resErr.opt({ cr2Err: true }))).resolves.toMatchObject({
        status: 'success',
        data: 'fail 2: cr2',
      });

      expect(failCalls).toStrictEqual(2);
      expect(failRuns).toStrictEqual(1);

      failCalls = 0;
      failRuns = 0;

      await expect(req(resErr.opt({ cr3Err: true }))).resolves.toMatchObject({
        status: 'success',
        data: 'fail 3: cr3',
      });

      expect(failCalls).toStrictEqual(3);
      expect(failRuns).toStrictEqual(1);
    });
  });

  it('lifecycles called in the right order', async () => {
    expect.assertions(3);

    const steps = ['start'];

    const m1: MiddlewareCreator<ServiceOptions, { test1: string }, never> = () => {
      steps.push('m1 created');

      return async (r, lc) => {
        lc.destroy(async () => {
          steps.push('m1 destroyed');
        });

        lc.end(async () => {
          steps.push('m1 ended');
        });

        steps.push('m1 request');

        return addService(r, {
          test1: '1',
        });
      };
    };

    const m2: MiddlewareCreator<ServiceOptions, { test2: string }, never> = () => {
      steps.push('m2 created');

      return async (r, lc) => {
        lc.destroy(async () => {
          steps.push('m2 destroyed');
        });

        lc.end(async () => {
          steps.push('m2 ended');
        });

        steps.push('m2 request');

        return addService(r, {
          test2: '2',
        });
      };
    };

    const res = creator(m1)
      .srv(m2)
      .ok(async ({ service: { test1, test2 } }) => {
        steps.push('ok1');

        return ok(`${test1} & ${test2}`);
      });

    expect(steps).toStrictEqual(['start']);

    await expect(res.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"1 & 2"}',
    });

    expect(steps).toStrictEqual([
      'start',
      'm1 created',
      'm2 created',
      'm1 request',
      'm2 request',
      'ok1',
      'm1 ended',
      'm2 ended',
      'm2 destroyed',
      'm1 destroyed',
    ]);
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

    const handle = res.req();

    await Promise.all([
      handle(createEvent({ e: 1 }), createContext()),
      handle(createEvent({ e: 2 }), createContext()),
      handle(createEvent({ e: 3 }), createContext()),
      handle(createEvent({ e: 4 }), createContext()),
    ]);

    expect(creates).toStrictEqual(4);
    expect(destroyed).toStrictEqual(4);
    expect(requests).toStrictEqual(4);
  });
});

describe('creator transform', () => {
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

    await expect(resTrans.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 123,
      body: 'Test 1 1',
    });

    const trans1: Transform<string, unknown, unknown> = async () => {
      return 'Test 2';
    };

    await expect(resOk.onOk(trans1).req()(createEvent(), createContext())).resolves.toStrictEqual(
      'Test 2'
    );

    const trans2: GetTransform<typeof resOk, string> = async (result, request) => {
      return `Test 3 ${result.ok()} ${request.service.test1}`;
    };

    const resTrans2 = resTrans.onOkRes(trans2);

    await expect(resTrans2.req()(createEvent(), createContext())).resolves.toStrictEqual(
      'Test 3 success 1'
    );

    const trans3: GetTransform<typeof creatorTest1, string> = async (result, request) => {
      return `Test 4 ${request.service.test1}`;
    };

    await expect(
      resTrans2.onOkRes(trans3).req()(createEvent(), createContext())
    ).resolves.toStrictEqual('Test 4 1');

    const resOk2 = resTrans2.ok(async () => {
      return ok('success2');
    });

    await expect(resOk2.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 123,
      body: 'Test 1 1',
    });
  });

  it('ok fail', async () => {
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

    await expect(resTrans.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 456,
      body: 'Test 1 1',
    });

    const trans1: Transform<string, unknown, unknown> = async () => {
      return 'Test 1';
    };

    await expect(resErr.onOk(trans1).req()(createEvent(), createContext())).resolves.toStrictEqual(
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

    await expect(resTrans.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 789,
      body: 'Test 1',
    });

    const trans1: TransformError<string, unknown, unknown> = async () => {
      return `Test 2`;
    };

    await expect(
      resFail.onFail(trans1).req()(createEvent(), createContext())
    ).resolves.toStrictEqual('Test 2');

    const trans2: GetTransformFailure<typeof resFail, string> = async (result) => {
      return `Test ${result.ok()} 3`;
    };

    const restTrans2 = resTrans.onFailRes(trans2);

    await expect(restTrans2.req()(createEvent(), createContext())).resolves.toStrictEqual(
      'Test fail 3'
    );

    const trans3: GetTransformFailure<typeof creatorTest4Error, string> = async () => {
      return `Test 4`;
    };

    await expect(
      resFail.onFailRes(trans3).req()(createEvent(), createContext())
    ).resolves.toStrictEqual('Test 4');

    const resFail2 = restTrans2.fail(async () => {
      return ok('fail2');
    });

    await expect(resFail2.req()(createEvent(), createContext())).resolves.toMatchObject({
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

    await expect(resTrans.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 789,
      body: 'Test 1',
    });

    const trans1: TransformError<string, unknown, unknown> = async () => {
      return `Test 2`;
    };

    await expect(
      resFatal.onFatal(trans1).req()(createEvent(), createContext())
    ).resolves.toStrictEqual('Test 2');

    const trans2: GetTransformException<typeof resFatal, string> = async (result) => {
      return `Test ${result.ok()} 3`;
    };

    const resTrans2 = resTrans.onFatalRes(trans2);

    await expect(resTrans2.req()(createEvent(), createContext())).resolves.toStrictEqual(
      'Test fatal 3'
    );

    const trans3: GetTransformException<typeof creatorTest1, string> = async () => {
      return `Test 4`;
    };

    await expect(
      resFatal.onFatalRes(trans3).req()(createEvent(), createContext())
    ).resolves.toStrictEqual('Test 4');

    const resFatal2 = resTrans2.fatal(async () => {
      return ok('fatal2');
    });

    await expect(resFatal2.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 789,
      body: 'Test 1',
    });
  });
});

describe('creator exceptions', () => {
  describe('creator and handler exceptions', () => {
    type CreationError = Err<'CreationError'>;
    type RequestError = Err<'RequestError'>;
    type ExceptionCreatorErrors = CreationError | RequestError;
    type ExceptionCreatorOptions = {
      throwError?: 'CreatingError' | 'RequestError';
      errorType?: 'ThrowFail' | 'UnhandledException' | 'PlainObject';
    };
    type ExceptionCreatorService = { throwError: () => void };

    const exceptionCreator: MiddlewareCreator<
      ExceptionCreatorOptions,
      ExceptionCreatorService,
      ExceptionCreatorErrors
    > = (options, lc) => {
      if (options.throwError === 'CreatingError') {
        if (options.errorType === 'ThrowFail') {
          throw fail<Err>('ThrowFail', { message: 'ThrowFail message' });
        } else if (options.errorType === 'UnhandledException') {
          throw new Error('Unhandled exception in creator');
        } else if (options.errorType === 'PlainObject') {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw { error: true };
        } else {
          lc.throws<CreationError>('CreationError');
        }
      }

      return async (request) => {
        if (options.throwError === 'RequestError') {
          if (options.errorType === 'ThrowFail') {
            throw fail<Err>('RequestThrowFail', { message: 'RequestThrowFail message' });
          } else {
            lc.throws<RequestError>('RequestError');
          }
        }

        return addService(request, {
          throwError: () => {
            // if ()
            throw new Error('Unhandled exception in middleware');
          },
        });
      };
    };

    it('default handler', async () => {
      expect.assertions(1);

      const res2 = creator(creatorTest1).on(safe);

      const res2Ok = res2.ok(async () => {
        if (Math.random() !== -1) {
          throw new Error('Test error');
        }

        return ok(true);
      });

      await expect(res2Ok.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Error', type: 'FatalError', message: 'Test error' },
      });
    });

    it('raw object error', async () => {
      expect.assertions(1);

      const res = creator(creatorTest1).on(safe);

      const resOk = res.ok(async () => {
        if (Math.random() !== -1) {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw { message: 'Test message' };
        }

        return ok(true);
      });

      await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Unknown', type: 'FatalError' },
      });
    });

    it('exception in service method', async () => {
      expect.assertions(2);

      const res = creator(exceptionCreator).on(safe);

      const resOk = res.ok(async ({ service }) => {
        service.throwError();

        return ok(true);
      });

      const resExc = resOk.fatal(async (request) => {
        expect((request.exception as Error).message).toStrictEqual(
          'Unhandled exception in middleware'
        );

        return ok(true);
      });

      await expect(resExc.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'success',
        data: true,
      });
    });

    it('exception in creator', async () => {
      expect.assertions(5);

      const res = creator(exceptionCreator).on(safe);

      await expect(
        req(res.opt({ throwError: 'CreatingError', errorType: 'ThrowFail' }))
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'ThrowFail', type: 'FatalError', message: 'ThrowFail message' },
      });

      await expect(req(res.opt({ throwError: 'CreatingError' }))).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { type: 'CreationError' },
      });

      await expect(
        req(
          res.opt({ throwError: 'CreatingError' }).fail(async () => {
            throw new Error('Double error');
          })
        )
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Error', type: 'FatalError', message: 'Double error' },
      });

      await expect(
        req(res.opt({ throwError: 'CreatingError', errorType: 'UnhandledException' }))
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Error', type: 'FatalError', message: 'Unhandled exception in creator' },
      });

      await expect(
        req(res.opt({ throwError: 'CreatingError', errorType: 'PlainObject' }))
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Unknown', type: 'FatalError' },
      });
    });

    it('fail in creator request', async () => {
      expect.assertions(5);

      const res = creator(exceptionCreator).on(safe);

      await expect(
        res.opt({ throwError: 'RequestError' }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { type: 'RequestError' },
      });

      await expect(
        res.opt({ throwError: 'RequestError', errorType: 'ThrowFail' }).req()(
          createEvent(),
          createContext()
        )
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: {
          cause: 'RequestThrowFail',
          type: 'FatalError',
          message: 'RequestThrowFail message',
        },
      });

      const res1 = res.fail(async () => {
        expect(true).toStrictEqual(true); // called only once

        if (Math.random() > -1) {
          throw new Error('Unhandled double error');
        }
        return ok('f1');
      });

      await expect(
        res1.opt({ throwError: 'RequestError' }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Error', type: 'FatalError', message: 'Unhandled double error' },
      });

      // failure handler not called in this case
      await expect(
        res1.opt({ throwError: 'RequestError', errorType: 'ThrowFail' }).req()(
          createEvent(),
          createContext()
        )
      ).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: {
          cause: 'RequestThrowFail',
          type: 'FatalError',
          message: 'RequestThrowFail message',
        },
      });
    });

    it('exception in ok handler', async () => {
      expect.assertions(4);

      const res1 = creator(creatorTest1).on(safe);

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

      await expect(res1Exc.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'success',
        data: false,
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

      await expect(res2Exc.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'success',
        data: false,
      });
    });

    it('exception in fatal handler', async () => {
      expect.assertions(2);

      const res = creator(creatorTest1).on(safe);

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

      await expect(resExc.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'error',
        error: {
          cause: 'Error',
          type: 'RunnerUncaught',
          message: 'Unhandled exception in callback',
        },
      });

      await expect(resExc1.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'error',
        error: { cause: 'Unknown', type: 'RunnerUncaught' },
      });
    });
  });

  describe('transform exceptions', () => {
    it('exception in transform ok', async () => {
      expect.assertions(1);

      const res = creator(creatorTest1)
        .ok(async () => {
          return ok('1');
        })
        .on(safe)
        .onOk(async () => {
          throw new Error('Fatal error');
        });

      await expect(req(res)).resolves.toMatchObject({
        status: 'error',
        error: { cause: 'Error', type: 'FatalError', message: 'Fatal error' },
      });
    });

    it('exception in transform fail', async () => {
      expect.assertions(1);

      const res = creator(creatorTest4Error)
        .fail(async () => {
          return ok('1');
        })
        .on(safe)
        .onFail(async () => {
          throw new Error('Fatal error');
        });

      await expect(req(res)).resolves.toMatchObject({
        status: 'error',
        error: { cause: 'Error', type: 'FatalError', message: 'Fatal error' },
      });
    });

    it('exception in transform fatal', async () => {
      expect.assertions(6);

      const res = creator(creatorTest1)
        .ok(async () => {
          throw new Error('Fatal error');
        })
        .on(safe);

      const resTrans = res.onFatal(async () => {
        throw new Error('Double fatal error');
      });

      await expect(resTrans.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Error","type":"RunnerUncaughtTransform","message":"Double fatal error"}}',
      });

      const resTrans1 = res.onFatal(() => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw { error: true };
      });

      await expect(resTrans1.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"RunnerUncaughtTransform"}}',
      });

      resetFallBackTransform(safe);

      await expect(resTrans.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Error', type: 'RunnerUncaughtTransform', message: 'Double fatal error' },
      });

      await expect(resTrans1.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'error',
        name: 'FailureException',
        error: { cause: 'Unknown', type: 'RunnerUncaughtTransform' },
      });

      resetFallBackTransform(raw);

      await expect(() => {
        return resTrans.req()(createEvent(), createContext());
      }).rejects.toThrow('Double fatal error');

      await expect(() => {
        return resTrans1.req()(createEvent(), createContext());
      }).rejects.toThrow('RunnerUncaughtTransform');

      resetFallBackTransform(json);
    });
  });

  describe('failure and exceptions in lifecycle', () => {
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

      await expect(res1.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"ImpossibleToDestroy"}}',
      });

      await expect(
        res1.opt({ errorType: 1 }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Error","type":"FatalError","message":"Fatal lifecycle error"}}',
      });

      await expect(
        res1.opt({ errorType: 2 }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"FatalError"}}',
      });
    });

    it('exception happens in callback and after that in the lifecycle', async () => {
      expect.assertions(3);

      await expect(res2.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"ImpossibleToDestroy"}}',
      });

      await expect(
        res2.opt({ errorType: 1 }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Error","type":"FatalError","message":"Fatal lifecycle error"}}',
      });

      await expect(
        res2.opt({ errorType: 2 }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"FatalError"}}',
      });
    });

    it('exception happens in callback and after that in the lifecycle and in the fail handler', async () => {
      expect.assertions(1);

      await expect(res3.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Error","type":"FatalError","message":"Fatal fail exception"}}',
      });
    });

    it('exception happens during middleware creation', async () => {
      expect.assertions(3);

      await expect(res4.req()(createEvent(), createContext())).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"type":"ImpossibleToDestroy","message":"CreateError"}}',
      });

      await expect(
        res4.opt({ errorType: 1 }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Error","type":"FatalError","message":"Fatal lifecycle error during middleware create"}}',
      });

      await expect(
        res4.opt({ errorType: 2 }).req()(createEvent(), createContext())
      ).resolves.toMatchObject({
        statusCode: 400,
        body: '{"status":"error","error":{"cause":"Unknown","type":"FatalError"}}',
      });
    });
  });

  it('exceptions in returns lifecycle handlers', async () => {
    expect.assertions(3);

    const res = creator(creatorTest1);

    let failsCalls = 0;
    let okCalls = 0;

    const resOk = res
      .ok(async () => {
        okCalls += 1;
        return ok('1');
      })
      .ok(async (_, { returns }) => {
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

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"cause":"Error","type":"FatalError","message":"Fatal error"}}',
    });

    expect(okCalls).toStrictEqual(2);
    expect(failsCalls).toStrictEqual(0);
  });

  describe('exceptions in partial service', () => {
    const steps: string[] = [];

    const cr1: MiddlewareCreator<
      { destroyed: boolean },
      { throwError: () => void },
      Err<'throwError'>
    > = (options, { throws }) => {
      return async (request, { destroy }) => {
        if (options.destroyed) {
          destroy(async () => {
            steps.push(`cr1 destroy`);
          });
        }

        steps.push('cr1 req');

        return addService(request, {
          throwError: () => {
            steps.push(`cr1 throwError`);
            throws<Err<'throwError'>>('throwError');
          },
        });
      };
    };

    const cr2: MiddlewareCreator<{ destroyed: boolean }, ServiceContainer, Err<'Cr2Err'>> = (
      options
    ) => {
      return async (_, { destroy }) => {
        if (options.destroyed) {
          destroy(async () => {
            steps.push(`cr2 destroy`);
          });
        }

        steps.push('cr2 req');
        steps.push('cr2 fail');

        return fail<Err<'Cr2Err'>>('Cr2Err');
      };
    };

    describe('fail calls partial with exception', () => {
      it('single error', async () => {
        expect.assertions(3);

        reset(steps);
        expect(steps).toStrictEqual([]);

        const f1: GetHandlerError<
          [typeof cr1, typeof cr2],
          string,
          never,
          never,
          GetService<typeof cr1>
        > = async ({ service, error }) => {
          steps.push(`f1 ${error.type}`);

          if (service.throwError && error.type !== 'throwError') {
            service.throwError();
          }

          return ok(`f1`);
        };

        const res = creator(cr1).srv(cr2).fail(f1).on(safe);

        await expect(res.req()(createEvent(), createContext())).resolves.toMatchObject({
          status: 'success',
          data: 'f1',
        });

        expect(steps).toStrictEqual([
          'cr1 req',
          'cr2 req',
          'cr2 fail',
          'f1 Cr2Err',
          'cr1 throwError',
          'f1 throwError',
        ]);
      });

      it('double error', async () => {
        expect.assertions(3);

        reset(steps);
        expect(steps).toStrictEqual([]);

        const f2: GetHandlerError<
          [typeof cr1, typeof cr2],
          string,
          never,
          never,
          GetService<typeof cr1>
        > = async ({ service, error }) => {
          steps.push(`f1 ${error.type}`);

          if (service.throwError) {
            service.throwError();
          }

          return ok(`f1`);
        };

        const res2 = creator(cr1).srv(cr2).fail(f2).on(safe);

        await expect(res2.req()(createEvent(), createContext())).resolves.toMatchObject({
          status: 'error',
          name: 'FailureException',
          error: { cause: 'throwError', type: 'FatalError' },
        });

        expect(steps).toStrictEqual([
          'cr1 req',
          'cr2 req',
          'cr2 fail',
          'f1 Cr2Err',
          'cr1 throwError',
          'f1 throwError',
          'cr1 throwError',
        ]);
      });
    });

    it('fails call partial with exception and destroy lifetimes', async () => {
      expect.assertions(3);

      reset(steps);
      expect(steps).toStrictEqual([]);

      const f1: GetHandlerError<
        [typeof cr1, typeof cr2],
        string,
        never,
        never,
        GetService<typeof cr1>
      > = async ({ service, error }) => {
        steps.push(`f1 ${error.type}`);

        if (service.throwError && error.type !== 'throwError') {
          service.throwError();
        }

        return ok(`f1`);
      };

      const res1 = creator(cr1).srv(cr2).opt({ destroyed: true }).fail(f1).on(raw);

      await expect(res1.req()(createEvent(), createContext())).resolves.toMatchObject({
        status: 'success',
        data: 'f1',
      });

      expect(steps).toStrictEqual([
        'cr1 req',
        'cr2 req',
        'cr2 fail',
        'f1 Cr2Err',
        'cr1 throwError',
        'f1 throwError',
        'cr2 destroy',
        'cr1 destroy',
      ]);
    });
  });
});
