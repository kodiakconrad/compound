import { useQuery } from "@tanstack/react-query";

import { getExercise } from "../db/repositories/exercise_repository";
import type { Exercise } from "../domain/exercise";

// useExercise loads a single exercise by UUID from local SQLite.
// Disabled when uuid is empty (e.g. before a route param is available).
export function useExercise(uuid: string) {
  return useQuery<Exercise>({
    queryKey: ["exercise", uuid],
    queryFn: () => getExercise(uuid),
    enabled: !!uuid,
  });
}
