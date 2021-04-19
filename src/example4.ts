import { Handler, MiddlewareCreator, ok, creator, addService } from 'lambda-mdl';

type Hello = {
  sayHello: () => string;
  sayHelloWorld: () => string;
};

const hello: MiddlewareCreator<{}, Hello, never, World> = () => {
  return async (request) => {
    return addService(request, {
      sayHello: () => 'hello',
      sayHelloWorld: () => `hello ${request.service.sayWorld()}`,
    });
  };
};

type World = {
  sayWorld: () => string;
};
const world: MiddlewareCreator<{}, World, never> = () => {
  return async (request) => {
    return addService(request, {
      sayWorld: () => 'world',
    });
  };
};

type API = {
  message: string;
};

const handle: Handler<Hello, API, never> = async (request) => {
  return ok({
    message: request.service.sayHelloWorld(),
  });
};

export const handler = creator(world).srv(hello).ok(handle).req(); // returns lambda handler
