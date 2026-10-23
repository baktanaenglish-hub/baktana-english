import { existsSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import express, { type RequestHandler } from 'express';
import { parsePremiumEmails } from '../../shared/premium';
import { authenticate, rateLimit, resolveSecret } from './auth';
import type { Db } from './db';
import { HttpError, errorHandler } from './errors';
import { createRepo } from './repo';
import { authRouter } from './routes/auth';
import { callRouter, type CallModelOptions } from './routes/call';
import { eventsRouter } from './routes/events';
import { duelsRouter } from './routes/duels';
import { groupsRouter } from './routes/groups';
import { healthRouter } from './routes/health';
import { leaderboardRouter } from './routes/leaderboard';
import { petRouter } from './routes/pet';
import { progressRouter } from './routes/progress';
import { srsRouter } from './routes/srs';

export interface AppOptions {
  /** Defaults to resolveSecret() (JWT_SECRET env). */
  secret?: string;
  /** Requests per window on each auth endpoint, per IP. */
  authRateLimit?: { max: number; windowMs: number };
  /** Requests per window on POST /api/events, per IP (default 60 per minute). */
  eventsRateLimit?: { max: number; windowMs: number };
  /** Requests per window on POST /api/call/turn, per IP (default 30 per minute). */
  callRateLimit?: { max: number; windowMs: number };
  /** Anthropic API settings for the AI video call (defaults: ANTHROPIC_API_KEY, CALL_MODEL env). */
  anthropic?: CallModelOptions;
  /** Comma-separated emails allowed to use the AI video call (defaults to the PREMIUM_EMAILS env). */
  premiumEmails?: string;
  /** Comma-separated emails of testers, who get a short daily trial call (defaults to the TESTER_EMAILS env). */
  testerEmails?: string;
  /** Directory of the built web app to serve; defaults to ../dist in production. */
  staticDir?: string | false;
  /** Allow cross-origin requests from localhost (dev only by default). */
  cors?: boolean;
  /** Honour X-Forwarded-For (set when running behind a reverse proxy). */
  trustProxy?: boolean;
}

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
  next();
};

const devCors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
  }
  next();
};

export function createApp(db: Db, options: AppOptions = {}) {
  const production = process.env.NODE_ENV === 'production';
  const secret = options.secret ?? resolveSecret();
  const repo = createRepo(db);
  const userExists = (id: string) => repo.findUserById(id) !== undefined;
  const requireAuth = authenticate(secret, userExists, true);
  const optionalAuth = authenticate(secret, userExists, false);
  const limiter = rateLimit(options.authRateLimit ?? { max: 20, windowMs: 15 * 60 * 1000 });
  const eventsLimiter = rateLimit(options.eventsRateLimit ?? { max: 60, windowMs: 60 * 1000 });
  const callLimiter = rateLimit(options.callRateLimit ?? { max: 30, windowMs: 60 * 1000 });

  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy ?? process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(securityHeaders);
  if (options.cors ?? !production) app.use('/api', devCors);

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(healthRouter());
  api.use(authRouter(repo, secret, limiter, requireAuth));
  api.use(progressRouter(repo, requireAuth));
  api.use(leaderboardRouter(repo, optionalAuth));
  api.use(groupsRouter(repo, requireAuth, optionalAuth));
  api.use(duelsRouter(repo, requireAuth));
  api.use(srsRouter(repo, requireAuth));
  api.use(eventsRouter(repo, optionalAuth, eventsLimiter));
  const premiumEmails = parsePremiumEmails(options.premiumEmails ?? process.env.PREMIUM_EMAILS);
  const testerEmails = parsePremiumEmails(options.testerEmails ?? process.env.TESTER_EMAILS);
  api.use(callRouter(repo, options.anthropic ?? {}, premiumEmails, requireAuth, callLimiter, testerEmails));
  api.use(petRouter(repo, options.anthropic ?? {}, premiumEmails, requireAuth, callLimiter));
  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'הנתיב המבוקש לא נמצא')));
  app.use('/api', api);

  const staticDir = options.staticDir ?? (production ? resolve(import.meta.dirname, '../../dist') : false);
  if (staticDir) {
    if (!existsSync(join(staticDir, 'index.html'))) {
      console.warn(`[server] ${staticDir}/index.html not found – run "npm run build" at the repo root`);
    }
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders(res, filePath) {
          const name = basename(filePath);
          if (name === 'index.html' || name === 'sw.js' || name === 'manifest.webmanifest') {
            // The app shell and service worker must always be revalidated so updates reach learners.
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${sep}assets${sep}`)) {
            // Vite's hashed bundles never change under the same name.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
          }
        },
      }),
    );
    // SPA fallback: any other GET outside /api gets the app shell.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(staticDir, 'index.html'), (err) => err && next(err));
    });
  }

  app.use(errorHandler);
  return app;
}
