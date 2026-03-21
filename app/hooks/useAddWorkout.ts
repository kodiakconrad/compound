import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addWorkout } from "../db/repositories/program_repository";
import type { Program } from "../domain/program";

export interface AddWorkoutBody {
  name: string;
  day_number: number;
}

interface AddWorkoutArgs {
  programUuid: string;
  body: AddWorkoutBody;
}

// useAddWorkout creates a workout in local SQLite.
export function useAddWorkout() {
  const queryClient = useQueryClient();

  return useMutation<Program, Error, AddWorkoutArgs>({
    mutationFn: async ({ programUuid, body }) => addWorkout(programUuid, body),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
}
