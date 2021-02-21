import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

export type MessageType = string;

// eslint-disable-next-line @typescript-eslint/ban-types
export type TransportOptions = {};

export interface Transport {
  send: (type: MessageType, data: unknown[]) => void;
}

export type TransportService = {
  transport: Transport;
};

export type TransportErrors = never;

const createTransport = (): Transport => ({
  send(type: MessageType, data: unknown[]) {
    if (type === 'error') {
      // eslint-disable-next-line no-console
      console.error(...data);
    } else if (type === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(...data);
    } else {
      // eslint-disable-next-line no-console
      console.log(...data);
    }
  },
});

const transport: MiddlewareCreator<TransportOptions, TransportService, TransportErrors> = () =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) =>
    addService(request, {
      transport: createTransport(),
    });

export default transport;
