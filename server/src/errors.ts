import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '../../shared/api';

/** An error that becomes an `ApiError` JSON response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Hebrew message shown to the learner. */
    readonly hebrew: string,
  ) {
    super(code);
  }
}

export const badRequest = (code: string, hebrew: string) => new HttpError(400, code, hebrew);
export const unauthorized = () => new HttpError(401, 'unauthorized', 'יש להתחבר כדי להמשיך');

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiError = { error: 'internal', message: 'אירעה שגיאה בשרת, נסו שוב מאוחר יותר' };
  if (err instanceof HttpError) {
    status = err.status;
    body = { error: err.code, message: err.hebrew };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: 'invalid_json', message: 'הבקשה אינה תקינה' };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    body = { error: 'payload_too_large', message: 'הבקשה גדולה מדי' };
  } else {
    console.error(err);
  }
  res.status(status).json(body);
};
