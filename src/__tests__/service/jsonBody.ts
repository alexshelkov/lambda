import { ok } from 'lambda-res';

import { jsonBodyService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('jsonBody', () => {
  it('returns 400 JsonRequestError for malformed input', async () => {
    expect.assertions(2);

    const res = creator(jsonBodyService);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"JsonRequestError"}}',
    });

    await expect(resOk.req()(createEvent({ body: 100 }), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"JsonRequestError"}}',
    });
  });

  it('return 400 JsonBodyParseError for malformed json', async () => {
    expect.assertions(1);

    const res = creator(jsonBodyService);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    await expect(
      resOk.req()(createEvent({ body: '"a":"a1"}' }), createContext())
    ).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"JsonBodyParseError","message":"Unexpected token : in JSON at position 3"}}',
    });
  });

  it('return 400 JsonBodyParseError for null or not an object input', async () => {
    expect.assertions(2);

    const res = creator(jsonBodyService);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    await expect(
      resOk.req()(createEvent({ body: 'null' }), createContext())
    ).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"JsonBodyParseError","message":"Parsed object is is null"}}',
    });

    await expect(
      resOk.req()(createEvent({ body: '"123"' }), createContext())
    ).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"JsonBodyParseError","message":"Parsed object is not an object"}}',
    });
  });

  it('parse json correctly', async () => {
    expect.assertions(2);

    const res = creator(jsonBodyService);

    const resOk = res.ok(({ service: { jsonBody } }) => {
      expect(jsonBody.a).toStrictEqual('a1');

      return Promise.resolve(ok('success'));
    });

    await expect(
      resOk.req()(createEvent({ body: '{"a":"a1"}' }), createContext())
    ).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
