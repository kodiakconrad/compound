import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteSectionExercise } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

interface DeleteSectionExerciseArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
  exerciseUuid: string;
}

// useDeleteSectionExercise removes an exercise from a section in local SQLite.
export function useDeleteSectionExercise() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, DeleteSectionExerciseArgs>({
    mutationFn: async ({ programUuid, exerciseUuid }) =>
      deleteSectionExercise(programUuid, exerciseUuid),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
