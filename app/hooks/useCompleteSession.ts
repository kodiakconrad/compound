import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, generateIdempotencyKey } from "../lib/api";
import { enqueue } from "../lib/offlineQueue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompleteSessionArgs {
  cycleUUID: string;
  sessionUUID: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useCompleteSession wraps `PUT /api/v1/cycles/{cycleUUID}/sessions/{sessionUUID}/complete`.
 *
 * Transitions a session from `in_progress` to `completed`. Optionally accepts
 * session notes.
 *
 * On success, invalidates active session and cycle caches so the Today tab
 * refreshes to show the next pending session (or "cycle complete").
 *
 * If the request fails because there's no network (not a server rejection),
 * it's queued via the offline queue instead of erroring — the completion is
 * treated as locally successful and replayed once connectivity returns.
 */
export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, CompleteSessionArgs>({
    mutationFn: async ({ cycleUUID, sessionUUID, notes }) => {
      const path = `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/complete`;
      const body = notes !== undefined ? { notes } : {};
      const idempotencyKey = generateIdempotencyKey();
      try {
        return await api.put(path, body, idempotencyKey);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        await enqueue("PUT", path, body, idempotencyKey);
        return { queued: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      queryClient.invalidateQueries({ queryKey: ["sessionDetail"] });
    },
  });
}
