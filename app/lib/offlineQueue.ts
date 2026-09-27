import * as SQLite from "expo-sqlite";

import { ApiError, api, generateIdempotencyKey } from "./api";
import { useOfflineQueueStore } from "../store/offlineQueue";

// The offline queue persists write requests to a local SQLite database so
// they survive app kills and network outages. When connectivity is restored,
// the queue is flushed in order using the same idempotency keys — the backend
// deduplicates any requests that were already processed before the network
// dropped.
//
// Queue lifecycle:
//   1. Caller enqueues a request (method + path + body) → returns idempotency key
//   2. Caller optimistically updates UI (via Zustand store or TanStack Query cache)
//   3. On reconnect, flush() replays all pending rows in insertion order
//   4. Rows are marked "done" on 2xx, kept as "pending" on network error

const DB_NAME = "compound_offline.db";

export type QueueStatus = "pending" | "done" | "failed";

export interface QueueRow {
  id: number;
  method: string;
  path: string;
  body: string | null;
  idempotency_key: string;
  created_at: string;
  status: QueueStatus;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      method           TEXT    NOT NULL,
      path             TEXT    NOT NULL,
      body             TEXT,
      idempotency_key  TEXT    NOT NULL UNIQUE,
      created_at       TEXT    NOT NULL,
      status           TEXT    NOT NULL DEFAULT 'pending'
    );
  `);
  return db;
}

// enqueue adds a write request to the offline queue.
//
// Pass the SAME idempotency key that was used for the live request attempt
// that just failed (rather than letting this generate a new one). That way,
// whether the original request actually reached the server before the
// network dropped or not, the eventual replay in flush() carries the exact
// key the server may have already seen — so it dedupes correctly either way.
// If no key is passed (e.g. queuing ahead of time, not after a failed live
// attempt), one is generated here.
//
// Returns the idempotency key that was assigned to this request.
export async function enqueue(
  method: string,
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<string> {
  const store = await getDb();
  const key = idempotencyKey ?? generateIdempotencyKey();
  const now = new Date().toISOString();
  await store.runAsync(
    `INSERT INTO offline_queue (method, path, body, idempotency_key, created_at, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [method, path, body !== undefined ? JSON.stringify(body) : null, key, now]
  );
  await refreshPendingCount();
  return key;
}

// flush replays all pending rows in insertion order.
// On success (2xx), marks the row as "done".
// On network error, leaves the row as "pending" to be retried next time.
// On a permanent error (4xx), marks the row as "failed" (no retry).
export async function flush(): Promise<void> {
  const store = await getDb();
  const rows = await store.getAllAsync<QueueRow>(
    `SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY id ASC`
  );

  for (const row of rows) {
    try {
      const body = row.body !== null ? JSON.parse(row.body) : undefined;
      // Reuse the row's stored idempotency key rather than generating a new
      // one — this is what makes the "duplicate replay is deduped" guarantee
      // hold even across app restarts or multiple flush() calls.
      await (
        api as Record<
          string,
          (path: string, body?: unknown, idempotencyKey?: string) => Promise<unknown>
        >
      )[row.method.toLowerCase()](row.path, body, row.idempotency_key);
      await store.runAsync(
        `UPDATE offline_queue SET status = 'done' WHERE id = ?`,
        [row.id]
      );
    } catch (err: unknown) {
      // A 4xx ApiError is a permanent rejection (e.g. the session was already
      // completed by the time this replayed) — no point retrying. A 5xx
      // ApiError or a plain network error is transient, so the row stays
      // 'pending' and is retried on the next flush().
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        await store.runAsync(
          `UPDATE offline_queue SET status = 'failed' WHERE id = ?`,
          [row.id]
        );
      }
    }
  }

  await refreshPendingCount();
}

// pendingCount returns the number of requests waiting to be synced.
export async function pendingCount(): Promise<number> {
  const store = await getDb();
  const result = await store.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM offline_queue WHERE status = 'pending'`
  );
  return result?.count ?? 0;
}

// refreshPendingCount re-reads the pending count and writes it into the
// shared Zustand store, so the offline banner (and anything else) reflects
// the true count. Called after every enqueue()/flush(), and once on app
// startup (rows may already be sitting in the queue from a previous session
// that was killed before it could sync).
export async function refreshPendingCount(): Promise<void> {
  const count = await pendingCount();
  useOfflineQueueStore.getState().setPendingCount(count);
}
