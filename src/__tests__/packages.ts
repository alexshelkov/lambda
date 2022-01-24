import { Err, fail, nope, ok } from 'lambda-res';

import {
  creator,
  addService,
  safe,
  Package,
  MiddlewareCreator,
  GetService,
  ServiceOptions,
} from '../index';

import { req, creatorTest1, creatorTest2, reset } from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('packages basic', () => {
  it('works with package with all options', async () => {
    expect.assertions(5);

    const p1: Package<
      { p1SrvFail: boolean; p1SrvThrows: boolean; okHandlerErr: boolean; failHandlerErr: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'> | Err<'p1_Srv_Throw1'>,
      string,
      Err<'p1_Ok_Err1'>,
      string,
      Err<'p1_Fail_Err1'>
    > = {
      srv: (options, { throws }) => {
        if (options.p1SrvThrows) {
          throws<Err<'p1_Srv_Throw1'>>('p1_Srv_Throw1');
        }

        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      ok: async ({ service, options }) => {
        if (options.okHandlerErr) {
          return fail('p1_Ok_Err1');
        }

        return ok(`ok: ${service.p1Srv}`);
      },

      fail: async ({ error, options }) => {
        if (options.failHandlerErr) {
          return fail('p1_Fail_Err1');
        }

        return ok(`fail: ${error.type}`);
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv',
    });

    await expect(req(res.opt({ okHandlerErr: true }))).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'p1_Ok_Err1',
      },
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Err1',
    });

    await expect(req(res.opt({ p1SrvFail: true, failHandlerErr: true }))).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'p1_Fail_Err1',
      },
    });

    await expect(req(res.opt({ p1SrvThrows: true, p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Throw1',
    });
  });
});

describe('packages partial', () => {
  it('works with only service added', async () => {
    expect.assertions(2);

    const p1: Package<{ p1SrvFail: boolean }, { p1Srv: string }, Err<'p1_Srv_Err1'>> = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'NotImplemented',
      },
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'p1_Srv_Err1',
      },
    });
  });

  it('works with service and ok', async () => {
    expect.assertions(2);

    const p1: Package<
      { p1SrvFail: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'>,
      string,
      Err<'p1_Ok_Err1'>
    > = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      ok: async ({ service }) => {
        return ok(`ok: ${service.p1Srv}`);
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv',
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'p1_Srv_Err1',
      },
    });
  });

  it('works with service and fail', async () => {
    expect.assertions(2);

    const p1: Package<
      { p1SrvFail: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'>,
      never,
      never,
      string,
      Err<'p1_Fail_Err1'>
    > = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      fail: async ({ error }) => {
        return ok(`fail: ${error.type}`);
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'NotImplemented',
      },
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Err1',
    });
  });
});

describe('packages partial handlers', () => {
  it('always success', async () => {
    expect.assertions(2);

    const p1: Package<
      { p1SrvFail: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'>,
      string,
      never,
      string
    > = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      ok: async ({ service }) => {
        return ok(`ok: ${service.p1Srv}`);
      },

      fail: async ({ error }) => {
        return ok(`fail: ${error.type}`);
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv',
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Err1',
    });
  });

  it('always errors', async () => {
    expect.assertions(2);

    const p1: Package<
      { p1SrvFail: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'>,
      never,
      Err<'p1_Ok_Err1', { p1Srv: string }>,
      never,
      Err<'p1_Fail_Err1', { p1Err?: 'p1_Srv_Err1' }>
    > = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      ok: async ({ service }) => {
        return fail(`p1_Ok_Err1`, { p1Srv: service.p1Srv });
      },

      fail: async ({ error }) => {
        return fail('p1_Fail_Err1', { p1Err: error.type });
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'p1_Ok_Err1',
        p1Srv: 'p1Srv',
      },
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'error',
      error: {
        type: 'p1_Fail_Err1',
        p1Err: 'p1_Srv_Err1',
      },
    });
  });
});

describe('packages advanced', () => {
  it('ok and fail handlers early returns works correctly', async () => {
    expect.assertions(6);

    const p1: Package<
      { p1SrvFail: boolean; earlyReturn: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'>,
      string,
      Err<'p1_Ok_Err1'>,
      string,
      Err<'p1_Fail_Err1'>
    > = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail) {
            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      ok: async ({ service, options }, { returns }) => {
        returns(() => {
          return Promise.resolve(!!options.earlyReturn);
        });

        return ok(`ok: ${service.p1Srv}`);
      },

      fail: async ({ error, options }, { returns }) => {
        returns(async () => {
          return Promise.resolve(!!options.earlyReturn);
        });

        return ok(`fail: ${error.type}`);
      },
    };

    const res = creator(creatorTest1).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv',
    });

    await expect(req(res.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Err1',
    });

    const res2 = res
      .ok(async () => {
        return ok('overwrite_p1_ok');
      })
      .fail(async () => {
        return ok('overwrite_p1_fail');
      });

    await expect(req(res2)).resolves.toMatchObject({
      status: 'success',
      data: 'overwrite_p1_ok',
    });

    await expect(req(res2.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'overwrite_p1_fail',
    });

    const res3 = res2.opt({ earlyReturn: true });

    await expect(req(res3)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv',
    });

    await expect(req(res3.opt({ p1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Err1',
    });
  });

  it('handled error in fail handler', async () => {
    expect.assertions(4);

    const cr1: MiddlewareCreator<{ cr1SrvFail: boolean }, { cr1Srv: string }, Err<'cr1_Err1'>> = (
      options
    ) => {
      return async (request) => {
        if (options.cr1SrvFail) {
          return fail('cr1_Err1');
        }

        return addService(request, {
          cr1Srv: 'cr1Srv',
        });
      };
    };

    const p1: Package<
      { p1SrvFail1: boolean; p1SrvFail2: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'> | Err<'p1_Srv_Err2'>,
      never,
      never,
      string,
      Err<'p1_Fail_Err1'>,
      Err<'p1_Srv_Err1'>
    > = {
      srv: () => {
        return async (request) => {
          if (request.options.p1SrvFail1) {
            return fail('p1_Srv_Err1');
          }

          if (request.options.p1SrvFail2) {
            return fail('p1_Srv_Err2');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      fail: async ({ error }, { returns }) => {
        returns(() => {
          return error.type === 'p1_Srv_Err1';
        });

        return ok(`p1 fail: ${error.type}`);
      },
    };

    const res = creator(cr1).pack(p1).on(safe);

    const res2 = res

      .ok(async ({ service }) => {
        return ok(`ok: ${service.p1Srv} and ${service.cr1Srv}`);
      })

      .fail(async ({ error }) => {
        let errCode: string;

        const errType = error.type;

        if (errType === 'cr1_Err1') {
          errCode = 'cr1_Err1';
        } else if (errType === 'p1_Srv_Err2') {
          errCode = 'p1_Srv_Err2';
        } else {
          nope(errType);
        }

        return ok(`fail: ${errCode}`);
      });

    await expect(req(res2)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv and cr1Srv',
    });

    await expect(req(res2.opt({ cr1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: cr1_Err1',
    });

    await expect(req(res2.opt({ p1SrvFail1: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'p1 fail: p1_Srv_Err1',
    });

    await expect(req(res2.opt({ p1SrvFail2: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'fail: p1_Srv_Err2',
    });
  });

  it('works with dependent service', async () => {
    expect.assertions(1);

    const p1: Package<
      ServiceOptions,
      { p1Srv: string },
      never,
      string,
      never,
      never,
      never,
      never,
      GetService<typeof creatorTest2>
    > = {
      srv: () => {
        return async (request) => {
          return addService(request, {
            p1Srv: `p1Srv=${request.service.test2}`,
          });
        };
      },

      ok: async ({ service }) => {
        return ok(`ok: ${service.p1Srv}`);
      },
    };

    const res = creator(creatorTest1).srv(creatorTest2).pack(p1).on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'success',
      data: 'ok: p1Srv=2',
    });
  });
});

describe('packages fails', () => {
  it('package fail handler called only if this packaged failed', async () => {
    expect.assertions(11);

    const steps: string[] = [];

    const cr1: MiddlewareCreator<{ cr1SrvFail: boolean }, { cr1Srv: string }, Err<'cr1_Err1'>> = (
      options
    ) => {
      return async (request) => {
        steps.push('cr1 req');

        if (options.cr1SrvFail) {
          steps.push('cr1 Err1');
          return fail('cr1_Err1');
        }

        return addService(request, {
          cr1Srv: 'cr1Srv',
        });
      };
    };

    const p1: Package<
      { p1SrvFail1: boolean; p1SrvThrows: boolean; p1SrvFail2: boolean },
      { p1Srv: string },
      Err<'p1_Srv_Err1'>,
      never,
      never,
      string,
      Err<'p1_Fail_Err1'>,
      Err<'p1_Srv_Err1'>
    > = {
      srv: (options, { throws }) => {
        if (options.p1SrvThrows) {
          steps.push('p1 Srv Throws');

          throws<Err<'p1SrvThrows'>>('p1SrvThrows');
        }

        return async (request) => {
          steps.push('p1 req');

          if (request.options.p1SrvFail1) {
            steps.push('p1 Srv Err1');

            return fail('p1_Srv_Err1');
          }

          return addService(request, {
            p1Srv: 'p1Srv',
          });
        };
      },

      fail: async ({ error }) => {
        steps.push('p1 fail');

        return ok(`p1 fail: ${error.type}`);
      },
    };

    const res = creator(cr1)
      .fail(async () => {
        steps.push('f1');
        return ok('f1');
      })
      .pack(p1)
      .fail(async () => {
        steps.push('f2');
        return ok('f2');
      })
      .ok(async () => {
        steps.push('ok');
        return ok('ok');
      })
      .on(safe);

    await expect(req(res)).resolves.toMatchObject({
      status: 'success',
      data: 'ok',
    });

    expect(steps).toStrictEqual(['cr1 req', 'p1 req', 'ok']);

    reset(steps);
    expect(steps).toStrictEqual([]);

    await expect(req(res.opt({ cr1SrvFail: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual(['cr1 req', 'cr1 Err1', 'f1', 'f2']);

    reset(steps);
    expect(steps).toStrictEqual([]);

    await expect(req(res.opt({ p1SrvFail1: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual(['cr1 req', 'p1 req', 'p1 Srv Err1', 'p1 fail', 'f2']);

    reset(steps);
    expect(steps).toStrictEqual([]);

    await expect(req(res.opt({ p1SrvThrows: true, p1SrvFail1: true }))).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual(['p1 Srv Throws', 'p1 fail', 'f2']);
  });
});
