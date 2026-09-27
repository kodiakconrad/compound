import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    api: { ...actual.api, post: jest.fn() },
  };
});

jest.mock("../lib/offlineQueue", () => ({
  enqueue: jest.fn(),
}));

import { ApiError, api } from "../lib/api";
import { enqueue } from "../lib/offlineQueue";
import { useLogSet } from "./useLogSet";
import type { ActiveSession } from "./useActiveSession";

const mockedApi = api as jest.Mocked<typeof api>;
const mockedEnqueue = enqueue as jest.Mock;

// A minimal active session with one exercise and no logged sets yet, matching
// the section_exercise_uuid the tests log a set against.
function buildSession(): ActiveSession {
  return {
    uuid: "session-1",
    cycle_id: 1,
    cycle_uuid: "cycle-1",
    program_workout_id: 1,
    workout_name: "Day A",
    sort_order: 1,
    status: "in_progress",
    sections: [
      {
        uuid: "section-1",
        name: "Compound",
        sort_order: 1,
        rest_seconds: 90,
        exercises: [
          {
            section_exercise_uuid: "sec-ex-1",
            exercise_uuid: "ex-1",
            exercise_name: "Bench Press",
            tracking_type: "weight_reps",
            sort_order: 1,
            set_logs: [],
          },
        ],
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// Every test's QueryClient is tracked here so afterEach can clear it. A
// settled mutation's cache entry is fine to garbage-collect instantly
// (gcTime: 0, set below) since nothing reads it back by key — but an
// inactive *query* entry (e.g. the ["activeSession"] data seeded via
// setQueryData below) is read back by these tests, so it can't use gcTime: 0
// without the entry disappearing before the assertion runs. Its default
// 5-minute gcTime would otherwise leave a real setTimeout scheduled, keeping
// the Jest process alive well past the test — clear() cancels that once the
// test's own assertions are done reading it.
const createdClients: QueryClient[] = [];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  createdClients.push(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

afterEach(() => {
  createdClients.forEach((c) => c.clear());
  createdClients.length = 0;
});

const args = {
  cycleUUID: "cycle-1",
  sessionUUID: "session-1",
  body: { section_exercise_uuid: "sec-ex-1", set_number: 1, actual_reps: 5, weight: 80 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useLogSet", () => {
  it("logs the set live and does not touch the offline queue on success", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(["activeSession"], buildSession());
    mockedApi.post.mockResolvedValue({
      uuid: "log-1",
      exercise_uuid: "ex-1",
      set_number: 1,
      completed_at: "2026-01-01T00:05:00Z",
    });

    const { result } = renderHook(() => useLogSet(), { wrapper });
    const onSuccess = jest.fn();
    result.current.mutate(args, { onSuccess });

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("shows the set as logged immediately (optimistic update), before the request settles", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(["activeSession"], buildSession());
    // Held open deliberately so we can inspect the mid-flight state, then
    // resolved at the end — a promise left permanently pending would leave
    // the mutation stuck "in flight" past the end of the test.
    let resolvePost: (value: unknown) => void = () => {};
    mockedApi.post.mockReturnValue(new Promise((resolve) => (resolvePost = resolve)));

    const { result } = renderHook(() => useLogSet(), { wrapper });
    result.current.mutate(args);

    await waitFor(() => {
      const session = queryClient.getQueryData<ActiveSession>(["activeSession"]);
      expect(session?.sections[0].exercises[0].set_logs).toHaveLength(1);
    });

    resolvePost({
      uuid: "log-1",
      exercise_uuid: "ex-1",
      set_number: 1,
      completed_at: "2026-01-01T00:05:00Z",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("queues the request and keeps the optimistic set when there's no network", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(["activeSession"], buildSession());
    mockedApi.post.mockRejectedValue(new TypeError("Network request failed"));

    const { result } = renderHook(() => useLogSet(), { wrapper });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    result.current.mutate(args, { onSuccess, onError });

    // A queued set resolves the mutation successfully rather than erroring,
    // so the caller (e.g. SessionView starting the rest timer) still fires.
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();

    expect(mockedEnqueue).toHaveBeenCalledWith(
      "POST",
      "/api/v1/cycles/cycle-1/sessions/session-1/sets",
      args.body,
      expect.any(String)
    );

    const session = queryClient.getQueryData<ActiveSession>(["activeSession"]);
    expect(session?.sections[0].exercises[0].set_logs).toHaveLength(1);
  });

  it("rolls back the optimistic set when the server rejects the request", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(["activeSession"], buildSession());
    mockedApi.post.mockRejectedValue(
      new ApiError("validation_failed", "set_number is required", 422)
    );

    const { result } = renderHook(() => useLogSet(), { wrapper });
    const onError = jest.fn();
    result.current.mutate(args, { onError });

    await waitFor(() => expect(onError).toHaveBeenCalled());

    expect(mockedEnqueue).not.toHaveBeenCalled();
    const session = queryClient.getQueryData<ActiveSession>(["activeSession"]);
    expect(session?.sections[0].exercises[0].set_logs).toHaveLength(0);
  });
});
