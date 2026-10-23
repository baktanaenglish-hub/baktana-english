import type {
  ApiError,
  AuthResponse,
  CompleteLessonRequest,
  CreateGroupRequest,
  DeleteAccountRequest,
  DuelResponse,
  DuelsResponse,
  GroupLeaderboardResponse,
  GroupMembersResponse,
  GroupResponse,
  GroupsResponse,
  HealthResponse,
  ItemStates,
  JoinDuelRequest,
  JoinGroupRequest,
  LeaderboardResponse,
  LoginRequest,
  MeResponse,
  Period,
  PetBadge,
  Progress,
  ProgressResponse,
  PutSrsRequest,
  RegisterRequest,
  SetPetRequest,
  SrsResponse,
  User,
} from '../../shared/api';
import { ApiRequestError, OFFLINE_MESSAGE } from './api-error';
import { createCloudApi } from './cloud';
import { USE_SUPABASE } from './config';

/** Typed client for the HTTP contract in shared/api.ts. All URLs are relative (`/api/...`). */

const AUTH_KEY = 'baktana-english:auth:v1';
const TIMEOUT_MS = 10_000;

export { ApiRequestError, OFFLINE_MESSAGE };

const GENERIC_MESSAGE = 'משהו השתבש. נסו שוב בעוד רגע.';

export interface StoredAuth {
  token: string;
  user: User;
}

export function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed && typeof parsed.token === 'string' && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    // Storage unavailable – the session lasts until reload.
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // Ignore.
  }
}

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && typeof (body as ApiError).message === 'string';
}

async function request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = loadAuth()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (auth) throw new ApiRequestError(401, 'unauthorized', 'צריך להתחבר כדי לעשות את זה.');

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal:
        typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, 'network', OFFLINE_MESSAGE);
  }

  // No content (e.g. DELETE /api/me).
  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON – e.g. the dev proxy's error page when no server is running.
  }

  if (!res.ok) {
    if (isApiError(data)) throw new ApiRequestError(res.status, data.error, data.message);
    // A proxy/gateway failure without our JSON body means the API is unreachable.
    const unreachable = res.status >= 500 || res.status === 404;
    throw new ApiRequestError(unreachable ? 0 : res.status, 'http', unreachable ? OFFLINE_MESSAGE : GENERIC_MESSAGE);
  }
  if (data === null) throw new ApiRequestError(0, 'bad-response', OFFLINE_MESSAGE);
  return data as T;
}

const restApi = {
  health: () => request<HealthResponse>('GET', '/health'),
  register: (req: RegisterRequest) => request<AuthResponse>('POST', '/auth/register', req),
  login: (req: LoginRequest) => request<AuthResponse>('POST', '/auth/login', req),
  me: () => request<MeResponse>('GET', '/me', undefined, true),
  /** Deletes the account and all its data on the server (the password is checked again). */
  deleteAccount: (password: string) =>
    request<void>('DELETE', '/me', { password } satisfies DeleteAccountRequest, true),
  getProgress: () => request<ProgressResponse>('GET', '/progress', undefined, true),
  putProgress: (progress: Progress) => request<ProgressResponse>('PUT', '/progress', progress, true),
  completeLesson: (lessonId: string, req: CompleteLessonRequest) =>
    request<ProgressResponse>('POST', `/lessons/${encodeURIComponent(lessonId)}/complete`, req, true),
  /** Spaced-repetition state (docs/spec/v2.md §6.4): the full state, and upload of a delta. */
  getSrs: () => request<SrsResponse>('GET', '/srs', undefined, true),
  putSrs: (items: ItemStates) => request<SrsResponse>('PUT', '/srs', { items } satisfies PutSrsRequest, true),
  /** Forgets the whole review state (progress reset). */
  deleteSrs: () => request<void>('DELETE', '/srs', undefined, true),
  /** Works signed out too; with a token the server marks the learner's own row (`isMe`). */
  leaderboard: (period?: Period) =>
    request<LeaderboardResponse>('GET', period ? `/leaderboard?period=${period}` : '/leaderboard'),
  /** Groups (shared/groups.ts): the learner's groups, creating, joining, members and leaving. */
  groups: () => request<GroupsResponse>('GET', '/groups', undefined, true),
  createGroup: (name: string) => request<GroupResponse>('POST', '/groups', { name } satisfies CreateGroupRequest, true),
  joinGroup: (code: string) =>
    request<GroupResponse>('POST', '/groups/join', { code } satisfies JoinGroupRequest, true),
  groupMembers: (id: string, period: Period) =>
    request<GroupMembersResponse>('GET', `/groups/${encodeURIComponent(id)}/members?period=${period}`, undefined, true),
  leaveGroup: (id: string) => request<void>('DELETE', `/groups/${encodeURIComponent(id)}/membership`, undefined, true),
  /** Works signed out too; with a token the learner's groups are marked (`isMine`). */
  groupLeaderboard: (period: Period) =>
    request<GroupLeaderboardResponse>('GET', `/groups/leaderboard?period=${period}`),
  /** Head-to-head duels (shared/duels.ts): the learner's duels, opening one, accepting one and withdrawing one. */
  duels: () => request<DuelsResponse>('GET', '/duels', undefined, true),
  createDuel: () => request<DuelResponse>('POST', '/duels', {}, true),
  joinDuel: (code: string) => request<DuelResponse>('POST', '/duels/join', { code } satisfies JoinDuelRequest, true),
  cancelDuel: (id: string) => request<void>('DELETE', `/duels/${encodeURIComponent(id)}`, undefined, true),
  /** Shares the learner's pet with their groups; null stops sharing. */
  setPet: (pet: PetBadge | null) => request<void>('PUT', '/me/pet', { pet } satisfies SetPetRequest, true),
  /** Tokens are stateless – signing out only forgets the stored one (see clearAuth). */
  signOut: async () => {},
};

// supabase-js is only downloaded when a Supabase build actually needs it.
const cloudApi = createCloudApi(() => import('./supabase').then((m) => m.getSupabase()));

/** REST client for the Express server, or the Supabase backend in static/app builds. */
export const api = USE_SUPABASE ? { ...restApi, ...cloudApi } : restApi;

/** Hebrew message for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_MESSAGE;
}
