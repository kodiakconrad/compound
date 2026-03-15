import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkipSessionArgs {
  cycleUUID: string;
  sessionUUID: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSkipSession wraps `PUT /api/v1/cycles/{cycleUUID}/sessions/{sessionUUID}/skip`.
 *
 * Transitions a session from `pending` or `in_progress` to `skipped`.
 * Optionally accepts session notes.
 *
 * On success, invalidates active session and cycle caches.
 */
export function useSkipSession() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SkipSessionArgs>({
    mutationFn: ({ cycleUUID, sessionUUID, notes }) =>
      api.put(
        `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/skip`,
        notes !== undefined ? { notes } : {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      queryClient.invalidateQueries({ queryKey: ["sessionDetail"] });
    },
  });
}
