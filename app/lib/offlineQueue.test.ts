// expo-sqlite is a native module — there's no real SQLite engine to run
// against in Jest, so this mock stands in a small in-memory table backing
// exactly the queries offlineQueue.ts issues (INSERT, the two status UPDATEs,
// the pending-rows SELECT, and the COUNT). The rows array lives inside the
// factory closure (not captured from outer scope) so it satisfies Jest's
// module-mock hoisting rules; __resetForTests lets each test start clean even
// though offlineQueue.ts caches a single db instance for the module's life.
jest.mock("expo-sqlite", () => {
  // A named `interface` here trips babel-plugin-jest-hoist's out-of-scope
  // check (it doesn't recognize TS interface declarations as local bindings
  // and flags the identifier as an external reference) — so this uses an
  // inline object type instead of a named one.
  let rows: {
    id: number;
    method: string;
    path: string;
    body: string | null;
    idempotency_key: string;
    created_at: string;
    status: string;
  }[] = [];
  let nextId = 1;

  const db = {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("INSERT INTO offline_queue")) {
        const [method, path, body, idempotency_key, created_at] = params as (string | null)[];
        rows.push({
          id: nextId++,
          method: method as string,
          path: path as string,
          body,
          idempotency_key: idempotency_key as string,
          created_at: created_at as string,
          status: "pending",
        });
      } else if (sql.includes("status = 'done'")) {
        const [id] = params as number[];
        const row = rows.find((r) => r.id === id);
        if (row) row.status = "done";
      } else if (sql.includes("status = 'failed'")) {
        const [id] = params as number[];
        const row = rows.find((r) => r.id === id);
        if (row) row.status = "failed";
      }
    }),
    getAllAsync: jest.fn(async () =>
      rows.filter((r) => r.status === "pending").sort((a, b) => a.id - b.id)
    ),
    getFirstAsync: jest.fn(async () => ({
      count: rows.filter((r) => r.status === "pending").length,
    })),
  };

  return {
    openDatabaseAsync: jest.fn(async () => db),
    __resetForTests: () => {
      rows = [];
      nextId = 1;
    },
  };
});

jest.mock("./api", () => {
  const actual = jest.requireActual("./api");
  return {
    ...actual,
    api: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});

import * as SQLite from "expo-sqlite";

import { ApiError, api } from "./api";
import { enqueue, flush, pendingCount, refreshPendingCount } from "./offlineQueue";
import { useOfflineQueueStore } from "../store/offlineQueue";

const mockedApi = api as jest.Mocked<typeof api>;
const resetFakeDb = (SQLite as unknown as { __resetForTests: () => void }).__resetForTests;

beforeEach(() => {
  resetFakeDb();
  jest.clearAllMocks();
  useOfflineQueueStore.setState({ pendingCount: 0 });
});

describe("enqueue", () => {
  it("adds a row and updates the shared pendingCount store immediately", async () => {
    await enqueue("POST", "/api/v1/x", { a: 1 });
    expect(await pendingCount()).toBe(1);
    expect(useOfflineQueueStore.getState().pendingCount).toBe(1);
  });

  it("reuses a passed-in idempotency key instead of generating a new one", async () => {
    const key = await enqueue("POST", "/api/v1/x", { a: 1 }, "fixed-key");
    expect(key).toBe("fixed-key");
  });

  it("generates a key when none is passed", async () => {
    const key = await enqueue("POST", "/api/v1/x", { a: 1 });
    expect(key).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("flush", () => {
  it("replays pending rows in insertion order, reusing each row's stored idempotency key", async () => {
    const key1 = await enqueue("POST", "/api/v1/a", { n: 1 });
    const key2 = await enqueue("POST", "/api/v1/b", { n: 2 });
    mockedApi.post.mockResolvedValue(undefined);

    await flush();

    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/api/v1/a", { n: 1 }, key1);
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/api/v1/b", { n: 2 }, key2);
  });

  it("marks a row done on success, dropping it from pendingCount", async () => {
    await enqueue("POST", "/api/v1/a", { n: 1 });
    mockedApi.post.mockResolvedValue(undefined);

    await flush();

    expect(await pendingCount()).toBe(0);
    expect(useOfflineQueueStore.getState().pendingCount).toBe(0);
  });

  it("leaves a row pending after a network error, so it's retried on the next flush", async () => {
    await enqueue("POST", "/api/v1/a", { n: 1 });
    mockedApi.post.mockRejectedValueOnce(new TypeError("Network request failed"));

    await flush();
    expect(await pendingCount()).toBe(1);

    mockedApi.post.mockResolvedValueOnce(undefined);
    await flush();
    expect(await pendingCount()).toBe(0);
  });

  it("leaves a row pending after a transient 5xx ApiError, so it's retried", async () => {
    await enqueue("PUT", "/api/v1/complete", {});
    mockedApi.put.mockRejectedValueOnce(new ApiError("internal_error", "boom", 500));

    await flush();

    expect(await pendingCount()).toBe(1);
  });

  it("marks a row failed (not retried) after a permanent 4xx ApiError", async () => {
    await enqueue("PUT", "/api/v1/complete", {});
    mockedApi.put.mockRejectedValueOnce(
      new ApiError("already_completed", "session already completed", 409)
    );

    await flush();
    expect(await pendingCount()).toBe(0);

    mockedApi.put.mockClear();
    await flush(); // a second flush should not attempt this row again
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  it("does not replay a duplicate idempotency key twice concurrently queued for the same request", async () => {
    // Same logical request enqueued once (e.g. useLogSet passed the same key
    // it used for the failed live attempt) — flush should send it exactly once.
    const key = await enqueue("POST", "/api/v1/a", { n: 1 }, "shared-key");
    mockedApi.post.mockResolvedValue(undefined);

    await flush();

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/v1/a", { n: 1 }, key);
  });
});

describe("refreshPendingCount", () => {
  it("syncs the store to the true DB count, e.g. rows left over from a previous app session", async () => {
    await enqueue("POST", "/api/v1/a", {});
    useOfflineQueueStore.setState({ pendingCount: 999 }); // simulate a stale/fresh store on app start

    await refreshPendingCount();

    expect(useOfflineQueueStore.getState().pendingCount).toBe(1);
  });
});
