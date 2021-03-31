import { Handler, HandlerError, HandlerException, Transform, TransformError } from './types';
import { Creator } from './creator';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type GetOpt<Crt> = Crt extends Creator<
  any,
  any,
  any,
  any,
  infer Options,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Options
  : never;

export type GetService<Crt> = Crt extends Creator<
  any,
  any,
  any,
  any,
  any,
  infer Service,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Service
  : never;

export type GetEvent<Crt> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Event
  : never;

export type PickService<Crt, Srv extends keyof GetService<Crt>> = Pick<GetService<Crt>, Srv>;

export type GetError<Crt> = Crt extends Creator<
  any,
  any,
  any,
  any,
  any,
  any,
  infer Error,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Error
  : never;

export type GetHandler<Crt, Data, Error> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  infer Options,
  infer Service,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Handler<Service, Data, Error, Event, Options>
  : never;

export type GetHandlerError<Crt, Data, Error> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  infer Options,
  any,
  infer ServiceError,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? HandlerError<ServiceError, Data, Error, Event, Options>
  : never;

export type GetHandlerException<Crt, Data, Error> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  infer Options,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? HandlerException<Data, Error, Event, Options>
  : never;

export type GetTransform<Crt, Res> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  infer Options,
  infer Service,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Transform<Res, Event, Options, Service>
  : never;

export type GetTransformError<Crt, Res> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  infer Options,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>
  ? TransformError<Res, Event, Options>
  : never;
