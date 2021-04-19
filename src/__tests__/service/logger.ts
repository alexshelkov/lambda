import { ok } from 'lambda-res';

import {
  loggerService,
  transportService,
  creator,
  transport as getTransport,
  logger as getLogger,
  resetLogger,
  resetTransport,
  MiddlewareCreator,
  LoggerService,
} from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('logger', () => {
  // eslint-disable-next-line jest/no-hooks
  beforeEach(() => {
    resetLogger();
    resetTransport();
  });

  it('logs everything to console', async () => {
    expect.assertions(7);

    const res = creator(transportService).srv(loggerService);

    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();

    const resOk = res.ok(({ service: { logger } }) => {
      logger.error('Test error');
      logger.warn('Test warn');
      logger.log('Test log');
      logger.info('Test info');
      logger.debug('Test debug');

      getTransport().send('log', ['Test transport service'], {});
      getLogger().log('Test logger service');

      return Promise.resolve(ok('success'));
    });

    await resOk.req()(createEvent({ event: 1 }), createContext());

    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith('Test error');
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalledWith('Test warn');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith('Test log');
    // eslint-disable-next-line no-console
    expect(console.info).toHaveBeenCalledWith('Test info');
    // eslint-disable-next-line no-console
    expect(console.debug).toHaveBeenCalledWith('Test debug');

    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith('Test transport service');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith('Test logger service');

    jest.restoreAllMocks();
  });

  it('logger will pass saved global meta and save event', async () => {
    expect.assertions(10);

    getTransport();
    getLogger().save({ test: 'test' });

    // eslint-disable-next-line @typescript-eslint/ban-types
    const cr: MiddlewareCreator<{ test1: string } | { test2: string }, {}, never, LoggerService> = (
      options
    ) => {
      // eslint-disable-next-line @typescript-eslint/require-await
      return async (r) => {
        expect(getTransport()).not.toBeUndefined();
        expect(getLogger()).not.toBeUndefined();

        expect(getLogger().meta().test).toStrictEqual('test');

        expect(r.service.logger.meta().test).toStrictEqual('test');
        expect(r.service.logger.meta().event).toMatchObject(options);

        return ok(r);
      };
    };

    const res1 = creator(transportService).srv(loggerService).srv(cr).opt({ test1: '1' });
    await res1.req()(createEvent({ test1: '1' }), createContext());

    const res2 = creator(transportService).srv(loggerService).srv(cr).opt({ test2: '2' });
    await res2.req()(createEvent({ test2: '2' }), createContext('test'));
  });
});
