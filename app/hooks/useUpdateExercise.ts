import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  updateExercise,
  type CreateExerciseInput,
} from "../db/repositories/exercise_repository";
import type { Exercise } from "../domain/exercise";

interface UpdateExerciseVariables {
  uuid: string;
  updates: Partial<CreateExerciseInput>;
}

// useUpdateExercise saves edits to an existing exercise in local SQLite.
// An exercise's name shows up in many cached queries (library, program
// detail, the active session, progress), so on success we invalidate every
// query rather than tracking each key — edits are rare and reads are local.
export function useUpdateExercise() {
  const queryClient = useQueryClient();

  return useMutation<Exercise, Error, UpdateExerciseVariables>({
    mutationFn: async ({ uuid, updates }) => updateExercise(uuid, updates),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
