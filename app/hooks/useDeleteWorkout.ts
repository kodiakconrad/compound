import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

interface DeleteWorkoutArgs {
  programUuid: string;
  workoutUuid: string;
}

// useDeleteWorkout wraps DELETE /api/v1/programs/{pid}/workouts/{wid}.
export function useDeleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteWorkoutArgs>({
    mutationFn: ({ programUuid, workoutUuid }) =>
      api.delete(`/api/v1/programs/${programUuid}/workouts/${workoutUuid}`),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
