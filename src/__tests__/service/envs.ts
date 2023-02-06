import { ok } from 'lambda-res';

import { empty, envs, envsLoader, creator, createContext, createEvent } from '../../index';

describe('envs', () => {
  it('returns error if envs not provided', async () => {
    expect.assertions(1);

    const res = creator(empty)
      .opt({ envs: ['e1'] as const })
      .srv(envs);

    await expect(res.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"name":"e1","type":"EnvsNotExist"}}',
    });
  });

  it('load envs from process.env by default', async () => {
    expect.assertions(1);

    process.env.E1 = 'test e1';
    process.env.TEST_CAMEL_CASE = 'test camelcase';

    const res = creator(empty)
      .opt({ envs: ['e1', 'testCamelCase'] as const })
      .srv(envs);

    const resOk = res.ok(
      ({
        service: {
          envs: { e1, testCamelCase },
        },
      }) => {
        return Promise.resolve(ok(`success: ${e1}:${testCamelCase}`));
      }
    );

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success: test e1:test camelcase"}',
    });
  });

  it('using env loader', async () => {
    expect.assertions(1);

    process.env.E1 = 'test';

    const res = creator(envsLoader)
      .opt({
        envs: ['e1'] as const,
      })
      .srv(envs);

    const resOk = res.ok(
      async ({
        service: {
          envs: { e1 },
          getEnv,
        },
      }) => {
        return ok(`success: ${e1}:${(await getEnv('e1')) ?? ''}`);
      }
    );

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success: test:test"}',
    });
  });

  it('using custom env loader', async () => {
    expect.assertions(1);

    const res = creator(envsLoader)
      .opt({
        envs: ['e1'] as const,
        // eslint-disable-next-line @typescript-eslint/require-await
        getEnv: async () => {
          return 'test';
        },
      })
      .srv(envs);

    const resOk = res.ok(
      async ({
        service: {
          envs: { e1 },
          getEnv,
        },
      }) => {
        return ok(`success: ${e1}:${(await getEnv('')) ?? ''}`);
      }
    );

    await expect(resOk.req()(createEvent(), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success: test:test"}',
    });
  });
});
