import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

import getTransport, { Transport, TransportService } from './loggerTransport';

// eslint-disable-next-line @typescript-eslint/ban-types
export type LoggerOptions = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Logger {
  save: (meta: Record<string, unknown>) => void;
  meta: () => Record<string, unknown>;
  log: (...messages: any[]) => void;
  info: (...messages: any[]) => void;
  error: (...messages: any[]) => void;
  warn: (...messages: any[]) => void;
  debug: (...messages: any[]) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type LoggerService = {
  logger: Logger;
};

export type LoggerErrors = never;

export const createLogger = (transport: Transport): Logger => {
  let saved: Record<string, unknown> = {};

  return {
    meta() {
      return saved;
    },
    save(meta) {
      saved = { ...saved, ...meta };
    },
    log(...messages) {
      transport.send('log', messages, saved);
    },
    info(...messages) {
      transport.send('info', messages, saved);
    },
    error(...messages) {
      transport.send('error', messages, saved);
    },
    warn(...messages) {
      transport.send('warn', messages, saved);
    },
    debug(...messages) {
      transport.send('debug', messages, saved);
    },
  };
};

let service: Logger;

const getLogger = (): Logger => {
  if (!service) {
    service = createLogger(getTransport());
  }

  return service;
};

export const resetLogger = (logger: Logger = undefined as unknown as Logger): void => {
  service = logger;
};

export const loggerService: MiddlewareCreator<
  LoggerOptions,
  LoggerService,
  LoggerErrors,
  TransportService
> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    const logger = createLogger(request.service.transport);

    logger.save({ ...getLogger().meta(), event: request.event });

    return addService(request, {
      logger,
    });
  };
};

export default getLogger;
