import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

import { Transport, TransportService } from './loggerTransport';

// eslint-disable-next-line @typescript-eslint/ban-types
export type LoggerOptions = {};

export interface Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...messages: any[]) => void;
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

const createLogger = (transport: Transport): Logger => {
  return {
    log(...messages: unknown[]) {
      transport.send('log', messages);
    },
    error(...messages: unknown[]) {
      transport.send('error', messages);
    },
    warn(...messages: unknown[]) {
      transport.send('warn', messages);
    },
    debug(...messages: unknown[]) {
      transport.send('debug', messages);
    },
  };
};

const logger: MiddlewareCreator<
  LoggerOptions,
  LoggerService,
  LoggerErrors,
  TransportService
> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    return addService(request, {
      logger: createLogger(request.service.transport),
    });
  };
};

export default logger;
