import { Err, fail, ok } from 'lambda-res';

import {
  createMiddlewareLifecycle,
  createHandlerLifecycle,
  createLifecycle,
  disconnectLifecycle,
  join,
  glue,
  glueFailure,
  HandlerError,
  ServiceContainer,
} from '../index';

import {
  creatorTest1,
  creatorTest2,
  creatorTest3,
  creatorTest4Error,
  creatorTest5Error,
  createRequest,
  createErrorRequest,
  TestError,
} from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('middleware utils', () => {
  it('middleware creator lifecycle defaults', async () => {
    expect.assertions(1);

    const lc = createMiddlewareLifecycle();

    lc.gen(1);

    expect(() => {
      lc.throws<Err>('Err');
    }).toThrow('MiddlewareFail');
  });

  it('middleware lifecycle defaults', async () => {
    expect.assertions(18);

    const lc = createLifecycle();

    expect(lc.errored()).toStrictEqual(-1);

    const [l1, l2] = disconnectLifecycle(lc);

    expect(l1.partial()).toStrictEqual(lc.partial());
    expect(l2.partial()).toStrictEqual(lc.partial());

    expect(l1.errored()).toStrictEqual(-1);
    lc.error(1);
    expect(l1.errored()).toStrictEqual(1);

    l1.threw(1);
    expect(lc.throws()).toStrictEqual(1);
    expect(l1.throws()).toStrictEqual(1);
    expect(l2.throws()).toStrictEqual(1);

    l2.threw(2);
    expect(lc.throws()).toStrictEqual(2);
    expect(l1.throws()).toStrictEqual(2);
    expect(l2.throws()).toStrictEqual(2);

    l2.error(2);
    expect(l2.errored()).toStrictEqual(1);
    expect(lc.errored()).toStrictEqual(1);
    expect(l2.errored()).toStrictEqual(1);

    await expect(l1.destroyed()).resolves.toBeUndefined();
    await expect(l2.destroyed()).resolves.toBeUndefined();
    await expect(l1.ended()).resolves.toBeUndefined();
    await expect(l2.ended()).resolves.toBeUndefined();
  });

  it('connect 2 middleware creators', async () => {
    expect.assertions(2);

    const creatorTest12 = glue(creatorTest1)(creatorTest2);

    const response = await creatorTest12({ op1: '1', op2: '2' }, createMiddlewareLifecycle())(
      createRequest({}),
      createLifecycle()
    );

    expect(response.isOk()).toStrictEqual(true);

    expect(response.ok()).toMatchObject({
      service: { test2: '2', test1: '1' },
    });
  });

  it('connect 3 middleware creators', async () => {
    expect.assertions(2);

    const creatorTest123 = glue(glue(creatorTest1)(creatorTest2))(creatorTest3);

    const response = await creatorTest123(
      { op1: '1', op2: '2', op3: '3' },
      createMiddlewareLifecycle()
    )(createRequest({}), createLifecycle());

    expect(response.isOk()).toStrictEqual(true);

    expect(response.isOk() ? response.data : {}).toMatchObject({
      service: { test2: '2', test1: '1', test3: '3' },
    });
  });

  it('fail to connect if middleware returns error', async () => {
    expect.assertions(2);

    const creatorTest12 = glue(creatorTest1)(creatorTest4Error);

    const response = await creatorTest12({ op1: '1', op4: '1' }, createMiddlewareLifecycle())(
      createRequest({}),
      createLifecycle()
    );

    expect(response.status).toStrictEqual('error');

    expect(response.status === 'error' ? response.error.type : null).toStrictEqual('err4');
  });

  it('returns first failed middleware error', async () => {
    expect.assertions(2);

    const creatorTest12 = glue(creatorTest4Error)(creatorTest5Error);

    const response = await creatorTest12({ op4: '1', op5: '1' }, createMiddlewareLifecycle())(
      createRequest({}),
      createLifecycle()
    );

    expect(response.status).toStrictEqual('error');

    expect(response.status === 'error' ? response.error.type : {}).toStrictEqual('err4');
  });
});

describe('handlers utils', () => {
  it('handler lifecycle defaults', async () => {
    expect.assertions(1);

    const lc = createHandlerLifecycle();

    expect(lc.stops()).toStrictEqual(false);
  });

  it('not reject if first callback not returning errors', async () => {
    expect.assertions(2);

    const successes = join(
      join(
        async (_r) => {
          return ok('1');
        },
        async (_r) => {
          return ok('1');
        }
      ),
      async (_r) => {
        return ok(2);
      }
    );

    const resOk = await successes(
      createRequest({}),
      {},
      createHandlerLifecycle(),
      createLifecycle()
    );

    expect(resOk).toMatchObject({ status: 'success', data: 2 });

    const errors: HandlerError<ServiceContainer, string, string | number, never> = glueFailure(
      glueFailure(
        async (_r) => {
          return ok('1');
        },
        async (_r) => {
          return ok('1');
        }
      ),
      async (_r) => {
        return ok(2);
      }
    );

    const resErr = await errors(
      createErrorRequest('1'),
      {},
      createHandlerLifecycle(),
      createLifecycle()
    );

    expect(resErr).toMatchObject({ status: 'success', data: 2 });
  });

  it('will reject if first callback has errors', async () => {
    expect.assertions(4);

    const successes = join(
      async (_r) => {
        return fail<TestError<'err'>>('err');
      },
      async (_r) => {
        return ok(2);
      }
    );

    const resOk = await successes(
      createRequest({}),
      {},
      createHandlerLifecycle(),
      createLifecycle()
    );

    expect(resOk).toMatchObject({ status: 'error', error: { type: 'err' } });

    const errors = glueFailure(
      async (_r) => {
        return fail<TestError<'err'>>('err');
      },
      async (_r) => {
        return ok(2);
      }
    );

    const resErr = await errors(
      createErrorRequest('1'),
      {},
      createHandlerLifecycle(),
      createLifecycle()
    );

    expect(resErr).toMatchObject({ status: 'error', error: { type: 'err' } });

    let earlyReturns = false;

    const errors2 = glueFailure(
      async (_r, _o, { returns }) => {
        returns(() => {
          return earlyReturns;
        });

        return ok('1');
      },
      async (_r) => {
        return ok('2');
      }
    );

    const resErr2 = await errors2(
      createErrorRequest('1'),
      {},
      createHandlerLifecycle(),
      createLifecycle()
    );

    expect(resErr2).toMatchObject({ status: 'success', data: '2' });

    earlyReturns = true;

    const resErr3 = await errors2(
      createErrorRequest('1'),
      {},
      createHandlerLifecycle(),
      createLifecycle()
    );

    expect(resErr3).toMatchObject({ status: 'success', data: '1' });
  });
});
