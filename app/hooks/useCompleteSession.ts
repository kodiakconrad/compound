import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

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
 */
export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, CompleteSessionArgs>({
    mutationFn: ({ cycleUUID, sessionUUID, notes }) =>
      api.put(
        `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/complete`,
        notes !== undefined ? { notes } : {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      queryClient.invalidateQueries({ queryKey: ["sessionDetail"] });
    },
  });
}
