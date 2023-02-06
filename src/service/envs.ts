import { Err, fail } from 'lambda-res';

import { AwsEvent, Request, Middleware, MiddlewareCreator } from '../core';
import { addService } from '../utils';

const getProcessEnv = (name: string): Promise<string | undefined> => {
  name = name
    .replace(/[A-Z]/g, (letter) => {
      return `_${letter.toLowerCase()}`;
    })
    .toUpperCase();

  return Promise.resolve(process.env[name]);
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type EnvsLoaderOptions = {
  getEnv: (name: string) => Promise<string | undefined>;
};
export type EnvsLoaderService = {
  getEnv: (name: string) => Promise<string | undefined>;
};
export type EnvsLoaderErrors = never;

export const envsLoader: MiddlewareCreator<
  EnvsLoaderOptions,
  EnvsLoaderService,
  EnvsLoaderErrors
> = (options) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    return addService(request, {
      getEnv: options.getEnv ? options.getEnv : getProcessEnv,
    });
  };
};

export type EnvsOptions = {
  envs: readonly string[];
};

export type EnvsNotExist = Err<'EnvsNotExist', { name: string }>;
export type EnvsErrors = EnvsNotExist;

type EnvsServiceGet<Options extends EnvsOptions> = {
  readonly [k in Options['envs'][number]]: string;
};

export type EnvsService<Options extends EnvsOptions> = Middleware<
  Options,
  { envs: EnvsServiceGet<Options> },
  EnvsErrors,
  Partial<EnvsLoaderService>
>;

const envsService = <Options extends EnvsOptions>(
  options: Partial<Options>
): EnvsService<Options> => {
  return async <Service extends Partial<EnvsLoaderService>>(
    request: Request<AwsEvent, Options, Service>
    // eslint-disable-next-line @typescript-eslint/require-await
  ) => {
    const { envs } = options;
    const { service } = request;

    let getEnv;

    if (service.getEnv) {
      getEnv = service.getEnv;
    } else {
      getEnv = getProcessEnv;
    }

    const processedEnvs: Record<string, string> = {};

    if (envs) {
      // eslint-disable-next-line no-restricted-syntax
      for (const name of envs) {
        const env = await getEnv(name);

        if (env) {
          processedEnvs[name] = env;
        } else {
          return fail<EnvsNotExist>('EnvsNotExist', { name });
        }
      }
    }

    return addService(request, {
      envs: processedEnvs as EnvsServiceGet<Options>,
    });
  };
};

export default envsService;
