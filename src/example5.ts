import { Handler, MiddlewareCreator, Err, ok, fail, nope, creator, addService } from 'lambda-mdl';

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

type WorldOpt = {
  worldsFault: boolean;
  myFault: boolean;
};
type World = {
  sayWorld: () => string;
};
type ProblemWithWorld = { type: 'ProblemWithWorld' };
type ProblemWithYou = { type: 'ProblemWithMe' };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ProblemNotChecked = { type: 'ProblemNotChecked' };
type WorldErrs = ProblemWithWorld | ProblemWithYou; // | ProblemNotChecked;

const world: MiddlewareCreator<WorldOpt, World, WorldErrs> = (options) => {
  return async (request) => {
    return addService(request, {
      sayWorld: () => {
        if (options.worldsFault) {
          throw fail<ProblemWithWorld>('ProblemWithWorld');
        }
        if (options.myFault) {
          throw fail<ProblemWithYou>('ProblemWithMe');
        }
        return 'world';
      },
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

export const handler = creator(world)
  .srv(hello)
  .ok(handle)
  .fail(async (request) => {
    if (request.error.type === 'ProblemWithWorld') {
      return fail<Err>(request.error.type, { message: 'Problem with world' });
    }
    if (request.error.type === 'ProblemWithMe') {
      return fail<Err>(request.error.type, { message: 'Problem with me' });
    }

    return nope(request.error);
  })
  .req(); // returns lambda handler
