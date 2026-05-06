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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
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
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
