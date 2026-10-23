import { readFileSync } from 'node:fs';
import { Router } from 'express';
import type { HealthResponse } from '../../../shared/api';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export function healthRouter() {
  const router = Router();
  router.get('/health', (_req, res) => {
    const body: HealthResponse = { ok: true, version };
    res.json(body);
  });
  return router;
}
