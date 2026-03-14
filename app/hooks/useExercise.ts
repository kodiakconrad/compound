import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Exercise } from "../lib/types";

// useExercise fetches a single exercise by UUID from GET /api/v1/exercises/:uuid.
// The hook is disabled when uuid is empty (e.g. before the route param is available).
export function useExercise(uuid: string) {
  return useQuery<Exercise>({
    queryKey: ["exercise", uuid],
    queryFn: () => api.get<Exercise>(`/api/v1/exercises/${uuid}`),
    enabled: !!uuid,
  });
}
