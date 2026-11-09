import { useQuery } from "@tanstack/react-query";

import {
  VALID_MUSCLE_GROUPS,
  VALID_EQUIPMENT,
  VALID_TRACKING_TYPES,
} from "../domain/exercise";

// ExerciseFilters — the shape components expect.
export interface ExerciseFilters {
  muscle_groups: string[];
  equipment: string[];
  tracking_types: string[];
}

// useExerciseFilters returns the allowed enum values for filter UIs.
// These come directly from the domain layer — no network call needed.
// The arrays never change at runtime, so staleTime is Infinity.
export function useExerciseFilters() {
  return useQuery<ExerciseFilters>({
    queryKey: ["exerciseFilters"],
    queryFn: () => ({
      muscle_groups: [...VALID_MUSCLE_GROUPS],
      equipment: [...VALID_EQUIPMENT],
      tracking_types: [...VALID_TRACKING_TYPES],
    }),
    staleTime: Infinity,
  });
}
