import { Err, fail, ok } from 'lambda-res';

import {
  addService,
  createContext,
  createErrorRequest,
  createEvent,
  createHandlerLifecycle,
  createRequest,
  creator,
  AwsEvent,
  HandlerError,
  MiddlewareCreator,
  Request,
  RequestError,
  route,
  routeError,
  ServiceContainer,
  ServiceOptions,
} from '../index';

type A1 = { a1: string };
type A2 = { a2: boolean };
type A = A1 | A2;

interface TestRouter extends ServiceContainer {
  a: A;
}

interface RefinedTestRouter extends TestRouter {
  a: A2;
}

type E1 = Err<'err1'>;
type E2 = Err<'err2'>;
type RouterErrors = E1 | E2;

const refine = (
  request: Request<AwsEvent, ServiceOptions, TestRouter>
): Request<AwsEvent, ServiceOptions, RefinedTestRouter> | false => {
  return 'a2' in request.service.a
    ? (request as Request<AwsEvent, ServiceOptions, RefinedTestRouter>)
    : false;
};

const refineError = (
  request: RequestError<AwsEvent, ServiceOptions, TestRouter, RouterErrors>
): RequestError<AwsEvent, ServiceOptions, RefinedTestRouter, E2> | false => {
  return request.error.type === 'err2'
    ? (request as RequestError<AwsEvent, ServiceOptions, RefinedTestRouter, E2>)
    : false;
};

const routerCreatorTest: MiddlewareCreator<
  { a2: boolean; err: string },
  TestRouter,
  RouterErrors
> = (options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (options.err === 'err1' || options.err === 'err2') {
      return fail(options.err);
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

    const reqObj1 = createRequest({ a: { a1: '1' } });
    const res1 = await h1(reqObj1, createHandlerLifecycle(reqObj1));

    expect(res1).toMatchObject({ status: 'error', error: { type: 'Skipped' } });

    const h2 = r1((request) => {
      return Promise.resolve(ok(`will be triggered: ${request.service.a.a2 ? 'ok' : 'bad'}`));
    });

    const reqObj2 = createRequest({ a: { a2: true } });
    const res2 = await h2(reqObj2, createHandlerLifecycle(reqObj2));

    expect(res2).toMatchObject({ status: 'success', data: 'will be triggered: ok' });
  });

  it('works with raw error handlers', async () => {
    expect.assertions(2);

    const r1 = routeError(refineError);

    const e1 = r1(() => {
      return Promise.resolve(ok('will not be triggered'));
    });

    const reqObj1 = createErrorRequest({ type: 'err1' });
    const res1 = await e1(reqObj1, createHandlerLifecycle(reqObj1));

    expect(res1).toMatchObject({ status: 'error', error: { type: 'Skipped' } });

    const r2 = routeError(refineError);

    const e2 = r2(() => {
      return Promise.resolve(ok('will be triggered'));
    });

    const reqObj2 = createErrorRequest({ type: 'err2' });
    const res2 = await e2(reqObj2, createHandlerLifecycle(reqObj2));

    expect(res2).toMatchObject({ status: 'success', data: 'will be triggered' });
  });

  it('works with creator', async () => {
    expect.assertions(4);

    const srv = creator(routerCreatorTest);

    const r1 = route(refine);
    const r2 = routeError(refineError);

    const h1 = r1(() => {
      return Promise.resolve(ok('will not be triggered'));
    });

    const e1 = r2(() => {
      return Promise.resolve(ok('will not be triggered'));
    });

    const srv1 = srv.ok(h1).fail(e1);

    await expect(srv1.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"NotImplemented"}}',
    });

    await expect(
      srv1.opt({ err: 'err1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"err1"}}',
    });

    const h2 = r1((request) => {
      return Promise.resolve(ok(`will be triggered: ${request.service.a.a2 ? 'ok' : 'bad'}`));
    });

    const e2o: HandlerError<RefinedTestRouter, E2, string, never, E2> = () => {
      return Promise.resolve(ok('will be triggered'));
    };

    const e2 = r2(e2o);

    const srv2 = srv
      .ok(h2)
      .fail(e2)
      // eslint-disable-next-line @typescript-eslint/require-await
      .fail(async (request) => {
        const err: E1 = request.error;

        return fail<Err>(`Skipped ${err.type}`, { skip: true });
      });

    await expect(
      srv2.opt({ a2: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"will be triggered: ok"}',
    });

    await expect(
      srv2.opt({ err: 'err2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"will be triggered"}',
    });
  });
});
