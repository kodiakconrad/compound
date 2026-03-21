import { useQuery } from "@tanstack/react-query";

import { listExercises } from "../db/repositories/exercise_repository";
import type { Exercise } from "../domain/exercise";

// useExercises loads the full exercise list from local SQLite.
// No network request — reads directly from the on-device database.
// The query function is synchronous (SQLite), but TanStack Query
// treats it the same as an async function.
export function useExercises() {
  return useQuery<Exercise[]>({
    queryKey: ["exercises"],
    queryFn: () => listExercises(),
  });
}
