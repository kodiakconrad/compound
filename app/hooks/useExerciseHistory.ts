import { useQuery } from "@tanstack/react-query";

import { getExerciseChartData } from "../db/repositories/progress_repository";
import type { ExerciseChartPoint } from "../domain/progress";

// useExerciseHistory loads chart data for a specific exercise from local SQLite.
// Disabled when uuid is null/undefined.
export function useExerciseHistory(uuid: string | null) {
  return useQuery<ExerciseChartPoint[]>({
    queryKey: ["progress", "exercise", uuid],
    queryFn: () => getExerciseChartData(uuid!),
    enabled: !!uuid,
  });
}
