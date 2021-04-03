import { Err, fail } from '@alexshelkov/result';
import { APIGatewayProxyEvent } from 'aws-lambda';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventGatewayOptions = { test: string };

export type EventGatewayService = { eventGateway: APIGatewayProxyEvent };

export type EventGatewayRequestError = Err<'EventGatewayRequestError'>;
export type EventGatewayErrors = EventGatewayRequestError;

const isApiGatewayEvent = (event: unknown): event is APIGatewayProxyEvent => {
  return (
    event !== null &&
    typeof event === 'object' &&
    typeof (event as { httpMethod: unknown }).httpMethod === 'string' &&
    typeof (event as { resource: unknown }).resource === 'string'
  );
};

const eventGateway: MiddlewareCreator<
  EventGatewayOptions,
  EventGatewayService,
  EventGatewayErrors
> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (!isApiGatewayEvent(request.event)) {
      return fail('EventGatewayRequestError');
    }

    return addService(request, {
      eventGateway: request.event,
    });
  };
};

export default eventGateway;
