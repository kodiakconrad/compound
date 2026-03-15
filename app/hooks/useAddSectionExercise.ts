import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

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

// useAddSectionExercise wraps POST .../sections/{sid}/exercises.
export function useAddSectionExercise() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AddSectionExerciseArgs>({
    mutationFn: ({ programUuid, workoutUuid, sectionUuid, body }) =>
      api.post(
        `/api/v1/programs/${programUuid}/workouts/${workoutUuid}/sections/${sectionUuid}/exercises`,
        body
      ),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
