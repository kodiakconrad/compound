import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ExerciseChartPoint } from "../lib/types";

// useExerciseHistory fetches chart-ready data points for a specific exercise
// from GET /api/v1/progress/exercise/{uuid}. Each point represents the best
// eligible set from one completed session (date, weight, reps, volume).
//
// The query is disabled when uuid is null/undefined — this lets the caller
// render the exercise picker first and only fetch data once an exercise is selected.
export function useExerciseHistory(uuid: string | null) {
  return useQuery<ExerciseChartPoint[]>({
    queryKey: ["progress", "exercise", uuid],
    queryFn: () => api.get<ExerciseChartPoint[]>(`/api/v1/progress/exercise/${uuid}`),
    enabled: !!uuid,
  });
}
