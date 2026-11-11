import { useQuery } from "@tanstack/react-query";

import { getLastExercisePerformance } from "../db/repositories/progress_repository";
import type { LastExercisePerformance } from "../domain/progress";

// useLastExercisePerformance loads the heaviest set from the most recent
// completed session for an exercise, so the session screen can show
// "Last: 70kg × 6" next to the current target. Disabled when uuid is null.
export function useLastExercisePerformance(uuid: string | null) {
  return useQuery<LastExercisePerformance | null>({
    queryKey: ["progress", "exercise", "last", uuid],
    queryFn: () => getLastExercisePerformance(uuid!),
    enabled: !!uuid,
  });
}
