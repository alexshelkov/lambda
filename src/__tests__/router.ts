import { Err, fail, ok } from '@alexshelkov/result';

import {
  creator,
  route,
  addService,
  MiddlewareCreator,
  Request,
  ServiceContainer,
  AwsEvent,
} from '../index';
import { createEvent, createContext, createRequest } from '../__stubs__';

type A1 = { a1: string };
type A2 = { a2: boolean };
type A = A1 | A2;

interface TestRouter extends ServiceContainer {
  a: A;
}

interface RefinedTestRouter extends TestRouter {
  a: A2;
}

const refine = (d: Request<AwsEvent, TestRouter>): Request<AwsEvent, RefinedTestRouter> | false => {
  return 'a2' in d.service.a ? (d as Request<AwsEvent, RefinedTestRouter>) : false;
};

const routerCreatorTest: MiddlewareCreator<{ a2: boolean }, TestRouter, Err> = (options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (Math.random() === -1) {
      return fail('err1');
    }

    return addService(request, {
      a: options.a2 ? { a2: true } : { a1: '1' },
    });
  };
};

describe('router', () => {
  it('works with raw handlers', async () => {
    expect.assertions(2);

    const r1 = route(refine);

    const h1 = r1(() => {
      return Promise.resolve(ok('will not be triggered'));
    });

    const res1 = await h1(createRequest({ a: { a1: '1' } }), {});

    expect(res1).toMatchObject({ status: 'error', error: { type: 'Skipped' } });

    const h2 = r1((request) => {
      return Promise.resolve(ok(`will be triggered: ${request.service.a.a2 ? 'ok' : 'bad'}`));
    });

    const res2 = await h2(createRequest({ a: { a2: true } }), {});

    expect(res2).toMatchObject({ status: 'success', data: 'will be triggered: ok' });
  });

  it('works with creator', async () => {
    expect.assertions(2);

    const srv = creator(routerCreatorTest);

    const r1 = route(refine);

    const h1 = r1(() => {
      return Promise.resolve(ok('will not be triggered'));
    });

    const res1: unknown = await srv.ok(h1).req()(createEvent(), createContext());

    expect(res1).toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"Not implemented"}}',
    });

    const h2 = r1((request) => {
      return Promise.resolve(ok(`will be triggered: ${request.service.a.a2 ? 'ok' : 'bad'}`));
    });

    const res2: unknown = await srv.opt({ a2: true }).ok(h2).req()(createEvent(), createContext());

    expect(res2).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"will be triggered: ok"}',
    });
  });
});
