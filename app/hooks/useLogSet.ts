import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, api, generateIdempotencyKey } from "../lib/api";
import { enqueue } from "../lib/offlineQueue";
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
 * and rolls back if the server rejects it (a real validation error).
 *
 * If the request fails because there's no network (not a server rejection),
 * it's queued via the offline queue instead of rolling back — the set stays
 * showing as logged, and the queue replays it once connectivity returns.
 */
export function useLogSet() {
  const queryClient = useQueryClient();

  return useMutation<SetLogResponse, Error, LogSetArgs, { previousSession: ActiveSession | null | undefined }>({
    mutationFn: async ({ cycleUUID, sessionUUID, body }) => {
      const path = `/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/sets`;
      // Generated up front so that if this attempt fails and gets queued, the
      // replay reuses the exact same key — see lib/offlineQueue.ts.
      const idempotencyKey = generateIdempotencyKey();
      try {
        return await api.post<SetLogResponse>(path, body, idempotencyKey);
      } catch (err) {
        // A real server rejection (e.g. validation error) — surface it so
        // onError rolls back the optimistic update.
        if (err instanceof ApiError) throw err;

        // No network — queue for later and treat this as locally successful.
        // The optimistic set_log already applied in onMutate stays in place.
        await enqueue("POST", path, body, idempotencyKey);
        return {
          uuid: `offline-${idempotencyKey}`,
          exercise_uuid: body.exercise_uuid ?? "",
          section_exercise_uuid: body.section_exercise_uuid,
          set_number: body.set_number,
          target_reps: body.target_reps,
          actual_reps: body.actual_reps,
          weight: body.weight,
          duration: body.duration,
          distance: body.distance,
          rpe: body.rpe,
          completed_at: new Date().toISOString(),
        };
      }
    },

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
