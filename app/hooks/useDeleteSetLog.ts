import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteSetLog } from "../db/repositories/session_repository";
import type { ActiveSession } from "./useActiveSession";

interface DeleteSetLogArgs {
  cycleUUID: string;
  sessionUUID: string;
  setLogUUID: string;
  sectionExerciseUUID: string;
}

// useDeleteSetLog removes a single set log from local SQLite.
// Optimistic update removes it from the UI immediately.
export function useDeleteSetLog() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteSetLogArgs, { previousSession: ActiveSession | null | undefined }>({
    mutationFn: async ({ setLogUUID }) => deleteSetLog(setLogUUID),

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

    onError: (_err, _vars, context) => {
      if (context?.previousSession !== undefined) {
        queryClient.setQueryData(["activeSession"], context.previousSession);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    },
  });
}
