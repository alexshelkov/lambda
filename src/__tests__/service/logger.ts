import { ok } from '@alexshelkov/result';

import { loggerService, transportService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('logger', () => {
  it('logs everything to console', async () => {
    expect.assertions(3);

    const res = creator(transportService).srv(loggerService);

    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();

    const resOk = res.ok(({ service: { logger } }) => {
      logger.error('Test error');
      logger.warn('Test warn');
      logger.log('Test log');

      return Promise.resolve(ok('success'));
    });

    await resOk.req()(createEvent(), createContext(), () => {});

    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith('Test error');
    // eslint-disable-next-line no-console
    expect(console.warn).toHaveBeenCalledWith('Test warn');
    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledWith('Test log');
  });
});
