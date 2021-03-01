import { ok } from '@alexshelkov/result';
import { Handler, MiddlewareCreator, creator, addService } from '@alexshelkov/lambda';

type Hello = {
  sayHello: () => string; // hello service will show errors if sayHello is missing or wrong type
};

const hello: MiddlewareCreator<{}, Hello, never> = () => {
  return async (request) => {
    return addService(request, {
      sayHello: () => 'hello',
    });
  };
};

type API = {};

const handle: Handler<Hello, API, never> = async () => {
  return ok({});
};

export const handler = creator(hello).ok(handle).req(); // returns lambda handler
