import { Err, fail } from '@alexshelkov/result';
import { SQSEvent, SQSRecord } from 'aws-lambda';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventSqsOptions = {};

export type EventSqsService = { eventSqs: SQSEvent; eventSqsRecord: SQSRecord };

export type EventSqsRequestError = { type: 'EventSqsRequestError' } & Err;
export type EventSqsErrors = EventSqsRequestError;

const sqs: MiddlewareCreator<EventSqsOptions, EventSqsService, EventSqsErrors> = () =>
  // eslint-disable-next-line @typescript-eslint/require-await
  async (request) => {
    if (
      !(
        Array.isArray(request.event.Records) &&
        request.event.Records.length > 0 &&
        request.event.Records[0] !== null &&
        typeof request.event.Records[0] === 'object' &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        request.event.Records[0].eventSource === 'aws:sqs'
      )
    ) {
      return fail('EventSqsRequestError');
    }

    const event: SQSEvent = (request.event as unknown) as SQSEvent;
    const record: SQSRecord = event.Records[0];

    return addService(request, {
      eventSqs: event,
      eventSqsRecord: record,
    });
  };

export default sqs;
