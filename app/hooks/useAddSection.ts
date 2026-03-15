import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export interface AddSectionBody {
  name: string;
  rest_seconds?: number;
}

interface AddSectionArgs {
  programUuid: string;
  workoutUuid: string;
  body: AddSectionBody;
}

// useAddSection wraps POST /api/v1/programs/{pid}/workouts/{wid}/sections.
export function useAddSection() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AddSectionArgs>({
    mutationFn: ({ programUuid, workoutUuid, body }) =>
      api.post(
        `/api/v1/programs/${programUuid}/workouts/${workoutUuid}/sections`,
        body
      ),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
