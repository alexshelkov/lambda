import { DefineAuthChallengeTriggerHandler, DefineAuthChallengeTriggerEvent } from 'aws-lambda';

import { Err, fail, ok } from '@alexshelkov/result';

import {
  creator,
  GetError,
  GetService,
  Handler,
  HandlerError,
  MiddlewareCreator,
  ServiceContainer,
  ServiceOptions,
  GetEvent,
} from '../index';

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
    const define: MiddlewareCreator<
      ServiceOptions,
      ServiceContainer,
      never,
      ServiceContainer,
      { event: DefineAuthChallengeTriggerEvent; context: unknown }
    > = () => {
      return async (request) => {
        return ok(request);
      };
    };

    const res = creator(define).srv(creatorTest1).opt({ op1: '1' });

    type ErrorType = GetError<typeof res>;
    type ServiceType = GetService<typeof res>;
    type EventType = GetEvent<typeof res>;

    type Session = DefineAuthChallengeTriggerEvent['request']['session'][0] | undefined;

    const h1: Handler<ServiceType, Session, Err, EventType> = async (request) => {
      return ok(request.event.request.session[0]);
    };

    const e1: HandlerError<ErrorType, string, Err, EventType> = async () => {
      return fail('error');
    };

    const resOk = res.ok(h1);
    const resFail = resOk.fail(e1);

    const resTranOk = resFail.onOk(async (_r, { event }) => {
      event.response.issueTokens = true;
      event.response.challengeName = event.request.session[0]?.challengeName;

      return event;
    });

    const resTransErr = resTranOk.onFail(async (r, { event }) => {
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
          type: 'Uncaught exception: TypeError',
          message: "Cannot read property 'session' of undefined",
        },
      });
    });
  });
});
