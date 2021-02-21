import { ok } from '@alexshelkov/result';

import { eventSqsService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('eventSqs', () => {
  it('returns 400 EventSqsRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventSqsService);

    const resOk = res.ok(() => Promise.resolve(ok('success')));

    expect(await resOk.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"EventSqsRequestError"}}',
    });
  });

  it('parse SQSEvent event', async () => {
    expect.assertions(4);

    const res = creator(eventSqsService);

    const resOk = res.ok(({ service: { eventSqs, eventSqsRecord } }) => {
      expect(eventSqs.Records).toHaveLength(1);
      expect(eventSqs.Records[0].eventSource).toStrictEqual('aws:sqs');
      expect(eventSqsRecord.body).toStrictEqual('Test message');

      return Promise.resolve(ok('success'));
    });

    expect(
      await resOk.req()(
        createEvent({
          Records: [
            {
              eventSource: 'aws:sqs',
              body: 'Test message',
            },
          ],
        }),
        createContext(),
        () => {}
      )
    ).toMatchObject({
      statusCode: 200,
      body: '{"status":"success","data":"success"}',
    });
  });
});
