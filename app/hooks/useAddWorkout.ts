import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export interface AddWorkoutBody {
  name: string;
  day_number: number;
}

interface AddWorkoutArgs {
  programUuid: string;
  body: AddWorkoutBody;
}

// useAddWorkout wraps POST /api/v1/programs/{uuid}/workouts.
// Invalidates the program detail cache so the tree refreshes.
export function useAddWorkout() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AddWorkoutArgs>({
    mutationFn: ({ programUuid, body }) =>
      api.post(`/api/v1/programs/${programUuid}/workouts`, body),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
