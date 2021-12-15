import { SQSHandler, SQSEvent } from 'aws-lambda';

import { ok } from 'lambda-res';

import { eventSqsService, creator, none } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('eventSqs', () => {
  it('returns 400 EventSqsRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventSqsService).onOk(none).onFail(none).onFatal(none);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    const handle: SQSHandler = resOk.req();

    await expect(handle(createEvent(), createContext(), () => {})).resolves.toBeUndefined();
  });

  it('parse SQSEvent event', async () => {
    expect.assertions(7);

    const res = creator(eventSqsService);

    const resOk = res.ok(({ service: { eventSqs, eventSqsRecord } }) => {
      expect(eventSqs.Records).toHaveLength(1);
      expect(eventSqs.Records[0]?.eventSource).toStrictEqual('aws:sqs');
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
    const resTransFatal = resTransFail.onFatal(none);

    const handle: SQSHandler = resTransFatal.req();

    await expect(
      handle(
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
    ).resolves.toBeUndefined();

    await expect(
      handle(
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
    ).resolves.toBeUndefined();
  });
});
