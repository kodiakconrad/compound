import * as SQLite from "expo-sqlite";

import { api } from "./api";

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

function generateIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// enqueue adds a write request to the offline queue.
// Returns the idempotency key that was assigned to this request.
export async function enqueue(
  method: string,
  path: string,
  body?: unknown
): Promise<string> {
  const store = await getDb();
  const key = generateIdempotencyKey();
  const now = new Date().toISOString();
  await store.runAsync(
    `INSERT INTO offline_queue (method, path, body, idempotency_key, created_at, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [method, path, body !== undefined ? JSON.stringify(body) : null, key, now]
  );
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
      await (api as Record<string, (path: string, body?: unknown) => Promise<unknown>>)[
        row.method.toLowerCase()
      ](row.path, body);
      await store.runAsync(
        `UPDATE offline_queue SET status = 'done' WHERE id = ?`,
        [row.id]
      );
    } catch (err: unknown) {
      // 4xx errors are permanent failures — no point retrying
      const status = (err as { status?: number })?.status;
      if (status !== undefined && status >= 400 && status < 500) {
        await store.runAsync(
          `UPDATE offline_queue SET status = 'failed' WHERE id = ?`,
          [row.id]
        );
      }
      // Network errors: leave as 'pending', will retry on next flush()
    }
  }
}

// pendingCount returns the number of requests waiting to be synced.
// Used by the offline indicator banner.
export async function pendingCount(): Promise<number> {
  const store = await getDb();
  const result = await store.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM offline_queue WHERE status = 'pending'`
  );
  return result?.count ?? 0;
}
