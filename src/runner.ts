import {
  Failure,
  fail,
  isFailureLike,
  isErr,
  Result,
  ok,
  Err,
  compare,
  Response,
  err as fail2,
  Success,
} from 'lambda-res';

import {
  AwsEvent,
  ServiceContainer,
  ServiceOptions,
  Transform,
  TransformError,
  MiddlewareFail,
  SkippedError,
  MetaCreator,
  MetaSuccess,
  MetaFail,
  MetaFatal,
  MetaMiddleware,
  MetaMiddlewareLifecycle,
  Runner,
} from './core';
import { getFallBackTransform } from './transform';
import { createLifecycle, createHandlerLifecycle, createCreatorLifecycle } from './lifecycles';
import { convertToFailure, skippedError } from './utils';

// ------------------------------------------------------------------------------------------------
// Common utils and types
// ------------------------------------------------------------------------------------------------

type ReqBase = { event: AwsEvent['event']; context: AwsEvent['context']; options: ServiceOptions };

type LambdaFatalErr = Err<'LambdaFatal', { error: unknown }>;
type LambdaFailErr = Err<'LambdaFail', { creatorId: number; packId?: number; error: unknown }>;

type ServiceError = SkippedError | LambdaFailErr | LambdaFatalErr;

type HandlerRes = { stops?: boolean; inner: Result<unknown, unknown> };

const isNotSkippedHandlerException = (err: unknown) => {
  return !(
    isFailureLike(err) &&
    isErr<SkippedError>(err.error) &&
    err.error.type === 'Skipped' &&
    err.error.works
  );
};

const toFailOrFatalServiceErr = (err: unknown): Failure<LambdaFailErr | LambdaFatalErr> => {
  if (
    isFailureLike(err) &&
    isErr<MiddlewareFail<unknown>>(err.error) &&
    err.error.type === 'MiddlewareFail'
  ) {
    const creatorId = err.error.creatorId;
    const packId = err.error.packId;

    return fail<LambdaFailErr>('LambdaFail', {
      creatorId,
      packId,
      error: err.error.inner.err(),
    });
  } else {
    return fail('LambdaFatal', { error: err });
  }
};

// ---------------------------------------------------------------------------------------
// Fatal
// ---------------------------------------------------------------------------------------

type HandlerFatalRes = Success<HandlerRes>;

const runFatalHandler = async (
  reqBase: ReqBase,
  fatalError: LambdaFatalErr,
  fatalMeta: MetaFatal,
  prevResult: Result<unknown, unknown>
): Promise<HandlerFatalRes> => {
  const { fatal } = fatalMeta;

  const reqObj = { ...reqBase, exception: fatalError.error };

  const handlerLifecycle = createHandlerLifecycle(reqObj);

  try {
    const inner = await fatal(reqObj, handlerLifecycle);

    const stops = await handlerLifecycle.stops();

    if (stops) {
      return ok({ inner, stops });
    }

    return ok({ inner: compare(prevResult, inner) });
  } catch (err) {
    if (isNotSkippedHandlerException(err)) {
      return ok({
        inner: convertToFailure('RunnerUncaught', err),
      });
    }

    return ok({ inner: compare(prevResult, skippedError()) });
  }
};

const runFatalHandlers = async (
  reqBase: ReqBase,
  fatalError: LambdaFatalErr,
  fatales: readonly MetaFatal[]
): Response<Result<unknown, unknown>, never> => {
  let currRes: Result<unknown, unknown> = skippedError();

  for (const fatalMeta of fatales) {
    const result: HandlerFatalRes = await runFatalHandler(reqBase, fatalError, fatalMeta, currRes);

    const data = result.ok();

    currRes = data.inner;

    if (data.stops) {
      break;
    }
  }

  return ok(currRes);
};

const runFatalBranch = async (
  mustRun: SkippedError | LambdaFatalErr | LambdaFailErr,
  reqBase: ReqBase,
  fatales: readonly MetaFatal[],
  transformFatal: TransformError<unknown, unknown, unknown>
): Response<unknown, SkippedError> => {
  if (!(mustRun && mustRun.type === 'LambdaFatal')) {
    return skippedError();
  }

  const fatalResult = await runFatalHandlers(reqBase, mustRun, fatales);

  let response: unknown;

  try {
    response = await transformFatal(fatalResult.ok(), reqBase);
  } catch (err) {
    response = await getFallBackTransform()(convertToFailure('RunnerUncaughtTransform', err));
  }

  return ok(response);
};

// ---------------------------------------------------------------------------------------
// Fail
// ---------------------------------------------------------------------------------------

type HandlerFailRes = Result<HandlerRes, LambdaFailErr | LambdaFatalErr>;

const runFailHandler = async (
  reqBase: ReqBase,
  service: ServiceContainer,
  failError: LambdaFailErr,
  failMeta: MetaFail,
  prevResult: Result<unknown, unknown>
): Promise<HandlerFailRes> => {
  const { failure, creatorId, packId } = failMeta;

  if (creatorId < failError.creatorId) {
    return ok({ inner: compare(prevResult, skippedError()) });
  }

  if (typeof packId === 'number' && failError.packId !== packId) {
    return ok({ inner: compare(prevResult, skippedError()) });
  }

  const reqObj = { ...reqBase, error: failError.error, service };

  const handlerLifecycle = createHandlerLifecycle(reqObj);

  try {
    const inner = await failure(reqObj, handlerLifecycle);

    const stops = await handlerLifecycle.stops();

    if (stops) {
      return ok({ inner, stops });
    }

    return ok({ inner: compare(prevResult, inner) });
  } catch (err) {
    if (isNotSkippedHandlerException(err)) {
      return toFailOrFatalServiceErr(err);
    }

    return ok({ inner: compare(prevResult, skippedError()) });
  }
};

const runFailHandlers = async (
  reqBase: ReqBase,
  failError: LambdaFailErr,
  service: ServiceContainer,
  fails: readonly MetaFail[]
): Response<Result<unknown, unknown>, LambdaFailErr | LambdaFatalErr> => {
  let currRes: Result<unknown, unknown> = skippedError();

  for (const failMeta of fails) {
    const result: HandlerFailRes = await runFailHandler(
      reqBase,
      service,
      failError,
      failMeta,
      currRes
    );

    if (result.isOk()) {
      const data = result.ok();

      currRes = data.inner;

      if (data.stops) {
        break;
      }
    } else {
      return result;
    }
  }

  return ok(currRes);
};

const runFailBranch = async (
  mustRun: SkippedError | LambdaFatalErr | LambdaFailErr,
  reqBase: ReqBase,
  service: ServiceContainer,
  fails: readonly MetaFail[],
  transformFail: TransformError<unknown, unknown, unknown>
): Response<unknown, SkippedError | LambdaFailErr | LambdaFatalErr> => {
  if (!(mustRun && mustRun.type === 'LambdaFail')) {
    return skippedError();
  }

  const failResult = await runFailHandlers(reqBase, mustRun, service, fails);

  let response: unknown;

  if (failResult.isOk()) {
    try {
      response = await transformFail(failResult.ok(), reqBase);
    } catch (err) {
      return toFailOrFatalServiceErr(err);
    }
  } else {
    return failResult;
  }

  return ok(response);
};

// ---------------------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------------------

type HandlerSuccessRes = Result<HandlerRes, LambdaFailErr | LambdaFatalErr>;

const runSuccessHandler = async (
  reqBase: ReqBase,
  service: ServiceContainer,
  successMeta: MetaSuccess,
  prevRes: Result<unknown, unknown>
): Promise<HandlerSuccessRes> => {
  const { success } = successMeta;

  const reqObj = { ...reqBase, service };

  const handlerLifecycle = createHandlerLifecycle(reqObj);

  try {
    const inner = await success(reqObj, handlerLifecycle);

    const stops = await handlerLifecycle.stops();

    if (stops) {
      return ok({ inner, stops });
    }

    return ok({ inner: compare(prevRes, inner) });
  } catch (err) {
    if (isNotSkippedHandlerException(err)) {
      return toFailOrFatalServiceErr(err);
    }

    return ok({ inner: compare(prevRes, skippedError()) });
  }
};

const runSuccessHandlers = async (
  reqBase: ReqBase,
  service: ServiceContainer,
  successes: readonly MetaSuccess[]
): Response<Result<unknown, unknown>, LambdaFailErr | LambdaFatalErr> => {
  let currRes: Result<unknown, unknown> = skippedError();

  for (const successMeta of successes) {
    const result: HandlerSuccessRes = await runSuccessHandler(
      reqBase,
      service,
      successMeta,
      currRes
    );

    if (result.isOk()) {
      const data = result.ok();

      currRes = data.inner;

      if (data.stops) {
        break;
      }
    } else {
      return result;
    }
  }

  return ok(currRes);
};

const runSuccessBranch = async (
  mustRun: SkippedError | LambdaFatalErr | LambdaFailErr,
  reqBase: ReqBase,
  service: ServiceContainer,
  successes: readonly MetaSuccess[],
  transform: Transform<unknown, unknown, unknown>
): Response<unknown, SkippedError | LambdaFailErr | LambdaFatalErr> => {
  if (mustRun.type !== 'Skipped') {
    return fail('Skipped', { skip: true });
  }

  const successResult = await runSuccessHandlers(reqBase, service, successes);

  let response: unknown;

  if (successResult.isOk()) {
    try {
      response = await transform(successResult.ok(), { ...reqBase, service });
    } catch (err) {
      return toFailOrFatalServiceErr(err);
    }
  } else {
    return successResult;
  }

  return ok(response);
};

// ---------------------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------------------

const runCreators = (
  options: ServiceOptions,
  creators: readonly MetaCreator[]
): Result<MetaMiddleware[], LambdaFailErr | LambdaFatalErr> => {
  const middlewares: MetaMiddleware[] = [];

  for (const creatorMeta of creators) {
    const { creator, creatorId, packId } = creatorMeta;

    try {
      const lifecycle = createCreatorLifecycle();

      lifecycle.gen(creatorId, packId);

      const middleware = creator(options, lifecycle);

      middlewares.push({ creatorId, packId, middleware });
    } catch (err) {
      return toFailOrFatalServiceErr(err);
    }
  }

  return ok(middlewares);
};

// ---------------------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------------------

const runMiddlewares = async (
  reqBase: ReqBase,
  middlewares: readonly MetaMiddleware[]
): Promise<{
  lifecycles: MetaMiddlewareLifecycle[];
  services: ServiceContainer;
  serviceError: ServiceError;
}> => {
  const lifecycles: MetaMiddlewareLifecycle[] = [];

  let services = {};
  let serviceError: ServiceError = { type: 'Skipped' };

  for (const middlewareMeta of middlewares) {
    const { middleware, creatorId, packId } = middlewareMeta;

    try {
      const lifecycle = createLifecycle();

      lifecycles.push({ creatorId, packId, lifecycle });

      const service = await middleware(
        {
          ...reqBase,
          service: services,
        },
        lifecycle
      );

      if (service.isErr()) {
        serviceError = {
          type: 'LambdaFail',
          creatorId,
          packId,
          error: service.err(),
        };
        break;
      } else {
        services = {
          ...service.ok(),
          ...services,
        };
      }
    } catch (err) {
      serviceError = toFailOrFatalServiceErr(err).err();
      break;
    }
  }

  return {
    lifecycles,
    services,
    serviceError,
  };
};

// ---------------------------------------------------------------------------------------
// Lifecycles
// ---------------------------------------------------------------------------------------

const runMiddlewareLifecycles = async (
  lifecycles: readonly MetaMiddlewareLifecycle[]
): Response<true, LambdaFatalErr | LambdaFailErr> => {
  const destroyed: MetaMiddlewareLifecycle[] = [];
  const ended: MetaMiddlewareLifecycle[] = [];

  for (const lifecycleMeta of lifecycles) {
    destroyed.unshift(lifecycleMeta);
    ended.push(lifecycleMeta);
  }

  try {
    for (const { lifecycle } of ended) {
      await lifecycle.ended();
    }

    for (const { lifecycle } of destroyed) {
      await lifecycle.destroyed();
    }
  } catch (err) {
    return toFailOrFatalServiceErr(err);
  }

  return ok(true);
};

// ---------------------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------------------

export const runner: Runner = (
  options,
  creators,
  successes,
  fails,
  fatales,
  transform,
  transformFail,
  transformFatal
) => {
  const creatorsResult = runCreators(options, creators);

  return async (event: AwsEvent['event'], context: AwsEvent['context']) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const reqBase = { event, context, options };

    let services = {};
    let lifecycles: MetaMiddlewareLifecycle[] = [];
    let serviceError: ServiceError;

    if (creatorsResult.isOk()) {
      const {
        services: middlewareServices,
        serviceError: middlewareServiceError,
        lifecycles: middlewareLifecycles,
      } = await runMiddlewares(reqBase, creatorsResult.ok());

      services = middlewareServices;
      serviceError = middlewareServiceError;
      lifecycles = middlewareLifecycles;
    } else {
      serviceError = creatorsResult.err();
    }

    let doubleServiceErr = false;
    let hasResponse = false;
    let response: unknown;

    let lifecyclesErrs = false;

    while (!hasResponse) {
      const successResult = await runSuccessBranch(
        serviceError,
        reqBase,
        services,
        successes,
        transform
      );

      if (successResult.isOk()) {
        hasResponse = true;
        response = successResult.ok();
      } else {
        const err = successResult.err();
        if (err.type !== 'Skipped') {
          serviceError = err;
        }
      }

      const failResult = await runFailBranch(serviceError, reqBase, services, fails, transformFail);

      if (failResult.isOk()) {
        hasResponse = true;
        response = failResult.ok();
      } else {
        const err = failResult.err();

        if (err.type !== 'Skipped') {
          if (err.type === 'LambdaFail') {
            if (doubleServiceErr) {
              serviceError = { type: 'LambdaFatal', error: fail2(err.error) };
            } else {
              doubleServiceErr = true;
              serviceError = err;
            }
          } else {
            serviceError = err;
          }
        }
      }

      const fatalResult = await runFatalBranch(serviceError, reqBase, fatales, transformFatal);

      if (fatalResult.isOk()) {
        hasResponse = true;
        response = fatalResult.ok();
      }

      if (hasResponse && !lifecyclesErrs) {
        const lifecyclesResult = await runMiddlewareLifecycles(lifecycles);

        if (lifecyclesResult.isErr()) {
          serviceError = lifecyclesResult.err();
          lifecyclesErrs = true;
          response = undefined;
          hasResponse = false;
        }
      }
    }

    if (response instanceof Error) {
      throw response;
    }

    return response;
  };
};
