import { fail, ok } from '@alexshelkov/result';

import { connect, join } from '../index';

import {
  creatorTest1,
  creatorTest2,
  creatorTest3,
  creatorTest4Error,
  creatorTest5Error,
  createRequest,
  TestError,
} from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('middleware utils', () => {
  it('connect 2 middleware creators', async () => {
    expect.assertions(2);

    const creatorTest12 = connect(creatorTest1)(creatorTest2);

    const response = await creatorTest12(
      { op1: '1', op2: '2' },
      { destroy: () => {} }
    )(createRequest({}));

    expect(response.isOk()).toStrictEqual(true);

    expect(response.ok()).toMatchObject({
      service: { test2: '2', test1: '1' },
    });
  });

  it('connect 3 middleware creators', async () => {
    expect.assertions(2);

    const creatorTest123 = connect(connect(creatorTest1)(creatorTest2))(creatorTest3);

    const response = await creatorTest123(
      { op1: '1', op2: '2', op3: '3' },
      { destroy: () => {} }
    )(createRequest({}));

    expect(response.isOk()).toStrictEqual(true);

    expect(response.isOk() ? response.data : {}).toMatchObject({
      service: { test2: '2', test1: '1', test3: '3' },
    });
  });

  it('fail to connect if middleware returns error', async () => {
    expect.assertions(2);

    const creatorTest12 = connect(creatorTest1)(creatorTest4Error);

    const response = await creatorTest12(
      { op1: '1', op4: '1' },
      { destroy: () => {} }
    )(createRequest({}));

    expect(response.status).toStrictEqual('error');

    expect(response.status === 'error' ? response.error.type : null).toStrictEqual('err4');
  });

  it('returns first failed middleware error', async () => {
    expect.assertions(2);

    const creatorTest12 = connect(creatorTest4Error)(creatorTest5Error);

    const response = await creatorTest12(
      { op4: '1', op5: '1' },
      { destroy: () => {} }
    )(createRequest({}));

    expect(response.status).toStrictEqual('error');

    expect(response.status === 'error' ? response.error.type : {}).toStrictEqual('err4');
  });
});

describe('handlers utils', () => {
  it('not reject if first callback not returning errors', async () => {
    expect.assertions(1);

    const handlers = await join(
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
    )(createRequest({}), {});

    expect(handlers).toMatchObject({ status: 'success', data: 2 });
  });

  it('will reject if first callback has errors', async () => {
    expect.assertions(1);

    const handlers = await join(
      async (_r) => {
        return fail<TestError<'err'>>('err');
      },
      async (_r) => {
        return ok(2);
      }
    )(createRequest({}), {});

    expect(handlers).toMatchObject({ status: 'error', error: { type: 'err' } });
  });
});
