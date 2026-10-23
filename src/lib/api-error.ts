// Kept apart from api.ts so the Supabase backend (cloud.ts) can share it without an import cycle.

export const OFFLINE_MESSAGE = 'אין חיבור לשרת כרגע. אפשר להמשיך ללמוד – נסנכרן אחר כך.';

/** Error thrown for every failed request. `message` is Hebrew and safe to show as-is. */
export class ApiRequestError extends Error {
  /** HTTP status, or 0 when the server could not be reached. */
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }

  get offline() {
    return this.status === 0;
  }

  get unauthorized() {
    return this.status === 401;
  }
}
