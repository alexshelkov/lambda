import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

export type MessageType = string;

// eslint-disable-next-line @typescript-eslint/ban-types
export type TransportOptions = {};

export interface Transport {
  send: (type: MessageType, data: unknown[], meta: Record<string, unknown>) => void;
}

export type TransportService = {
  transport: Transport;
};

export type TransportErrors = never;

/* eslint-disable no-console */
export const createTransport = (): Transport => {
  return {
    send(type, data) {
      if (type === 'error') {
        console.error(...data);
      } else if (type === 'warn') {
        console.warn(...data);
      } else if (type === 'debug') {
        console.debug(...data);
      } else if (type === 'info') {
        console.info(...data);
      } else {
        console.log(...data);
      }
    },
  };
};
/* eslint-enable no-console */

let service: Transport;

const getTransport = (): Transport => {
  if (!service) {
    service = createTransport();
  }

  return service;
};

export const resetTransport = (
  transport: Transport = (undefined as unknown) as Transport
): void => {
  service = transport;
};

export const transportService: MiddlewareCreator<
  TransportOptions,
  TransportService,
  TransportErrors
> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    return addService(request, {
      transport: getTransport(),
    });
  };
};

export default getTransport;
