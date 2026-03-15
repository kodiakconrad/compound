import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

interface DeleteSectionArgs {
  programUuid: string;
  workoutUuid: string;
  sectionUuid: string;
}

// useDeleteSection wraps DELETE .../workouts/{wid}/sections/{sid}.
export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteSectionArgs>({
    mutationFn: ({ programUuid, workoutUuid, sectionUuid }) =>
      api.delete(
        `/api/v1/programs/${programUuid}/workouts/${workoutUuid}/sections/${sectionUuid}`
      ),
    onSuccess: (_data, { programUuid }) => {
      queryClient.invalidateQueries({ queryKey: ["program", programUuid] });
    },
  });
}
