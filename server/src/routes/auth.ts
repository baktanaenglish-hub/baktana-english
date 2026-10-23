import { Router, type RequestHandler } from 'express';
import type {
  AuthResponse,
  DeleteAccountRequest,
  LoginRequest,
  MeResponse,
  RegisterRequest,
} from '../../../shared/api';
import { getDummyHash, hashPassword, signToken, verifyPassword } from '../auth';
import { HttpError, badRequest } from '../errors';
import { publicUser, type Repo } from '../repo';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD = 200;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function validateRegister(body: unknown): RegisterRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = str(b.email).trim().toLowerCase();
  const password = str(b.password);
  const displayName = str(b.displayName).trim().replace(/\s+/g, ' ');
  if (!EMAIL_RE.test(email) || email.length > 254) throw badRequest('invalid_email', 'כתובת האימייל אינה תקינה');
  if (password.length < 8) throw badRequest('weak_password', 'הסיסמה צריכה להכיל לפחות 8 תווים');
  if (password.length > MAX_PASSWORD) throw badRequest('invalid_password', 'הסיסמה ארוכה מדי');
  if ([...displayName].length < 2 || [...displayName].length > 30) {
    throw badRequest('invalid_display_name', 'השם צריך להכיל בין 2 ל-30 תווים');
  }
  return { email, password, displayName };
}

export function authRouter(repo: Repo, secret: string, limiter: RequestHandler, requireAuth: RequestHandler) {
  const router = Router();

  router.post('/auth/register', limiter, async (req, res) => {
    const { email, password, displayName } = validateRegister(req.body);
    if (repo.findUserByEmail(email)) {
      throw new HttpError(409, 'email_taken', 'כבר קיים חשבון עם האימייל הזה');
    }
    const user = repo.createUser(email, displayName, await hashPassword(password));
    if (!user) throw new HttpError(409, 'email_taken', 'כבר קיים חשבון עם האימייל הזה');
    const body: AuthResponse = { token: signToken(user.id, secret), user: publicUser(user) };
    res.status(201).json(body);
  });

  router.post('/auth/login', limiter, async (req, res) => {
    const b = (req.body ?? {}) as Partial<LoginRequest>;
    const email = str(b.email).trim().toLowerCase();
    const password = str(b.password);
    if (!email || !password) throw badRequest('missing_credentials', 'יש להזין אימייל וסיסמה');
    const user = repo.findUserByEmail(email);
    // Always run scrypt so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(password.slice(0, MAX_PASSWORD), user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'האימייל או הסיסמה שגויים');
    const body: AuthResponse = { token: signToken(user.id, secret), user: publicUser(user) };
    res.json(body);
  });

  router.get('/me', requireAuth, (_req, res) => {
    const userId = res.locals.userId!;
    const user = repo.findUserById(userId)!;
    const body: MeResponse = { user: publicUser(user), progress: repo.getProgress(userId) };
    res.json(body);
  });

  router.delete('/me', limiter, requireAuth, async (req, res) => {
    const password = str((req.body as Partial<DeleteAccountRequest> | undefined)?.password);
    if (!password) throw badRequest('missing_password', 'יש להזין את הסיסמה כדי למחוק את החשבון');
    const userId = res.locals.userId!;
    const user = repo.findUserById(userId)!;
    if (!(await verifyPassword(password.slice(0, MAX_PASSWORD), user.passwordHash))) {
      throw new HttpError(401, 'invalid_credentials', 'הסיסמה שגויה');
    }
    repo.deleteUser(userId);
    res.status(204).end();
  });

  return router;
}
