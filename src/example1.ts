import { Handler, MiddlewareCreator, ok, creator, addService } from 'lambda-mdl';

type Hello = {};

const hello: MiddlewareCreator<{}, Hello, never> = () => {
  return async (request) => {
    return addService(request, {});
  };
};

type API = {};

const handle: Handler<Hello, API, never> = async () => {
  return ok({});
};

export const handler = creator(hello).ok(handle).req(); // returns lambda handler
