import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

import getTransport, { Transport, TransportService } from './loggerTransport';

// eslint-disable-next-line @typescript-eslint/ban-types
export type LoggerOptions = {};

export interface Logger {
  save: (meta: Record<string, unknown>) => void;
  meta: () => Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...messages: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (...messages: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...messages: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...messages: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...messages: any[]) => void;
}

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

export const resetLogger = (logger: Logger = (undefined as unknown) as Logger): void => {
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
