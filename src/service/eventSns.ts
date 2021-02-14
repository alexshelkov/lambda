import { Err, fail } from '@alexshelkov/result';
import { SNSEvent, SNSMessage } from 'aws-lambda';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventSnsOptions = {};

export type EventSnsService = { eventSns: SNSEvent; eventSnsMessage: SNSMessage };

export type EventSnsRequestError = { type: 'EventSnsRequestError' } & Err;
export type EventSnsErrors = EventSnsRequestError;

const sns: MiddlewareCreator<EventSnsOptions, EventSnsService, EventSnsErrors> = () =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (
      !(
        Array.isArray(request.event.Records) &&
        request.event.Records.length > 0 &&
        request.event.Records[0] !== null &&
        typeof request.event.Records[0] === 'object' &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        request.event.Records[0].EventSource === 'aws:sns' &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        request.event.Records[0].Sns !== null &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        typeof request.event.Records[0].Sns === 'object'
      )
    ) {
      return fail('EventSnsRequestError');
    }

    const event: SNSEvent = (request.event as unknown) as SNSEvent;
    const message: SNSMessage = event.Records[0].Sns;

    return addService(request, {
      eventSns: event,
      eventSnsMessage: message,
    });
  };
export default sns;
