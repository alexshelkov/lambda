import { MiddlewareCreator } from '../types';
import { addService } from '../utils';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EmptyOptions = {};
// eslint-disable-next-line @typescript-eslint/ban-types
export type EmptyService = {};
export type EmptyErrors = never;

const empty: MiddlewareCreator<EmptyOptions, EmptyService, EmptyErrors> = () => {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (request) => {
    return addService(request, {});
  };
};

export default empty;
