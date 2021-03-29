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

export const createTransport = (): Transport => {
  return {
    send(type, data) {
      if (type === 'error') {
        // eslint-disable-next-line no-console
        console.error(...data);
      } else if (type === 'warn') {
        // eslint-disable-next-line no-console
        console.warn(...data);
      } else if (type === 'debug') {
        // eslint-disable-next-line no-console
        console.debug(...data);
      } else if (type === 'info') {
        // eslint-disable-next-line no-console
        console.info(...data);
      } else {
        // eslint-disable-next-line no-console
        console.log(...data);
      }
    },
  };
};

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
