import { Failure, Result } from 'lambda-res';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FallBackTransform } from './core';

// eslint-disable-next-line @typescript-eslint/require-await
export const json = async (result: Result<unknown, unknown>): Promise<APIGatewayProxyResult> => {
  let code: number;

  if (result.code) {
    code = result.code;
  } else {
    code = result.isOk() ? 200 : 400;
  }

  if (result.isOk() && result.ok() === undefined) {
    delete result.data;
  } else if (result.isErr() && result.err() === undefined) {
    delete result.error;
  }

  delete result.order;
  delete result.code;

  let body: string;

  if (result.isOk()) {
    body = result.data !== undefined ? JSON.stringify(result) : '';
  } else {
    body =
      result.err() !== undefined
        ? JSON.stringify({
            ...result,
            message: undefined,
            name: undefined,
            stack: undefined,
          })
        : '';
  }

  return {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    statusCode: code,
    body,
  };
};

export const safe = async <Res extends Result<unknown, unknown> = Result<unknown, unknown>>(
  result: Res
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<Res> => {
  if (result instanceof Error) {
    Object.setPrototypeOf(result, {});
  }

  return result;
};

export const raw = async <Res extends Result<unknown, unknown> = Result<unknown, unknown>>(
  result: Res
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<Res> => {
  return result;
};

export const unwrapSafe = async <Data = unknown, Fail = unknown>(
  result: Result<Data, Fail>
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<Data | Fail> => {
  if (result.isOk()) {
    return result.ok();
  }

  return result.err();
};

export const unwrap = async <Data = unknown, Fail = unknown>(
  result: Result<Data, Fail>
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<Data | Failure<Fail>> => {
  if (result.isOk()) {
    return result.ok();
  }

  return result;
};

export const none = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  result: Result<unknown, unknown>
): Promise<void> => {};

let fallBackTransform: FallBackTransform = json;

export const getFallBackTransform = (): FallBackTransform => {
  return fallBackTransform;
};

export const resetFallBackTransform = (transform: FallBackTransform): void => {
  fallBackTransform = transform;
};
