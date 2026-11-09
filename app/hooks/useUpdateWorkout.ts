import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateWorkout } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

export interface UpdateWorkoutBody {
  name?: string;
  day_number?: number;
}

interface UpdateWorkoutArgs {
  programUuid: string;
  workoutUuid: string;
  body: UpdateWorkoutBody;
}

// useUpdateWorkout updates a workout in local SQLite.
export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, UpdateWorkoutArgs>({
    mutationFn: async ({ programUuid, workoutUuid, body }) =>
      updateWorkout(programUuid, workoutUuid, body),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
