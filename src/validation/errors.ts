export type ApiErrorCode = 'validation_error' | 'not_found' | 'conflict';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiResult<T> =
  | { status: 200 | 201 | 204; ok: true; data: T }
  | { status: 400 | 404 | 409; ok: false; body: ApiErrorBody };

export function ok<T>(data: T): ApiResult<T> {
  return { status: 200, ok: true, data };
}

export function created<T>(data: T): ApiResult<T> {
  return { status: 201, ok: true, data };
}

export function noContent(): ApiResult<null> {
  return { status: 204, ok: true, data: null };
}

export function validationError(message: string): ApiResult<never> {
  return {
    status: 400,
    ok: false,
    body: {
      error: {
        code: 'validation_error',
        message,
      },
    },
  };
}

export function notFound(message: string): ApiResult<never> {
  return {
    status: 404,
    ok: false,
    body: {
      error: {
        code: 'not_found',
        message,
      },
    },
  };
}

export function conflict(message: string): ApiResult<never> {
  return {
    status: 409,
    ok: false,
    body: {
      error: {
        code: 'conflict',
        message,
      },
    },
  };
}
