import { Errs, Handler, MiddlewareCreator, ok, fail, nope, creator, addService } from 'lambda-mdl';

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
type WorldErr = Errs<{
  name: 'Problem';
  WithWorld: string;
  WithMe: string;
  // ProblemNotChecked: string;
}>;

const world: MiddlewareCreator<WorldOpt, World, Errs<WorldErr>> = (options, { throws }) => {
  return async (request) => {
    return addService(request, {
      sayWorld: () => {
        if (options.worldsFault) {
          throws<WorldErr['WithWorld']>('ProblemWithWorld');
        }
        if (options.myFault) {
          throws<WorldErr['WithMe']>('ProblemWithMe');
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
  .opt({ worldsFault: false, myFault: false })
  .ok(handle)
  .fail(async (request) => {
    if (request.error.type === 'ProblemWithWorld') {
      return fail(request.error.type, { message: 'Problem with world' });
    }
    if (request.error.type === 'ProblemWithMe') {
      return fail(request.error.type, { message: 'Problem with me' });
    }

    // if you uncomment ProblemNotChecked you will see TS error here
    return nope(request.error);
  })
  .req(); // returns lambda handler
