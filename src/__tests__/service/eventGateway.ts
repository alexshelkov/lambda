import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';

import { ok } from '@alexshelkov/result';

import { eventGatewayService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('eventGateway', () => {
  it('returns 400 EventGatewayRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventGatewayService);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
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

    const handle = resOk.req() as APIGatewayProxyHandler;

    expect(
      await handle(
        createEvent({ httpMethod: 'GET', resource: 'test' } as APIGatewayProxyEvent),
        createContext(),
        () => {},
      ),
    ).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
