import { ok } from '@alexshelkov/result';

import { SQSHandler, SQSEvent } from 'aws-lambda';
import { eventSqsService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('eventSqs', () => {
  it('returns 400 EventSqsRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventSqsService);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    expect(await resOk.req()(createEvent(), createContext())).toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"EventSqsRequestError"}}',
    });
  });

  it('parse SQSEvent event', async () => {
    expect.assertions(7);

    const res = creator(eventSqsService);

    const resOk = res.ok(({ service: { eventSqs, eventSqsRecord } }) => {
      expect(eventSqs.Records).toHaveLength(1);
      expect(eventSqs.Records[0].eventSource).toStrictEqual('aws:sqs');
      expect(eventSqsRecord.body).toStrictEqual('Test message');

      return Promise.resolve(ok('success'));
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    const resTransOK = resOk.onOk(async (_r, { event }) => {
      expect(event).toMatchObject({ Records: [{ eventSource: 'aws:sqs', body: 'Test message' }] });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    const resTransFail = resTransOK.onFail(async (_r, { event }) => {
      expect(event).toMatchObject({ Records: [{ eventSource: 'wrong type' }] });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    const resTransFatal = resTransFail.onFatal(async () => {});

    const handle: SQSHandler = resTransFatal.req();

    expect(
      await handle(
        createEvent({
          Records: [
            {
              eventSource: 'wrong type',
            },
          ],
        } as SQSEvent),
        createContext(),
        () => {}
      )
    ).toBeUndefined();

    expect(
      await handle(
        createEvent({
          Records: [
            {
              eventSource: 'aws:sqs',
              body: 'Test message',
            },
          ],
        } as SQSEvent),
        createContext(),
        () => {}
      )
    ).toBeUndefined();
  });
});
