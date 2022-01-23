import { SNSHandler, SNSEvent } from 'aws-lambda';

import { ok } from 'lambda-res';

import { eventSnsService, creator, none, createContext, createEvent } from '../../index';

describe('eventSns', () => {
  it('returns 400 EventSnsRequestError for malformed input', async () => {
    expect.assertions(1);

    const res = creator(eventSnsService).onOk(none).onFail(none).onFatal(none);

    const resOk = res.ok(() => {
      return Promise.resolve(ok('success'));
    });

    const handle: SNSHandler = resOk.req();

    await expect(handle(createEvent(), createContext(), () => {})).resolves.toBeUndefined();
  });

  it('parse SNSEvent event', async () => {
    expect.assertions(7);

    const res = creator(eventSnsService);

    const resOk = res.ok(({ service: { eventSns, eventSnsMessage } }) => {
      expect(eventSns.Records).toHaveLength(1);
      expect(eventSns.Records[0]?.EventSource).toStrictEqual('aws:sns');
      expect(eventSnsMessage.Message).toStrictEqual('Test message');

      return Promise.resolve(ok('success'));
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    const resTransOK = resOk.onOk(async (_r, { event }) => {
      expect(event).toMatchObject({
        Records: [{ EventSource: 'aws:sns', Sns: { Message: 'Test message' } }],
      });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    const resTransFail = resTransOK.onFail(async (_r, { event }) => {
      expect(event).toMatchObject({ Records: [{ EventSource: 'wrong type' }] });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    const resTransFatal = resTransFail.onFatal(none);

    const handle: SNSHandler = resTransFatal.req();

    await expect(
      handle(
        createEvent({
          Records: [
            {
              EventSource: 'wrong type',
            },
          ],
        } as SNSEvent),
        createContext(),
        () => {}
      )
    ).resolves.toBeUndefined();

    await expect(
      handle(
        createEvent({
          Records: [
            {
              EventSource: 'aws:sns',
              Sns: {
                Message: 'Test message',
              },
            },
          ],
        } as SNSEvent),
        createContext(),
        () => {}
      )
    ).resolves.toBeUndefined();
  });
});
