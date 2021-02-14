import { Err, fail } from '@alexshelkov/result';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type JsonBodyOptions = {};

export type JsonBody = { [key: string]: unknown };

export type JsonBodyService = { jsonBody: JsonBody };

export type JsonRequestError = { type: 'JsonRequestError' } & Err;
export type JsonBodyParseError = { type: 'JsonBodyParseError' } & Err;
export type JsonBodyErrors = JsonRequestError | JsonBodyParseError;

const jsonBody: MiddlewareCreator<JsonBodyOptions, JsonBodyService, JsonBodyErrors> = () =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (typeof request.event.body !== 'string') {
      return fail('JsonRequestError');
    }

    let body: unknown;

    try {
      body = JSON.parse(request.event.body) as unknown;
    } catch (err) {
      return fail('JsonBodyParseError', {
        message: err instanceof Error ? err.message : 'Unknown parse error',
      });
    }

    if (typeof body !== 'object' || body === null) {
      return fail('JsonBodyParseError', {
        message: `Parsed object is ${body === null ? 'is null' : 'not an object'}`,
      });
    }

    return addService(request, {
      jsonBody: body as JsonBody,
    });
  };
export default jsonBody;
