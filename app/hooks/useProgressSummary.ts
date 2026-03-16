import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { ProgressSummary } from "../lib/types";

// useProgressSummary fetches aggregate stats from GET /api/v1/progress/summary.
// Returns total completed sessions, distinct weeks trained, and current streak.
export function useProgressSummary() {
  return useQuery<ProgressSummary>({
    queryKey: ["progress", "summary"],
    queryFn: () => api.get<ProgressSummary>("/api/v1/progress/summary"),
  });
}
