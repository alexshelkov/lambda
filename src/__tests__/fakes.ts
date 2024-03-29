import { Err, fail, ok, Response, Result } from 'lambda-res';
import {
  Handler,
  MiddlewareCreator,
  GetEvent,
  GetOpt,
  GetService,
  JsonBodyService,
  createContext,
  createEvent,
  addService,
  creator,
  jsonBodyService,
  GetError,
  HandlerError,
} from '../index';
import { DefineAuthChallengeTriggerEvent, DefineAuthChallengeTriggerHandler } from 'aws-lambda';
import { creatorTest1 } from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

describe('fake services', () => {
  it('works with dummy logger', async () => {
    expect.assertions(4);

    type TransportOptions = {
      throwError?: boolean;
    };

    type Transport = {
      send: (message: string) => void;
    };

    interface DbWriteError extends Err {
      type: 'DbWriteError';
    }

    type TransportErrors = DbWriteError;

    let dbLogs: string[] = [];

    const dbLoggerCreator: MiddlewareCreator<
      TransportOptions,
      { transport: Transport },
      TransportErrors
    > = (options, lc) => {
      dbLogs = [];

      return async (request) => {
        const transport: Transport = {
          send: (message: string) => {
            if (options.throwError) {
              lc.throws<DbWriteError>('DbWriteError');
            }

            dbLogs.push(message);
          },
        };

        return addService(request, {
          transport,
        });
      };
    };

    type Logger = {
      log: (message: string) => void;
    };

    interface DummyError extends Err {
      type: 'DummyError';
    }

    type LoggerError = DummyError;

    const loggerCreator: MiddlewareCreator<
      // eslint-disable-next-line @typescript-eslint/ban-types
      {},
      { logger: Logger },
      LoggerError,
      { transport: Transport }
    > = () => {
      return async (request) => {
        const logger: Logger = {
          log: (message: string) => {
            return request.service.transport.send(
              `${new Date().toISOString().split('T')[0] || ''}: ${message}`
            );
          },
        };

        return addService(request, {
          logger,
        });
      };
    };

    const res = creator(dbLoggerCreator).srv(loggerCreator);

    const resOk = res.ok(async ({ service: { logger } }) => {
      logger.log('test message 1');

      return ok(true);
    });

    let error: null | 'Error: DbWriteError' | 'Error: DummyError' = null;

    const resFail = resOk.fail(async ({ error: { type } }) => {
      if (type === 'DbWriteError') {
        error = 'Error: DbWriteError';
      } else if (type === 'DummyError') {
        error = 'Error: DummyError';
      }

      return ok(true);
    });

    await resFail.req()(createEvent(), createContext());

    expect(error).toBeNull();
    expect(dbLogs).toContain(`${new Date().toISOString().split('T')[0] || ''}: test message 1`);

    const res2 = creator(dbLoggerCreator).srv(loggerCreator).opt({ throwError: true });

    const handle: Handler<
      GetService<typeof res2>,
      boolean,
      number,
      GetEvent<typeof res2>,
      GetOpt<typeof res2>
    > = async ({ service: { logger } }) => {
      logger.log('test message 2');

      return ok(true);
    };

    const res2Ok = res2.ok(handle);

    const res2Fail = res2Ok.fail(async ({ error: { type } }) => {
      if (type === 'DbWriteError') {
        error = 'Error: DbWriteError';
      } else if (type === 'DummyError') {
        error = 'Error: DummyError';
      }

      return ok(true);
    });

    await res2Fail.req()(createEvent(), createContext());

    expect(error).toStrictEqual('Error: DbWriteError');
    expect(dbLogs).toHaveLength(0);
  });

  describe('works with fake database interface', () => {
    type Connection = {
      id: number;
      query: () => unknown;
    };

    type DbNoConnection = Err<'NoConnection'>;
    type DbConnectionErrors = Err<'WrongPassword'> | DbNoConnection;
    type DbDisconnectionErrors = Err<'NotConnected'>;

    class FakeDb {
      connectionId = 0;

      dontConnect = false;

      throwFatal = false;

      wrongPassword = false;

      getConnection = (): Connection => {
        if (!this.connectionId) {
          if (this.throwFatal) {
            throw new Error('Fatal connection error');
          } else {
            throw new Error('NoConnection');
          }
        }

        return {
          id: this.connectionId,
          query: () => {
            return [{ id: 1, name: 'jay' }];
          },
        };
      };

      connect = async (): Response<number, DbConnectionErrors> => {
        if (this.wrongPassword) {
          return fail('WrongPassword');
        }

        this.connectionId = 1;

        if (this.dontConnect) {
          this.connectionId = 0;
        }

        return ok(this.connectionId);
      };

      disconnect = async (): Response<number, DbDisconnectionErrors> => {
        if (!this.connectionId) {
          return fail('NotConnected');
        }

        const tmp = this.connectionId;

        this.connectionId = 0;

        return ok(tmp);
      };
    }

    it('fake db is working as expected', async () => {
      expect.assertions(6);

      const db = new FakeDb();
      expect(db.connectionId).toStrictEqual(0);
      expect((await db.connect()).ok()).toStrictEqual(1);
      expect(db.connectionId).toStrictEqual(1);
      expect(db.getConnection().query()).toContainEqual({ id: 1, name: 'jay' });
      expect((await db.disconnect()).ok()).toStrictEqual(1);
      expect(db.connectionId).toStrictEqual(0);
    });

    type DbServiceOptions = {
      db: FakeDb;
    };
    type DbService = {
      getConnection: () => Connection;
    };

    type DbServiceConnectNoDbError = Err<'DbServiceConnectNoDbError'>;
    type DbServiceTryConnectError = Err<'DbServiceTryConnectError'>;
    type DbServiceDestroyTryDisconnectError = Err<'DbServiceDestroyTryDisconnectError'>;
    type DbServiceErrors =
      | DbServiceConnectNoDbError
      | DbServiceTryConnectError
      | DbServiceDestroyTryDisconnectError;

    const dbService: MiddlewareCreator<DbServiceOptions, DbService, DbServiceErrors> = (
      options,
      { throws }
    ) => {
      return async (request, { destroy }) => {
        destroy(async () => {
          if (!options.db) {
            return;
          }

          await options.db.disconnect();
        });

        if (!options.db) {
          return fail('DbServiceConnectNoDbError');
        }

        const connRes = await options.db.connect();

        if (connRes.isErr()) {
          return fail('DbServiceTryConnectError', { message: connRes.err().type });
        }

        return addService(request, {
          getConnection: () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const get = options.db!.getConnection;

            try {
              return get();
            } catch (err) {
              if ((err as Error).message === 'NoConnection') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                throws<Err>('NoConnection');
              }

              throw err;
            }
          },
        });
      };
    };

    const out = async (result: Result<unknown, unknown>) => {
      return result.isOk() ? result.ok() : result.err();
    };

    const res = creator(dbService).onOk(out).onFail(out).onFatal(out);

    const res1 = res.ok(async ({ service: { getConnection } }) => {
      const connection = getConnection();

      const records = connection.query();

      return ok(records);
    });

    describe('service working', () => {
      it('fails if no db option provided', async () => {
        expect.assertions(1);

        await expect(res1.req()(createEvent(), createContext())).resolves.toMatchObject({
          type: 'DbServiceConnectNoDbError',
        });
      });

      it('return records if everything is good', async () => {
        expect.assertions(2);

        const db = new FakeDb();

        const res2 = res1.opt({
          db,
        });

        await expect(res2.req()(createEvent(), createContext())).resolves.toContainEqual({
          id: 1,
          name: 'jay',
        });

        expect(db.connectionId).toStrictEqual(0);
      });

      it('return errors if not connected', async () => {
        expect.assertions(6);

        const db = new FakeDb();

        db.dontConnect = true;
        db.throwFatal = true;

        const res2 = res1.opt({
          db,
        });

        await expect(res2.req()(createEvent(), createContext())).resolves.toMatchObject({
          message: 'Fatal connection error',
          cause: 'Error',
          type: 'FatalError',
        });

        expect(db.connectionId).toStrictEqual(0);

        db.throwFatal = false;

        await expect(res2.req()(createEvent(), createContext())).resolves.toMatchObject({
          type: 'NoConnection',
        });

        expect(db.connectionId).toStrictEqual(0);

        db.dontConnect = false;
        db.wrongPassword = true;

        await expect(res2.req()(createEvent(), createContext())).resolves.toMatchObject({
          type: 'DbServiceTryConnectError',
          message: 'WrongPassword',
        });

        expect(db.connectionId).toStrictEqual(0);
      });
    });
  });

  it('works with calc service', async () => {
    expect.assertions(4);

    type NumberService = { a: number; b: number };
    type NumberErrNaN = Err<'NaA'>;
    type NumberDependencies = JsonBodyService;

    // eslint-disable-next-line @typescript-eslint/ban-types
    const numbers: MiddlewareCreator<{}, NumberService, NumberErrNaN, NumberDependencies> = () => {
      return async (request) => {
        const body = request.service.jsonBody;

        if (!(Number.isFinite(body.a) && Number.isFinite(body.b))) {
          return fail<NumberErrNaN>('NaA');
        }

        const service = body as NumberService;

        return addService(request, service);
      };
    };

    type Options = { acceptFloat: boolean };
    type AdderService = { add: (a: number, b: number) => number };
    type AdderErrNoFloats = Err<'Float'>;

    const adder: MiddlewareCreator<Options, AdderService, AdderErrNoFloats> = (
      options,
      { throws }
    ) => {
      return async (request) => {
        const service: AdderService = {
          add: (a: number, b: number) => {
            if (!options.acceptFloat && !(Number.isInteger(a) && Number.isInteger(b))) {
              throws<AdderErrNoFloats>('Float');
            }

            return a + b;
          },
        };

        return addService(request, service);
      };
    };

    const handler: Handler<AdderService & NumberService, number, never> = async ({
      service: { a, b, add },
    }) => {
      return ok(add(a, b));
    };

    const lambda = creator(jsonBodyService).srv(numbers).srv(adder).ok(handler);

    let body = JSON.stringify({
      a: 1,
      b: 2,
    });

    await expect(lambda.req()(createEvent({ body }), createContext())).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":3}',
    });

    body = JSON.stringify({
      a: 'a',
      b: 2,
    });

    await expect(lambda.req()(createEvent({ body }), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"NaA"}}',
    });

    body = JSON.stringify({
      a: 1,
      b: 2.2,
    });

    await expect(lambda.req()(createEvent({ body }), createContext())).resolves.toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"Float"}}',
    });

    body = JSON.stringify({
      a: 1,
      b: 2.2,
    });

    await expect(
      lambda.opt({ acceptFloat: true }).req()(createEvent({ body }), createContext())
    ).resolves.toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":3.2}',
    });
  });

  describe('custom handlers', () => {
    const defineEvent = (): DefineAuthChallengeTriggerEvent => {
      return {
        version: '',
        region: '',
        userPoolId: '',
        triggerSource: 'DefineAuthChallenge_Authentication',
        userName: '',
        callerContext: {
          awsSdkVersion: '',
          clientId: '',
        },
        request: {
          userAttributes: {},
          session: [],
        },
        response: {
          challengeName: '',
          failAuthentication: false,
          issueTokens: false,
        },
      };
    };

    describe('will works with Cognito handlers', () => {
      type Event = { event: DefineAuthChallengeTriggerEvent; context: unknown };

      const res = creator(creatorTest1).ctx<Event>().opt({ op1: '1' });

      type ErrorType = GetError<typeof res>;
      type ServiceOpts = GetOpt<typeof res>;
      type ServiceType = GetService<typeof res>;
      type EventType = GetEvent<typeof res>;

      type Session = DefineAuthChallengeTriggerEvent['request']['session'][0] | undefined;

      const h1: Handler<ServiceType, Session, Err, EventType, ServiceOpts> = async (request) => {
        return ok(request.event.request.session[0]);
      };

      const e1: HandlerError<
        ServiceType,
        ErrorType,
        string,
        Err,
        never,
        EventType,
        ServiceOpts
      > = async () => {
        return fail('error');
      };

      const resOk = res.ok(h1);
      const resFail = resOk.fail(e1);

      const resTranOk = resFail.onOk(async (_r, { event }) => {
        event.response.issueTokens = true;
        event.response.challengeName = event.request.session[0]?.challengeName ?? '';

        return event;
      });

      const resTransErr = resTranOk.onFatal(async (r, { event }) => {
        (event as unknown as { badEvent: unknown }).badEvent = r.err();

        return event;
      });

      const handle = resTransErr.req();

      handle as DefineAuthChallengeTriggerHandler; // types must be compatible

      it('valid event', async () => {
        expect.assertions(1);

        const event = defineEvent();

        event.request.session[0] = {
          challengeName: 'SMS_MFA',
          challengeResult: true,
        };

        const savedEvent = JSON.parse(JSON.stringify(event)) as DefineAuthChallengeTriggerEvent;

        const response = await handle(createEvent(event), createContext());

        expect(response).toMatchObject({
          ...savedEvent,
          response: {
            ...savedEvent.response,
            challengeName: 'SMS_MFA',
            issueTokens: true,
          },
        } as DefineAuthChallengeTriggerEvent);
      });

      it('invalid event', async () => {
        expect.assertions(1);

        const response = await handle(
          createEvent({ badEvent: 'no' } as unknown as DefineAuthChallengeTriggerEvent),
          createContext()
        );

        expect(response).toMatchObject({
          badEvent: {
            type: 'FatalError',
            cause: 'TypeError',
            message: "Cannot read properties of undefined (reading 'session')",
          },
        });
      });
    });
  });
});
