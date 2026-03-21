import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createExercise,
  type CreateExerciseInput,
} from "../db/repositories/exercise_repository";
import type { Exercise } from "../domain/exercise";

// useCreateExercise writes a new exercise to local SQLite.
// On success it invalidates the ["exercises"] query so the library list
// immediately shows the newly created exercise.
export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation<Exercise, Error, CreateExerciseInput>({
    mutationFn: async (input) => createExercise(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}
