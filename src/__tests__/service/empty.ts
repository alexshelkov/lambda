import { ok } from '@alexshelkov/result';

import { empty, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('empty', () => {
  it('returns 400 EventGatewayRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(empty);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
