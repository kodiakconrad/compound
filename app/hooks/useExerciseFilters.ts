import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ExerciseFilters } from "../lib/types";

// useExerciseFilters fetches the allowed enum values for muscle_group, equipment,
// and tracking_type from GET /api/v1/exercises/filters.
//
// staleTime is set to 1 day because these enum values almost never change —
// the backend only updates them when new exercise categories are added.
// This means the hook makes at most one network request per app session.
export function useExerciseFilters() {
  return useQuery<ExerciseFilters>({
    queryKey: ["exerciseFilters"],
    queryFn: () => api.get<ExerciseFilters>("/api/v1/exercises/filters"),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
