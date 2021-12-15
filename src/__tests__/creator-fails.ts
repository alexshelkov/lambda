import { ok } from 'lambda-res';
import { GetHandler, creator, raw, glue, glueFailure } from '../index';
import { createContext, createEvent, createMdl, createFail, reset } from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('createMdl and createFail mocks', () => {
  it('checks that createMdl and createFail mocks work as expected', async () => {
    expect.assertions(6);

    const steps1: string[] = [];
    const cr1 = createMdl('cr1', steps1);
    const f1 = createFail('f1', steps1);

    const res1 = creator(cr1).fail(f1).on(raw);

    await expect(() => {
      return res1.req()(createEvent(), createContext());
    }).rejects.toMatchObject({
      status: 'error',
      error: {
        type: 'NotImplemented',
      },
    });

    expect(steps1).toStrictEqual(['cr1 req']);

    const steps2: string[] = [];
    const cr2 = createMdl('cr2', steps2);
    const f2 = createFail('f2', steps2);

    const res2 = creator(cr2).fail(f2).on(raw);

    await expect(
      res2.opt({ throwError: 'cr2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps2).toStrictEqual(['cr2 req', 'cr2 fail', 'f2 runs']);

    const res3 = res2.opt({ throwService: true }).ok(async ({ service: { cr2Throws } }) => {
      cr2Throws();
      return ok('success');
    });

    reset(steps2);

    await expect(
      res3.req()(createEvent({ throwError: 'cr2' }), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps2).toStrictEqual(['cr2 req', 'cr2 service fail', 'f2 runs']);
  });
});

describe('fails error handlers not called if registered earlier than services', () => {
  it('runs all fails handlers if they registered later than service', async () => {
    expect.assertions(4);

    const steps1: string[] = [];
    const cr1 = createMdl('cr1', steps1);
    const cr2 = createMdl('cr2', steps1);
    const f1 = createFail('f1', steps1);
    const f2 = createFail('f2', steps1);

    const res1 = creator(cr1).srv(cr2).fail(f1).fail(f2).on(raw);

    await expect(
      res1.opt({ throwError: 'cr1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps1).toStrictEqual(['cr1 req', 'cr1 fail', 'f1 runs', 'f2 runs']);

    const steps2: string[] = [];
    const cr3 = createMdl('cr3', steps2);
    const cr4 = createMdl('cr4', steps2);
    const f3 = createFail('f3', steps2);
    const f4 = createFail('f4', steps2);

    const res2 = creator(cr3).srv(cr4).fail(f3).fail(f4).on(raw);

    await expect(
      res2.opt({ throwError: 'cr4' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f4',
    });

    expect(steps2).toStrictEqual(['cr3 req', 'cr4 req', 'cr4 fail', 'f3 runs', 'f4 runs']);
  });

  it('handler not called if registered later than service', async () => {
    expect.assertions(4);

    const steps1: string[] = [];
    const cr1 = createMdl('cr1', steps1);
    const cr2 = createMdl('cr2', steps1);
    const f1 = createFail('f1', steps1);
    const f2 = createFail('f2', steps1);

    const res1 = creator(cr1).fail(f1).srv(cr2).fail(f2).on(raw);

    await expect(
      res1.opt({ throwError: 'cr1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps1).toStrictEqual(['cr1 req', 'cr1 fail', 'f1 runs', 'f2 runs']);

    const steps2: string[] = [];
    const cr3 = createMdl('cr3', steps2);
    const cr4 = createMdl('cr4', steps2);
    const f3 = createFail('f3', steps2);
    const f4 = createFail('f4', steps2);

    const res2 = creator(cr3).fail(f3).srv(cr4).fail(f4).on(raw);

    await expect(
      res2.opt({ throwError: 'cr4' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f4',
    });

    expect(steps2).toStrictEqual(['cr3 req', 'cr4 req', 'cr4 fail', 'f4 runs']);
  });

  it('overall handler and services registration works correctly', async () => {
    expect.assertions(12);

    const steps: string[] = [];
    const cr1 = createMdl('cr1', steps);
    const cr2 = createMdl('cr2', steps);
    const cr3 = createMdl('cr3', steps);
    const cr4 = createMdl('cr4', steps);
    const f1 = createFail('f1', steps);
    const f2 = createFail('f2', steps);
    const f3 = createFail('f3', steps);
    const f4 = createFail('f4', steps);
    const f5 = createFail('f5', steps);

    const res1 = creator(cr1)
      .fail(f1)
      .fail(f2)
      .srv(cr2)
      .fail(f3)
      .srv(cr3)
      .fail(f4)
      .srv(cr4)
      .fail(f5)
      .on(raw);

    await expect(
      res1.opt({ throwError: 'cr1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f5',
    });

    const cr1StepsFail = [
      'cr1 req',
      'cr1 fail',
      'f1 runs',
      'f2 runs',
      'f3 runs',
      'f4 runs',
      'f5 runs',
    ];
    expect(steps).toStrictEqual(cr1StepsFail);

    reset(steps);

    await expect(
      res1.opt({ throwError: 'cr2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f5',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr2 req',
      'cr2 fail',
      'f3 runs',
      'f4 runs',
      'f5 runs',
    ]);

    reset(steps);

    await expect(
      res1.opt({ throwError: 'cr1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f5',
    });

    expect(steps).toStrictEqual(cr1StepsFail);

    reset(steps);

    await expect(
      res1.opt({ throwError: 'cr3' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f5',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr2 req',
      'cr3 req',
      'cr3 fail',
      'f4 runs',
      'f5 runs',
    ]);

    reset(steps);

    await expect(
      res1.opt({ throwError: 'cr4' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f5',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr2 req',
      'cr3 req',
      'cr4 req',
      'cr4 fail',
      'f5 runs',
    ]);

    reset(steps);

    await expect(
      res1.opt({ throwError: 'cr3', throwMdl: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f5',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr2 req',
      'cr3 req',
      'cr3 throws',
      'f4 runs',
      'f5 runs',
    ]);
  });

  it('parallel exceptions are handled properly', async () => {
    expect.assertions(1);

    const steps: string[] = [];
    const cr1 = createMdl('cr1', steps);
    const cr2 = createMdl('cr2', steps);
    const cr3 = createMdl('cr3', steps);
    const f1 = createFail('f1', steps);
    const f2 = createFail('f2', steps);
    const f3 = createFail('f3', steps);
    const f4 = createFail('f4', steps);

    const res1 = creator(cr1)
      .fail(f1)
      .srv(cr2)
      .fail(f2)
      .srv(cr3)
      .fail(f3)
      .fail(f4)
      .ok(async ({ service: { cr2Throws, cr3Throws } }) => {
        if (cr2Throws) {
          cr2Throws();
        }

        if (cr3Throws) {
          cr3Throws();
        }

        return ok('success');
      })
      .on(raw);

    const req = res1.opt({ throwService: true }).req();

    await Promise.all([
      req(createEvent({ name: 'r1_', throwError: 'cr2' }), createContext()),
      req(createEvent({ name: 'r2_', throwError: 'cr3' }), createContext()),
    ]);

    expect(
      steps
        .filter((s) => {
          // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
          return s.match(/runs/);
        })
        .sort()
    ).toStrictEqual(['r1_f2 runs', 'r1_f3 runs', 'r1_f4 runs', 'r2_f3 runs', 'r2_f4 runs']);
  });
});

describe('works with fails', () => {
  it('works with service errors', async () => {
    expect.assertions(4);

    const steps1: string[] = [];
    const cr1 = createMdl('cr1', steps1);
    const cr2 = createMdl('cr2', steps1);
    const f1 = createFail('f1', steps1);
    const f2 = createFail('f2', steps1);

    const error: GetHandler<typeof cr1, string, never> = async ({ service: { cr1Throws } }) => {
      cr1Throws();
      return ok('success');
    };

    const res1 = creator(cr1).fail(f1).srv(cr2).fail(f2).ok(error).on(raw);

    await expect(
      res1.opt({ throwError: 'cr1', throwService: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps1).toStrictEqual(['cr1 req', 'cr2 req', 'cr1 service fail', 'f1 runs', 'f2 runs']);

    const steps2: string[] = [];
    const cr3 = createMdl('cr3', steps2);
    const cr4 = createMdl('cr4', steps2);
    const f3 = createFail('f3', steps2);
    const f4 = createFail('f4', steps2);

    const error2: GetHandler<typeof cr3, string, never> = async ({ service }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      (service as any).cr4Throws();
      return ok('success');
    };

    const res2 = creator(cr3).fail(f3).srv(cr4).fail(f4).ok(error2).on(raw);

    await expect(
      res2.opt({ throwError: 'cr4', throwService: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f4',
    });

    expect(steps2).toStrictEqual(['cr3 req', 'cr4 req', 'cr4 service fail', 'f4 runs']);
  });

  it('works with creator errors', async () => {
    expect.assertions(6);

    const steps: string[] = [];
    const cr1 = createMdl('cr1', steps);
    const cr2 = createMdl('cr2', steps);
    const f1 = createFail('f1', steps);
    const f2 = createFail('f2', steps);

    const res1 = creator(cr1).fail(f1).srv(cr2).fail(f2).on(raw);

    await expect(
      res1.opt({ throwError: 'cr2', throwCreator: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual(['cr2 create fail', 'f2 runs']);

    reset(steps);

    const error: GetHandler<typeof cr2, string, never> = async ({ service: { cr2Throws } }) => {
      cr2Throws();
      return ok('success');
    };
    const f3 = createFail('f3', steps);

    const res3 = res1.ok(error).fail(f3).onOk(raw);

    await expect(
      res3.opt({ throwError: 'cr2', throwService: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f3',
    });

    expect(steps).toStrictEqual(['cr1 req', 'cr2 req', 'cr2 service fail', 'f2 runs', 'f3 runs']);

    reset(steps);

    await expect(
      res1.opt({ throwError: 'cr2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual(['cr1 req', 'cr2 req', 'cr2 fail', 'f2 runs']);
  });

  it('works with errors inside destroy lifecycle', async () => {
    expect.assertions(2);

    const steps: string[] = [];
    const cr1 = createMdl('cr1', steps);
    const cr2 = createMdl('cr2', steps);
    const f1 = createFail('f1', steps);
    const f2 = createFail('f2', steps);

    const res = creator(cr1)
      .fail(f1)
      .srv(cr2)
      .fail(f2)
      .ok(async (_r, _o, { returns }) => {
        returns(() => {
          steps.push('ok1 returns');
          return true;
        });
        steps.push('ok1 runs');
        return ok('ok1');
      })
      .ok(async () => {
        expect(true).toStrictEqual(true); // must not work!
        return ok('ok2');
      })
      .on(raw);

    await expect(
      res.opt({ throwError: 'cr2', destroyThrow: true }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr2 req',
      'ok1 runs',
      'ok1 returns',
      'cr2 destroy',
      'f2 runs',
    ]);
  });
});

describe('works with glued middlewares and handlers', () => {
  it('works with glued middlewares', async () => {
    expect.assertions(8);

    const steps: string[] = [];

    const g1 = glue(createMdl('g1', steps))(createMdl('g2', steps));
    const cr1 = createMdl('cr1', steps);
    const cr2 = createMdl('cr2', steps);
    const f1 = createFail('f1', steps);
    const f2 = createFail('f2', steps);
    const f3 = createFail('f3', steps);

    const res = creator(cr1).fail(f1).srv(g1).fail(f2).srv(cr2).fail(f3).on(raw);

    await expect(
      res.opt({ throwError: 'cr1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f3',
    });

    expect(steps).toStrictEqual(['cr1 req', 'cr1 fail', 'f1 runs', 'f2 runs', 'f3 runs']);

    reset(steps);

    await expect(
      res.opt({ throwError: 'cr2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f3',
    });

    expect(steps).toStrictEqual(['cr1 req', 'g1 req', 'g2 req', 'cr2 req', 'cr2 fail', 'f3 runs']);

    reset(steps);

    await expect(
      res.opt({ throwError: 'g1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f3',
    });

    expect(steps).toStrictEqual(['cr1 req', 'g1 req', 'g1 fail', 'f2 runs', 'f3 runs']);

    reset(steps);

    await expect(
      res.opt({ throwError: 'g2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f3',
    });

    expect(steps).toStrictEqual(['cr1 req', 'g1 req', 'g2 req', 'g2 fail', 'f2 runs', 'f3 runs']);
  });

  it('works with glued handlers', async () => {
    expect.assertions(6);

    const steps: string[] = [];

    const cr1 = createMdl('cr1', steps);
    const cr2 = createMdl('cr2', steps);
    const cr3 = createMdl('cr3', steps);
    const g1 = glueFailure(createFail('g1', steps), createFail('g2', steps));
    const f1 = createFail('f1', steps);
    const f2 = createFail('f2', steps);

    const res = creator(cr1).fail(f1).srv(cr2).fail(g1).srv(cr3).fail(f2).on(raw);

    await expect(
      res.opt({ throwError: 'cr1' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr1 fail',
      'f1 runs',
      'g1 runs',
      'g2 runs',
      'f2 runs',
    ]);

    reset(steps);

    await expect(
      res.opt({ throwError: 'cr2' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual([
      'cr1 req',
      'cr2 req',
      'cr2 fail',
      'g1 runs',
      'g2 runs',
      'f2 runs',
    ]);

    reset(steps);

    await expect(
      res.opt({ throwError: 'cr3' }).req()(createEvent(), createContext())
    ).resolves.toMatchObject({
      status: 'success',
      data: 'f2',
    });

    expect(steps).toStrictEqual(['cr1 req', 'cr2 req', 'cr3 req', 'cr3 fail', 'f2 runs']);
  });
});
