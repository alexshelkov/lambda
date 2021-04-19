import { Err, fail } from 'lambda-res';
import { SNSEvent, SNSMessage } from 'aws-lambda';

import { MiddlewareCreator } from '../types';
import { addService } from '../utils';
import { isHaveRecords } from './utils';

export { SNSEvent, SNSMessage };

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventSnsOptions = {};

export type EventSnsService = { eventSns: SNSEvent; eventSnsMessage: SNSMessage };

export type EventSnsRequestError = Err<'EventSnsRequestError'>;
export type EventSnsErrors = EventSnsRequestError;

const isHaveSnsProps = (input: unknown): input is { EventSource: string } => {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as { EventSource: unknown }).EventSource === 'string'
  );
};

const isSnsEvent = (event: unknown): event is SNSEvent => {
  return (
    isHaveRecords(event) &&
    isHaveSnsProps(event.Records[0]) &&
    event.Records[0].EventSource === 'aws:sns'
  );
};

const sns: MiddlewareCreator<EventSnsOptions, EventSnsService, EventSnsErrors> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    if (!isSnsEvent(request.event)) {
      return fail('EventSnsRequestError');
    }

    return addService(request, {
      eventSns: request.event,
      eventSnsMessage: request.event.Records[0].Sns,
    });
  };
};

export default sns;
