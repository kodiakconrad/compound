import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ActiveSession } from "./useActiveSession";

// ---------------------------------------------------------------------------
// useSessionDetail — fetch the full session detail for a given session
// ---------------------------------------------------------------------------

/**
 * useSessionDetail fetches `GET /api/v1/cycles/{cycleUUID}/sessions/{sessionUUID}`.
 *
 * Returns the full `SessionDetailResponse` — sections, exercises with computed
 * target weights, and any set_logs already recorded.
 *
 * Used by the Today tab to show a preview of the upcoming session's exercises
 * before the user starts it.
 *
 * Disabled when either UUID is undefined.
 */
export function useSessionDetail(
  cycleUUID: string | undefined,
  sessionUUID: string | undefined
) {
  return useQuery<ActiveSession>({
    queryKey: ["sessionDetail", cycleUUID, sessionUUID],
    queryFn: () =>
      api.get<ActiveSession>(
        `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}`
      ),
    enabled: cycleUUID !== undefined && sessionUUID !== undefined,
  });
}

// ---------------------------------------------------------------------------
// useStartSession — start a pending session
// ---------------------------------------------------------------------------

interface StartSessionArgs {
  cycleUUID: string;
  sessionUUID: string;
}

/**
 * useStartSession wraps `POST /api/v1/cycles/{cycleUUID}/sessions/{sessionUUID}/start`.
 *
 * Transitions a session from `pending` to `in_progress`. On success, invalidates
 * the active session and cycle caches so the Today tab updates.
 */
export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, StartSessionArgs>({
    mutationFn: ({ cycleUUID, sessionUUID }) =>
      api.post(
        `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/start`,
        {}
      ),
    onSuccess: () => {
      // The active session query will now pick up the newly started session.
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
}
