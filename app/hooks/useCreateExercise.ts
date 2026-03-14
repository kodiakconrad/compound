import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Exercise, TrackingType } from "../lib/types";

// The body we send to POST /api/v1/exercises.
// name is required; all other fields are optional.
export interface CreateExerciseBody {
  name: string;
  muscle_group?: string;
  equipment?: string;
  tracking_type?: TrackingType;
  notes?: string;
}

// useCreateExercise wraps POST /api/v1/exercises.
//
// On success it invalidates the ["exercises"] query so the library list
// immediately shows the newly created exercise when the user goes back.
//
// Usage in a component:
//   const { mutate, isPending } = useCreateExercise();
//   mutate(body, { onSuccess: () => router.back() });
export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation<Exercise, Error, CreateExerciseBody>({
    mutationFn: (body) => api.post<Exercise>("/api/v1/exercises", body),
    onSuccess: () => {
      // Invalidate the full list so it refetches and includes the new exercise.
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}
