import { Result } from '@alexshelkov/result';
import { APIGatewayProxyResult } from 'aws-lambda';

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
      result.error !== undefined
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

// eslint-disable-next-line @typescript-eslint/require-await
export const raw = async <Res = Result<unknown, unknown>>(
  result: Result<unknown, unknown>
): Promise<Res> => {
  return (result as unknown) as Promise<Res>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/explicit-module-boundary-types
export const none = async (result: Result<unknown, unknown>): Promise<void> => {};
