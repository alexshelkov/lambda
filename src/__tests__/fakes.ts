import { Err, fail, ok, Response, Result } from '@alexshelkov/result';
import {
  Handler,
  MiddlewareCreator,
  GetEvent,
  GetOpt,
  GetService,
  addService,
  creator,
} from '../index';
import { createContext, createEvent } from '../__stubs__';

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
    > = (options) => {
      dbLogs = [];

      return async (request) => {
        const transport: Transport = {
          send: (message: string) => {
            if (options.throwError) {
              throw fail<DbWriteError>('DbWriteError');
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
              `${new Date().toISOString().split('T')[0]}: ${message}`
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
    expect(dbLogs).toContain(`${new Date().toISOString().split('T')[0]}: test message 1`);

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

    type DbNoConnection = { type: 'NoConnection' } & Err;
    type DbConnectionErrors = ({ type: 'WrongPassword' } & Err) | DbNoConnection;
    type DbDisconnectionErrors = { type: 'NotConnected' } & Err;

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
            throw fail<DbNoConnection>('NoConnection');
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

    type DbServiceConnectNoDbError = { type: 'DbServiceConnectNoDbError' } & Err;
    type DbServiceTryConnectError = { type: 'DbServiceTryConnectError' } & Err;
    type DbServiceDestroyTryDisconnectError = { type: 'DbServiceDestroyTryDisconnectError' } & Err;
    type DbServiceErrors =
      | DbServiceConnectNoDbError
      | DbServiceTryConnectError
      | DbServiceDestroyTryDisconnectError;

    const dbService: MiddlewareCreator<DbServiceOptions, DbService, DbServiceErrors> = (
      options
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
          getConnection: options.db.getConnection,
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

        expect(await res1.req()(createEvent(), createContext())).toMatchObject({
          type: 'DbServiceConnectNoDbError',
        });
      });

      it('return records if everything is good', async () => {
        expect.assertions(2);

        const db = new FakeDb();

        const res2 = res1.opt({
          db,
        });

        expect(await res2.req()(createEvent(), createContext())).toContainEqual({
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

        expect(await res2.req()(createEvent(), createContext())).toMatchObject({
          message: 'Fatal connection error',
          cause: 'Error',
          type: 'UncaughtError',
        });

        expect(db.connectionId).toStrictEqual(0);

        db.throwFatal = false;

        expect(await res2.req()(createEvent(), createContext())).toMatchObject({
          type: 'NoConnection',
        });

        expect(db.connectionId).toStrictEqual(0);

        db.dontConnect = false;
        db.wrongPassword = true;

        expect(await res2.req()(createEvent(), createContext())).toMatchObject({
          type: 'DbServiceTryConnectError',
          message: 'WrongPassword',
        });

        expect(db.connectionId).toStrictEqual(0);
      });
    });
  });
});
