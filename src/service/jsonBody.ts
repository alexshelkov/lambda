import { Err, fail } from 'lambda-res';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type JsonBodyOptions = {};

export type JsonBody = { [key: string]: unknown };

export type JsonBodyService = { jsonBody: JsonBody };

export type JsonRequestError = Err<'JsonRequestError'>;
export type JsonBodyParseError = Err<'JsonBodyParseError'>;
export type JsonBodyErrors = JsonRequestError | JsonBodyParseError;

const isHaveBody = (event: unknown): event is { body: string } => {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof (event as { body: unknown }).body === 'string'
  );
};

const jsonBody: MiddlewareCreator<JsonBodyOptions, JsonBodyService, JsonBodyErrors> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (!isHaveBody(request.event)) {
      return fail('JsonRequestError');
    }

    let body;

    try {
      body = JSON.parse(request.event.body) as JsonBody;
    } catch (err) {
      return fail('JsonBodyParseError', {
        message: (err as Error).message,
      });
    }

    if (typeof body !== 'object' || body === null) {
      return fail('JsonBodyParseError', {
        message: `Parsed object is ${body === null ? 'is null' : 'not an object'}`,
      });
    }

    return addService(request, {
      jsonBody: body,
    });
  };
};

export default jsonBody;
