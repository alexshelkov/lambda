import { ok } from '@alexshelkov/result';
import { Handler, MiddlewareCreator, creator, addService } from '@alexshelkov/lambda';

type Hello = {
  sayHello: () => string;
};

const hello: MiddlewareCreator<{}, Hello, never> = () => {
  return async (request) => {
    return addService(request, {
      sayHello: () => 'hello',
    });
  };
};

type API = {
  message: string; // handle will shows errors if you try to change to number
};

const handle: Handler<Hello, API, never> = async (request) => {
  return ok({
    message: request.service.sayHello(),
  });
};

export const handler = creator(hello).ok(handle).req(); // returns lambda handler
