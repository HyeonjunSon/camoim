import 'server-only';
import { toCamel } from './camel';
import { readSessionToken } from './session';

const API_URL = (process.env.CAMOIM_API_URL ?? 'https://camoim-production.up.railway.app/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiOptions = {
  method?: Method;
  body?: unknown;
  /** Attach the session token when one exists. Default true. */
  auth?: boolean;
  /** Seconds of ISR for anonymous GETs. Ignored once a token is attached. */
  revalidate?: number;
  signal?: AbortSignal;
};

type Envelope<T> = { success: boolean; message?: string; code?: string; data?: T };

export function apiBaseUrl(): string {
  return API_URL;
}

/**
 * Calls the Railway API from the server side.
 *
 * Deliberately does NOT send `x-app-version`: systemGuard only enforces the
 * force-update gate when that header is present, and the web app has no store
 * build to update (server/middleware/systemGuard.js).
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, revalidate, signal } = options;
  const token = auth ? await readSessionToken() : null;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // A personalised response must never land in the shared data cache.
  const cacheOptions =
    token || method !== 'GET'
      ? { cache: 'no-store' as const }
      : { next: { revalidate: revalidate ?? 60 } };

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    ...cacheOptions,
  });

  const payload = (await res.json().catch(() => null)) as Envelope<unknown> | null;

  if (!res.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message || '요청에 실패했습니다.',
      res.status,
      payload?.code
    );
  }

  return toCamel<T>(payload?.data ?? payload);
}

/** Returns null instead of throwing, for optional sections of a page. */
export async function apiFetchOrNull<T>(path: string, options: ApiOptions = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch {
    return null;
  }
}
