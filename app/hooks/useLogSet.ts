import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ActiveSession, SetLogResponse } from "./useActiveSession";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches backend LogSetRequest DTO. */
interface LogSetRequest {
  section_exercise_uuid?: string;
  exercise_uuid?: string;
  set_number: number;
  target_reps?: number;
  actual_reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
}

interface LogSetArgs {
  cycleUUID: string;
  sessionUUID: string;
  body: LogSetRequest;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useLogSet wraps `POST /api/v1/cycles/{cycleUUID}/sessions/{sessionUUID}/sets`.
 *
 * Logs a single set for an exercise within the active session.
 *
 * On success, invalidates the active session query so the set buttons update.
 * Uses optimistic updates: the set immediately appears as logged in the UI,
 * and rolls back if the server rejects it.
 */
export function useLogSet() {
  const queryClient = useQueryClient();

  return useMutation<SetLogResponse, Error, LogSetArgs, { previousSession: ActiveSession | null | undefined }>({
    mutationFn: ({ cycleUUID, sessionUUID, body }) =>
      api.post<SetLogResponse>(
        `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/sets`,
        body
      ),

    // Optimistic update: immediately show the set as logged.
    onMutate: async ({ body }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update.
      await queryClient.cancelQueries({ queryKey: ["activeSession"] });

      // Snapshot the previous value.
      const previousSession = queryClient.getQueryData<ActiveSession | null>(["activeSession"]);

      // Optimistically add the set_log to the matching exercise.
      if (previousSession && body.section_exercise_uuid) {
        const updated = structuredClone(previousSession);
        for (const sec of updated.sections) {
          for (const ex of sec.exercises) {
            if (ex.section_exercise_uuid === body.section_exercise_uuid) {
              ex.set_logs.push({
                uuid: `optimistic-${Date.now()}`,
                exercise_uuid: ex.exercise_uuid,
                section_exercise_uuid: body.section_exercise_uuid,
                set_number: body.set_number,
                actual_reps: body.actual_reps,
                weight: body.weight,
                duration: body.duration,
                distance: body.distance,
                completed_at: new Date().toISOString(),
              });
              break;
            }
          }
        }
        queryClient.setQueryData(["activeSession"], updated);
      }

      return { previousSession };
    },

    // Roll back on error.
    onError: (_err, _vars, context) => {
      if (context?.previousSession !== undefined) {
        queryClient.setQueryData(["activeSession"], context.previousSession);
      }
    },

    // Always refetch after mutation settles to ensure server truth.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    },
  });
}
