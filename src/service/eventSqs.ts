import { Err, fail } from 'lambda-res';
import { SQSEvent, SQSRecord } from 'aws-lambda';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';
import { isHaveRecords } from './utils';

export { SQSEvent, SQSRecord };

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventSqsOptions = {};

export type EventSqsService = { eventSqs: SQSEvent; eventSqsRecord: SQSRecord };

export type EventSqsRequestError = Err<'EventSqsRequestError'>;
export type EventSqsErrors = EventSqsRequestError;

const isHaveSqsProps = (input: unknown): input is { eventSource: string } => {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as { eventSource: unknown }).eventSource === 'string'
  );
};

const isSqsEvent = (event: unknown): event is SQSEvent => {
  return (
    isHaveRecords(event) &&
    isHaveSqsProps(event.Records[0]) &&
    event.Records[0].eventSource === 'aws:sqs'
  );
};

const sqs: MiddlewareCreator<EventSqsOptions, EventSqsService, EventSqsErrors> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (!isSqsEvent(request.event)) {
      return fail('EventSqsRequestError');
    }

    return addService(request, {
      eventSqs: request.event,
      eventSqsRecord: request.event.Records[0],
    });
  };
};

export default sqs;
