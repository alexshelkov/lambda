import { ok } from '@alexshelkov/result';
import { Handler, MiddlewareCreator, AwsEvent, creator, addService } from '@alexshelkov/lambda';

type Hello = {};

const hello: MiddlewareCreator<{}, Hello, never> = () => {
  return async (request) => {
    return addService(request, {});
  };
};

type API = {};

const handle: Handler<AwsEvent, Hello, API, never> = async () => {
  return ok({});
};

export const handler = creator(hello).ok(handle).req(); // returns lambda handler
