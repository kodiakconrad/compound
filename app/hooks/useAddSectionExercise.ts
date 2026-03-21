import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addSectionExercise } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

export interface AddSectionExerciseBody {
  exercise_uuid: string;
  target_sets?: number;
  target_reps?: number;
  target_weight?: number;
  target_duration?: number;
  target_distance?: number;
  notes?: string;
}

interface AddSectionExerciseArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
  body: AddSectionExerciseBody;
}

// useAddSectionExercise adds an exercise to a section in local SQLite.
export function useAddSectionExercise() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, AddSectionExerciseArgs>({
    mutationFn: async ({ programUuid, sectionUuid, body }) =>
      addSectionExercise(programUuid, sectionUuid, body),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
