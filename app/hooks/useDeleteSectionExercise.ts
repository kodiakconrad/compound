import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

interface DeleteSectionExerciseArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
  exerciseUuid: string;
}

// useDeleteSectionExercise wraps DELETE .../sections/{sid}/exercises/{eid}.
export function useDeleteSectionExercise() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteSectionExerciseArgs>({
    mutationFn: ({ programUuid, workoutUuid, sectionUuid, exerciseUuid }) =>
      api.delete(
        `/api/v1/programs/${programUuid}/workouts/${workoutUuid}/sections/${sectionUuid}/exercises/${exerciseUuid}`
      ),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
