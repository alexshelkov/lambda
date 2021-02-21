import { ok } from '@alexshelkov/result';

import { eventGatewayService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('eventGateway', () => {
  it('returns 400 EventGatewayRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventGatewayService);

    const resOk = res.ok(() => Promise.resolve(ok('success')));

    expect(await resOk.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"EventGatewayRequestError"}}',
    });
  });

  it('parse APIGatewayProxyEvent event', async () => {
    expect.assertions(3);

    const res = creator(eventGatewayService);

    const resOk = res.ok(({ service: { eventGateway } }) => {
      expect(eventGateway.resource).toStrictEqual('test');
      expect(eventGateway.httpMethod).toStrictEqual('GET');

      return Promise.resolve(ok('success'));
    });

    expect(
      await resOk.req()(
        createEvent({ httpMethod: 'GET', resource: 'test' }),
        createContext(),
        () => {}
      )
    ).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
