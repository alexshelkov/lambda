import { ok } from 'lambda-res';

import { empty, creator, createContext, createEvent } from '../../index';

describe('empty', () => {
  it('returns 400 EventGatewayRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(empty);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
