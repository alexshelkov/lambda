import { Err, fail } from '@alexshelkov/result';
import { APIGatewayProxyEvent } from 'aws-lambda';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventGatewayOptions = {};

export type EventGatewayService = { eventGateway: APIGatewayProxyEvent };

export type EventGatewayRequestError = { type: 'EventGatewayRequestError' } & Err;
export type EventGatewayErrors = EventGatewayRequestError;

const eventGateway: MiddlewareCreator<
  EventGatewayOptions,
  EventGatewayService,
  EventGatewayErrors
> = () =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (!(request.event.httpMethod && request.event.resource)) {
      return fail('EventGatewayRequestError');
    }

    return addService(request, {
      eventGateway: (request.event as unknown) as APIGatewayProxyEvent,
    });
  };
export default eventGateway;
