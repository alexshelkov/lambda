Type-safe middleware for AWS Lambda
===================================

Leveraging the power of Typescript to build middleware-like request handlers for lambda functions with type-based dependency checking.

[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![Test](https://github.com/alexshelkov/lambda/actions/workflows/test.yml/badge.svg)](https://github.com/alexshelkov/lambda/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/alexshelkov/lambda/badge.svg?branch=master)](https://coveralls.io/github/alexshelkov/lambda?branch=master)

![Gif](https://raw.githubusercontent.com/alexshelkov/lambda/examples/demo/demo.gif)

An example
===================================

A service which parse request body as JSON, get `a` and `b` from it,
check if both are valid numbers, then adds them and return result. 

```typescript
import { Err, MiddlewareCreator, Handler, JsonBodyService, ok, fail, creator, addService, jsonBodyService } from 'lambda-mdl';

type NumberService = { a: number; b: number };
type NumberErrNaN = Err<'NaA'>;
type NumberDependencies = JsonBodyService;

const numbers: MiddlewareCreator<{}, NumberService, NumberErrNaN, NumberDependencies> = () => {
  return async (request) => {
    const body = request.service.jsonBody;

    if (!(Number.isFinite(body.a) && Number.isFinite(body.b))) {
      return fail<NumberErrNaN>('NaA');
    }

    const service = body as NumberService;

    return addService(request, service);
  };
};

type Options = { acceptFloat: boolean };
type AdderService = { add: (a: number, b: number) => number };
type AdderErrNoFloats = Err<'Float'>;

const adder: MiddlewareCreator<Options, AdderService, AdderErrNoFloats> = (options, { throws }) => {
  const service: AdderService = {
    add: (a: number, b: number) => {
      if (!options.acceptFloat && !(Number.isInteger(a) && Number.isInteger(b))) {
        throws<AdderErrNoFloats>('Float');
      }

      return a + b;
    },
  };

  return async (request) => {
    return addService(request, service);
  };
};

const handler: Handler<AdderService & NumberService, number, never> = async ({
  service: { a, b, add },
}) => {
  return ok(add(a, b));
};

const lambda = creator(jsonBodyService).srv(numbers).srv(adder).ok(handler);
```

API
===================================

### Defining services

##### Static service:

#### `MiddlewareCreator`

Type used for creating new services. 

Params:

- `Options`
- `Service`
- `Errors` 
- `ServiceDeps`
- `Event`

```typescript
import { Err, MiddlewareCreator, addService } from 'lambda-mdl';

type Options = { };
type Service = { add: (a: number, b: number) => number };
type Errors = never;

const service: MiddlewareCreator<Options, Service, Errors> = () => {
  return async (request) => {
    return addService(request, {
      add: (a: number, b: number) => {
        return a + b;
      },
    });
  };
};
```

##### Dynamic service:

#### `Middleware`

Used to define services dynamically based on provided options.

Params:

- `Service`
- `Errors`
- `ServiceDeps`
- `Event`

```typescript
import { Middleware, ServiceContainer, Request, AwsEvent, empty, addService, creator } from 'lambda-mdl';

type Options = { test: number };
type Service<Opt> = Opt;
type Errors = never;

const service = <Opt extends Options>(
  options: Partial<Opt>
): Middleware<Opt, { data: Service<Opt> }, Errors> => {
  return async <Srv extends ServiceContainer>(request: Request<AwsEvent, Opt, Srv>) => {
    return addService(request, {
      data: { test: options.test } as Service<Opt>,
    });
  };
};

const res = creator(empty).opt({ test: 1 }).srv(service);
```

------------------------------------------------------------------------------------------

### Initialization

#### `creator`

Starts the creation of the lambda chain.

Params:

- `creator`: `MiddlewareCreator`


```typescript
import { creator, empty } from 'lambda-mdl';

const res = creator(empty); // now you can use other methods, for example: .srv 
```

#### `srv`

Adds a new service.

Params:

- `creator`: `MiddlewareCreator`

```typescript
import { MiddlewareCreator, creator, empty, addService } from 'lambda-mdl';

const service: MiddlewareCreator<{}, {}, never> = () => {
  return async (request) => {
    return addService(request, {});
  }
};

const res = creator(empty).srv(service); 
```

#### `opt`

Set the options.

Params:

- `options`


------------------------------------------------------------------------------------------

### Handlers

#### `ok`

Adds a handler which will be run if all middleware creators executed successfully.

Params:

- `handler`: `Handler`

```typescript
import { ok, creator, empty } from 'lambda-mdl';

const res = creator(empty).ok(async () => {
  return ok('success'); // can be used in onOk
});
```

#### `fail`

Adds a handler which runs on middleware failure.

Params:

- `handler`: `HandlerError`

```typescript
import { ok, creator, empty } from 'lambda-mdl';

const res = creator(empty).fail(async () => {
  // this handler will not run because 
  // empty middleware won't fail
  
  return ok('success'); // can be used in onFail
});
```

#### `fatal`

Adds an unknown exception handler.

Params:

- `handler`: `HandlerException`

```typescript
import { ok, creator, empty } from 'lambda-mdl';

const res = creator(empty).fatal(async () => {
  // this handler will not run because 
  // empty middleware won't throw fatal errors
  
  return ok('success'); // can be used in onFatal
});
```

------------------------------------------------------------------------------------------

### Transforms

#### `onOk`, `onOkRes`

Sets the result transformation of ok handler.

Params:

- `transform`: `Transform`

```typescript
import { ok, creator, empty } from 'lambda-mdl';

const res = creator(empty).ok(async () => {
  return ok('success');
}).onOk(async (result) => {
  return result; // result equals to 'success'
});
```

#### `onFail`, `onFailRes`

Sets the result transformation of fail handler.

Params:

- `transform`: `TransformError`

```typescript
import { ok, creator, empty } from 'lambda-mdl';

const res = creator(empty).fail(async () => {
  return ok('fail');
}).onFail(async (result) => {
  return result; // result equals to 'fail'
});
```

#### `onFatal`, `onFatalRes`

Sets the result transformation of fatal handler.

Params:

- `transform`: `TransformError`

```typescript
import { ok, creator, empty } from 'lambda-mdl';

const res = creator(empty).fatal(async () => {
  return ok('fatal');
}).onFatal(async (result) => {
  return result; // result equals to 'fatal'
});
```

#### `on`

Same as calling `onOk`, `onFail` and `onFatal`.

#### `req`

Returns AWS Lambda handler.

------------------------------------------------------------------------------------------

### Packages

Packages allow grouping a service, and ok and fail handlers together. 

```typescript
import { Err, fail, ok } from 'lambda-res';
import { creator, empty, addService, ServiceOptions, Package } from 'lambda-mdl';

const pack: Package<
  ServiceOptions,
  { packageService: string },
  Err<'ServiceError'>,
  string,
  never,
  string
> = {
  srv: () => {
    return async (request) => {
      return addService(request, {
        packageService: 'service test',
      });
    };
  },
  ok: async () => {
    return ok(`ok`);
  },
  fail: async () => {
    return ok(`fail`);
  },
};

creator(empty)
  .pack(pack)
  .ok(async ({ service: { packageService } }) => {
    return ok(packageService);
  });
```
