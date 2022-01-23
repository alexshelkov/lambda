import { AwsEvent, Request, RequestError, ServiceContainer, ServiceOptions } from './types';

export const createEvent = <Event extends AwsEvent['event']>(event: Event = {} as Event): Event => {
  return event;
};

export const createContext = <Context extends AwsEvent['context']>(
  context: Context = {} as Context
): Context => {
  return context;
};

export const createRequest = <
  Service extends ServiceContainer,
  Options extends ServiceOptions,
  Event extends AwsEvent['event'],
  Context extends AwsEvent['context']
>(
  service: Service,
  options: Options = {} as Options,
  event: Event = {} as Event,
  context: Context = {} as Context
): Request<AwsEvent, Options, Service> => {
  return {
    event: createEvent(event),
    context: createContext(context),
    service,
    options,
  };
};

export const createErrorRequest = <
  Service extends ServiceContainer,
  Error,
  Options extends ServiceOptions,
  Event extends AwsEvent['event'],
  Context extends AwsEvent['context']
>(
  error: Error,
  options: Options = {} as Options,
  service: Service = {} as Service,
  event: Event = {} as Event,
  context: Context = {} as Context
): RequestError<AwsEvent, Options, Service, Error> => {
  return {
    event: createEvent(event),
    context: createContext(context),
    error,
    service,
    options,
  };
};
