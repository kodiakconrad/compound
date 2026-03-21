import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteWorkout } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

interface DeleteWorkoutArgs {
  programUuid: string;
  workoutUuid: string;
}

// useDeleteWorkout deletes a workout from local SQLite.
export function useDeleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, DeleteWorkoutArgs>({
    mutationFn: async ({ programUuid, workoutUuid }) =>
      deleteWorkout(programUuid, workoutUuid),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
