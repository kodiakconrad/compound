import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  logSet,
  type LogSetInput,
} from "../db/repositories/session_repository";
import type { SetLog } from "../domain/session";
import type { ActiveSession } from "./useActiveSession";

interface LogSetArgs {
  cycleUUID: string;
  sessionUUID: string;
  body: LogSetInput;
}

// useLogSet inserts a set log into local SQLite.
// Keeps optimistic update pattern for instant UI feedback.
export function useLogSet() {
  const queryClient = useQueryClient();

  return useMutation<SetLog, Error, LogSetArgs, { previousSession: ActiveSession | null | undefined }>({
    mutationFn: async ({ sessionUUID, body }) => logSet(sessionUUID, body),

    onMutate: async ({ body }) => {
      await queryClient.cancelQueries({ queryKey: ["activeSession"] });
      const previousSession = queryClient.getQueryData<ActiveSession | null>(["activeSession"]);

      if (previousSession && body.section_exercise_uuid) {
        const updated = structuredClone(previousSession);
        for (const sec of updated.sections) {
          for (const ex of sec.exercises) {
            if (ex.section_exercise_uuid === body.section_exercise_uuid) {
              ex.set_logs.push({
                id: 0,
                uuid: `optimistic-${Date.now()}`,
                session_id: 0,
                exercise_id: 0,
                exercise_uuid: ex.exercise_uuid,
                section_exercise_id: null,
                section_exercise_uuid: body.section_exercise_uuid,
                set_number: body.set_number,
                target_reps: body.target_reps ?? null,
                actual_reps: body.actual_reps ?? null,
                weight: body.weight ?? null,
                duration: body.duration ?? null,
                distance: body.distance ?? null,
                rpe: body.rpe ?? null,
                completed_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              });
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
