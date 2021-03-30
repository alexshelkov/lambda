import { DefineAuthChallengeTriggerHandler, DefineAuthChallengeTriggerEvent } from 'aws-lambda';

import { Err, fail, ok } from '@alexshelkov/result';

import { creator, GetError, GetService, Handler, HandlerError, GetEvent, GetOpt } from '../index';

import { creatorTest1, createEvent, createContext } from '../__stubs__';

/* eslint-disable @typescript-eslint/require-await */

const defineEvent = (): DefineAuthChallengeTriggerEvent => {
  return {
    version: '',
    region: '',
    userPoolId: '',
    triggerSource: 'DefineAuthChallenge_Authentication',
    userName: '',
    callerContext: {
      awsSdkVersion: '',
      clientId: '',
    },
    request: {
      userAttributes: {},
      session: [],
    },
    response: {
      challengeName: '',
      failAuthentication: false,
      issueTokens: false,
    },
  };
};

describe('custom handlers', () => {
  describe('will works with Cognito handlers', () => {
    type Event = { event: DefineAuthChallengeTriggerEvent; context: unknown };

    const res = creator(creatorTest1).ctx<Event>().opt({ op1: '1' });

    type ErrorType = GetError<typeof res>;
    type ServiceOpts = GetOpt<typeof res>;
    type ServiceType = GetService<typeof res>;
    type EventType = GetEvent<typeof res>;

    type Session = DefineAuthChallengeTriggerEvent['request']['session'][0] | undefined;

    const h1: Handler<ServiceType, Session, Err, EventType, ServiceOpts> = async (request) => {
      return ok(request.event.request.session[0]);
    };

    const e1: HandlerError<ErrorType, string, Err, EventType, ServiceOpts> = async () => {
      return fail('error');
    };

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    const resTranOk = resFail.onOk(async (_r, { event }) => {
      event.response.issueTokens = true;
      event.response.challengeName = event.request.session[0]?.challengeName;

      return event;
    });

    const resTransErr = resTranOk.onFatal(async (r, { event }) => {
      ((event as unknown) as { badEvent: unknown }).badEvent = r.err();

      return event;
    });

    const handle = resTransErr.req();

    handle as DefineAuthChallengeTriggerHandler; // types must be compatible

    it('valid event', async () => {
      expect.assertions(1);

      const event = defineEvent();

      event.request.session[0] = {
        challengeName: 'SMS_MFA',
        challengeResult: true,
      };

      const savedEvent = JSON.parse(JSON.stringify(event)) as DefineAuthChallengeTriggerEvent;

      const response = await handle(createEvent(event), createContext());

      expect(response).toMatchObject({
        ...savedEvent,
        response: {
          ...savedEvent.response,
          challengeName: 'SMS_MFA',
          issueTokens: true,
        },
      } as DefineAuthChallengeTriggerEvent);
    });

    it('invalid event', async () => {
      expect.assertions(1);

      const response = await handle(
        createEvent(({ badEvent: 'no' } as unknown) as DefineAuthChallengeTriggerEvent),
        createContext()
      );

      expect(response).toMatchObject({
        badEvent: {
          type: 'UncaughtError',
          cause: 'TypeError',
          message: "Cannot read property 'session' of undefined",
        },
      });
    });
  });
});
