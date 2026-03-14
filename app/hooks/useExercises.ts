import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Exercise } from "../lib/types";

// useExercises fetches the full exercise list from GET /api/v1/exercises.
// We request a large page (limit=500) and filter client-side for instant search.
// This avoids a new network request on every keystroke and works fine for the
// expected number of exercises in a personal workout app.
export function useExercises() {
  return useQuery<Exercise[]>({
    queryKey: ["exercises"],
    queryFn: () => api.get<Exercise[]>("/api/v1/exercises?limit=500"),
  });
}
