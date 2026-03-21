import { useQuery } from "@tanstack/react-query";

import { getProgressSummary } from "../db/repositories/progress_repository";
import type { ProgressSummary } from "../domain/progress";

// useProgressSummary loads aggregate stats from local SQLite.
export function useProgressSummary() {
  return useQuery<ProgressSummary>({
    queryKey: ["progress", "summary"],
    queryFn: () => getProgressSummary(),
  });
}
