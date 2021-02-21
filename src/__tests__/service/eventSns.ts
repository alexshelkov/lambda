import { ok } from '@alexshelkov/result';

import { eventSnsService, creator } from '../../index';
import { createContext, createEvent } from '../../__stubs__';

describe('eventSns', () => {
  it('returns 400 EventSnsRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventSnsService);

    const resOk = res.ok(() => Promise.resolve(ok('success')));

    expect(await resOk.req()(createEvent(), createContext(), () => {})).toMatchObject({
      statusCode: 400,
      body: '{"status":"error","error":{"type":"EventSnsRequestError"}}',
    });
  });

  it('parse SNSEvent event', async () => {
    expect.assertions(4);

    const res = creator(eventSnsService);

    const resOk = res.ok(({ service: { eventSns, eventSnsMessage } }) => {
      expect(eventSns.Records).toHaveLength(1);
      expect(eventSns.Records[0].EventSource).toStrictEqual('aws:sns');
      expect(eventSnsMessage.Message).toStrictEqual('Test message');

      return Promise.resolve(ok('success'));
    });

    expect(
      await resOk.req()(
        createEvent({
          Records: [
            {
              EventSource: 'aws:sns',
              Sns: {
                Message: 'Test message',
              },
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
