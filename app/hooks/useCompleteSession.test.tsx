import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return {
    ...actual,
    api: { ...actual.api, put: jest.fn() },
  };
});

jest.mock("../lib/offlineQueue", () => ({
  enqueue: jest.fn(),
}));

import { ApiError, api } from "../lib/api";
import { enqueue } from "../lib/offlineQueue";
import { useCompleteSession } from "./useCompleteSession";

const mockedApi = api as jest.Mocked<typeof api>;
const mockedEnqueue = enqueue as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // gcTime: 0 on both — an inactive query and a settled mutation each
      // otherwise schedule a real 5-minute setTimeout for garbage collection,
      // which keeps the Jest process alive well past the test. Fine in the
      // app itself; just noise in a test that ends in milliseconds.
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

const args = { cycleUUID: "cycle-1", sessionUUID: "session-1", notes: "felt strong" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useCompleteSession", () => {
  it("completes the session live and does not touch the offline queue on success", async () => {
    const { wrapper } = createWrapper();
    mockedApi.put.mockResolvedValue({});

    const { result } = renderHook(() => useCompleteSession(), { wrapper });
    const onSuccess = jest.fn();
    result.current.mutate(args, { onSuccess });

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(mockedApi.put).toHaveBeenCalledWith(
      "/api/v1/cycles/cycle-1/sessions/session-1/complete",
      { notes: "felt strong" },
      expect.any(String)
    );
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("queues the completion and treats it as successful when there's no network", async () => {
    const { wrapper } = createWrapper();
    mockedApi.put.mockRejectedValue(new TypeError("Network request failed"));

    const { result } = renderHook(() => useCompleteSession(), { wrapper });
    const onSuccess = jest.fn();
    const onError = jest.fn();
    result.current.mutate(args, { onSuccess, onError });

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();

    expect(mockedEnqueue).toHaveBeenCalledWith(
      "PUT",
      "/api/v1/cycles/cycle-1/sessions/session-1/complete",
      { notes: "felt strong" },
      expect.any(String)
    );
  });

  it("surfaces a server rejection instead of queuing it", async () => {
    const { wrapper } = createWrapper();
    mockedApi.put.mockRejectedValue(
      new ApiError("invalid_state", "session is not in_progress", 409)
    );

    const { result } = renderHook(() => useCompleteSession(), { wrapper });
    const onError = jest.fn();
    result.current.mutate(args, { onError });

    await waitFor(() => expect(onError).toHaveBeenCalled());

    expect(mockedEnqueue).not.toHaveBeenCalled();
  });
});
