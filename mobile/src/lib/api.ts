import { API_BASE_URL } from "../config/env";
import { getToken, clearToken } from "./authToken";

type NestError = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export class ApiError extends Error {
  status: number;
  payload?: NestError;

  constructor(status: number, message: string, payload?: NestError) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * La toute première requête après un (re)démarrage échoue parfois avec une
 * simple "Network request failed" (souvent une négociation IPv4/IPv6 qui
 * tâtonne) — les suivantes passent normalement. On absorbe ça avec quelques
 * tentatives silencieuses plutôt que de faire échouer l'action de l'utilisateur.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(300 * (i + 1));
    }
  }
  throw lastError;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await parseJsonSafe(res);

  if (res.status === 401) {
    // Token invalide/expiré → on purge
    await clearToken();
  }

  if (!res.ok) {
    const payload: NestError | undefined = json ?? undefined;
    const raw = payload?.message;
    const msg = (Array.isArray(raw) ? raw.join(", ") : raw) || `HTTP ${res.status}`;

    throw new ApiError(res.status, msg, payload);
  }

  return json as T;
}

async function upload<T>(
  path: string,
  file: { uri: string; name: string; type: string },
): Promise<T> {
  const token = await getToken();

  const form = new FormData();
  // React Native's fetch accepts this shape for a file part; TS's DOM lib
  // doesn't know about it, hence the cast.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  let res: Response;
  try {
    res = await fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        // Ne PAS fixer Content-Type ici : fetch doit générer lui-même le
        // boundary multipart/form-data.
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
  } catch (e: any) {
    console.error("[api.upload] network error", path, e);
    throw new Error(
      `Requête réseau échouée (${API_BASE_URL}) : ${e?.message ?? String(e)}`,
    );
  }

  const json = await parseJsonSafe(res);

  if (res.status === 401) {
    await clearToken();
  }

  if (!res.ok) {
    const payload: NestError | undefined = json ?? undefined;
    const raw = payload?.message;
    const msg = (Array.isArray(raw) ? raw.join(", ") : raw) || `HTTP ${res.status}`;
    console.error("[api.upload] server error", path, res.status, payload);
    throw new ApiError(res.status, msg, payload);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload,
};
