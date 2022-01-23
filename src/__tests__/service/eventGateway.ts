import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';

import { ok } from 'lambda-res';

import { eventGatewayService, creator, createContext, createEvent } from '../../index';

describe('eventGateway', () => {
  it('returns 400 EventGatewayRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventGatewayService);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    const handle = resOk.req() as APIGatewayProxyHandler;

    await expect(handle(createEvent(), createContext(), () => {})).resolves.toMatchObject({
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

    await expect(
      handle(
        createEvent({ httpMethod: 'GET', resource: 'test' } as APIGatewayProxyEvent),
        createContext(),
        () => {}
      )
    ).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
