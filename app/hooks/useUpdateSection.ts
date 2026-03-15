import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export interface UpdateSectionBody {
  name?: string;
  rest_seconds?: number;
}

interface UpdateSectionArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
  body: UpdateSectionBody;
}

// useUpdateSection wraps PUT .../workouts/{wid}/sections/{sid}.
export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, UpdateSectionArgs>({
    mutationFn: ({ programUuid, workoutUuid, sectionUuid, body }) =>
      api.put(
        `/api/v1/programs/${programUuid}/workouts/${workoutUuid}/sections/${sectionUuid}`,
        body
      ),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
