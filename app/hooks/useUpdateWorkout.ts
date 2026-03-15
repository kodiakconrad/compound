import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export interface UpdateWorkoutBody {
  name?: string;
  day_number?: number;
}

interface UpdateWorkoutArgs {
  programUuid: string;
  workoutUuid: string;
  body: UpdateWorkoutBody;
}

// useUpdateWorkout wraps PUT /api/v1/programs/{pid}/workouts/{wid}.
export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, UpdateWorkoutArgs>({
    mutationFn: ({ programUuid, workoutUuid, body }) =>
      api.put(
        `/api/v1/programs/${programUuid}/workouts/${workoutUuid}`,
        body
      ),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
