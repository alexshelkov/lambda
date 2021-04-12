import { Err } from '@alexshelkov/result';
import {
  Handler,
  HandlerError,
  HandlerException,
  Transform,
  TransformError,
  MiddlewareCreator,
} from './types';
import { Creator } from './creator';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type GetOpt<Crt> = Crt extends Creator<
  any,
  any,
  any,
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
  : Crt extends MiddlewareCreator<infer Options, any, any, any, any>
  ? Options
  : never;

export type GetService<Crt> = Crt extends Creator<
  any,
  any,
  any,
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
  : Crt extends MiddlewareCreator<any, infer Service, any, any, any>
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
  any,
  any,
  any,
  any
>
  ? Event
  : Crt extends MiddlewareCreator<any, any, any, any, infer Event>
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
  : Crt extends MiddlewareCreator<any, any, infer Error, any, any>
  ? Error
  : never;

export type GetHandler<Crt, Data, Error> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
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
  : Crt extends MiddlewareCreator<infer Options, infer Service, any, any, infer Event>
  ? Handler<Service, Data, Error, Event, Options>
  : never;

export type GetHandlerError<Crt, Data, Error, HandledError = never> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
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
  ? HandlerError<ServiceError, Data, Error, HandledError, Event, Options>
  : Crt extends MiddlewareCreator<infer Options, any, infer ServiceError, any, infer Event>
  ? HandlerError<ServiceError, Data, Error, HandledError, Event, Options>
  : never;

export type GetHandlerException<Crt, Data, Error> = Crt extends Creator<
  infer Event,
  any,
  any,
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
  ? HandlerException<Data, Error, Event, Options>
  : Crt extends MiddlewareCreator<infer Options, any, any, any, infer Event>
  ? HandlerException<Data, Error, Event, Options>
  : never;

export type GetTransform<Crt, Res> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  any,
  any,
  any,
  infer Options,
  infer Service,
  any,
  infer Data,
  infer Error,
  any,
  any,
  any,
  any,
  any
>
  ? Transform<Res, Data, Error, Event, Options, Service>
  : Crt extends MiddlewareCreator<infer Options, infer Service, any, any, infer Event>
  ? Transform<Res, unknown, Err, Event, Options, Service>
  : never;

export type GetTransformFailure<Crt, Res> = Crt extends Creator<
  infer Event,
  any,
  any,
  any,
  any,
  any,
  any,
  infer Options,
  any,
  any,
  any,
  any,
  infer Data,
  infer Error,
  any,
  any,
  any
>
  ? TransformError<Res, Data, Error, Event, Options>
  : Crt extends MiddlewareCreator<infer Options, any, any, any, infer Event>
  ? TransformError<Res, unknown, Err, Event, Options>
  : never;

export type GetTransformException<Crt, Res> = Crt extends Creator<
  infer Event,
  any,
  any,
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
  infer Data,
  infer Error,
  any
>
  ? TransformError<Res, Data, Error, Event, Options>
  : Crt extends MiddlewareCreator<infer Options, any, any, any, infer Event>
  ? TransformError<Res, unknown, Err, Event, Options>
  : never;

export type GetOptionMdl<Mdl> = Mdl extends MiddlewareCreator<infer Option, any, any, any, any>
  ? Option
  : never;

export type GetServiceMdl<Mdl> = Mdl extends MiddlewareCreator<any, infer Service, any, any, any>
  ? Service
  : never;

export type GetErrorMdl<Mdl> = Mdl extends MiddlewareCreator<any, any, infer Error, any, any>
  ? Error
  : never;

export type GetDepsMdl<Mdl> = Mdl extends MiddlewareCreator<any, any, any, infer Deps, any>
  ? Deps
  : never;

export type GetEventMdl<Mdl> = Mdl extends MiddlewareCreator<any, any, any, any, infer Event>
  ? Event
  : never;
