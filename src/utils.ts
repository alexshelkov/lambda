import { ok, fail, Failure, Result, isFailureLike, isErr } from 'lambda-res';

import {
  Request,
  ServiceContainer,
  ServiceOptions,
  AwsEvent,
  UnhandledErrors,
  SkippedError,
} from './core';

export const isPromise = <Data>(
  data: Data
): data is Data extends Promise<unknown> ? Data : never => {
  return data !== null && typeof data === 'object' && 'then' in data;
};

export const skippedError = (): Failure<SkippedError> => {
  return fail<SkippedError>('Skipped', { skip: true });
};

export const convertToFailure = <Type extends UnhandledErrors['type']>(
  type: Type,
  exception: unknown
): Failure<UnhandledErrors> => {
  let cause;
  let message;

  if (isFailureLike(exception) && isErr(exception.error)) {
    const { error } = exception;

    cause = error.type;
    message = error.message;
  } else if (exception instanceof Error) {
    cause = exception.name;
    message = exception.message;
  } else {
    cause = 'Unknown';
    message = undefined;
  }

  const error = fail<UnhandledErrors>(type, { order: -1, message, cause });

  error.stack = exception instanceof Error ? exception.stack : error.stack;

  return error;
};

export const addService = <
  Event extends AwsEvent,
  Options extends ServiceOptions,
  Service1 extends ServiceContainer,
  Service2 extends ServiceContainer
>(
  request: Request<Event, Options, Service1>,
  addedService?: Service2
): Result<Service1 & Service2, never> => {
  return ok({
    ...request.service,
    ...(addedService || ({} as Service2)),
  });
};
