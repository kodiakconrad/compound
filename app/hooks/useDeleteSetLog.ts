import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ActiveSession } from "./useActiveSession";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeleteSetLogArgs {
  cycleUUID: string;
  sessionUUID: string;
  setLogUUID: string;
  /** section_exercise_uuid used to locate the exercise in the optimistic cache. */
  sectionExerciseUUID: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useDeleteSetLog wraps `DELETE /api/v1/cycles/{cycleUUID}/sessions/{sessionUUID}/sets/{setLogUUID}`.
 *
 * Removes a single logged set. Used when the user taps a logged set button
 * to un-log it.
 *
 * Uses optimistic updates: the set immediately disappears from the UI,
 * and rolls back if the server rejects the delete.
 */
export function useDeleteSetLog() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteSetLogArgs, { previousSession: ActiveSession | null | undefined }>({
    mutationFn: ({ cycleUUID, sessionUUID, setLogUUID }) =>
      api.delete(`/api/v1/cycles/${cycleUUID}/sessions/${sessionUUID}/sets/${setLogUUID}`),

    // Optimistic update: immediately remove the set_log from the cache.
    onMutate: async ({ setLogUUID, sectionExerciseUUID }) => {
      await queryClient.cancelQueries({ queryKey: ["activeSession"] });

      const previousSession = queryClient.getQueryData<ActiveSession | null>(["activeSession"]);

      if (previousSession) {
        const updated = structuredClone(previousSession);
        for (const sec of updated.sections) {
          for (const ex of sec.exercises) {
            if (ex.section_exercise_uuid === sectionExerciseUUID) {
              ex.set_logs = ex.set_logs.filter((sl) => sl.uuid !== setLogUUID);
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

    // Always refetch to sync with server truth.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    },
  });
}
