import { BASE_URL } from "../constants/config";

// ApiError is thrown when the server returns an error response envelope:
// { "error": { "code": "...", "message": "...", "details": [...] } }
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    /** The HTTP status the server responded with. Lets callers (like the
     * offline queue) tell a permanent rejection (4xx) apart from a transient
     * server error (5xx) that's worth retrying. */
    public readonly status: number,
    public readonly details?: unknown[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// generateIdempotencyKey creates a UUID v4 for use as an Idempotency-Key header.
// This ensures that retried write requests (POST/PATCH/DELETE) are not applied
// twice on the backend.
export function generateIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<T> {
  const isMutation = method !== "GET";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // TODO Step 8: Add auth header once Clerk is integrated:
    // "Authorization": `Bearer ${await getToken()}`,
  };

  if (isMutation) {
    // Every write request gets an idempotency key. If the network drops after
    // the server processes the request but before the client receives the
    // response, the client can safely retry with the SAME key and the server
    // will return the original response without re-applying the mutation.
    // Callers that may need to retry (e.g. the offline queue) should generate
    // the key up front and pass it in here, so every attempt for that same
    // logical request — live or replayed — uses one consistent key.
    headers["Idempotency-Key"] = idempotencyKey ?? generateIdempotencyKey();
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content has no body — return early.
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();

  if (!response.ok) {
    // Backend error envelope: { "error": { "code": "...", "message": "...", "details": [...] } }
    const err = json?.error;
    throw new ApiError(
      err?.code ?? "unknown_error",
      err?.message ?? `Request failed with status ${response.status}`,
      response.status,
      err?.details
    );
  }

  // Success envelope: { "data": ... }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown, idempotencyKey?: string) =>
    request<T>("POST", path, body, idempotencyKey),
  put: <T>(path: string, body: unknown, idempotencyKey?: string) =>
    request<T>("PUT", path, body, idempotencyKey),
  patch: <T>(path: string, body: unknown, idempotencyKey?: string) =>
    request<T>("PATCH", path, body, idempotencyKey),
  delete: <T>(path: string, idempotencyKey?: string) =>
    request<T>("DELETE", path, undefined, idempotencyKey),
};
