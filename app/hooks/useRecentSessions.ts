import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { RecentSession } from "../lib/types";

// useRecentSessions fetches the last 5 completed/skipped sessions from
// GET /api/v1/progress/recent. Each entry includes the workout name and
// program name for display in the Progress tab's activity feed.
export function useRecentSessions() {
  return useQuery<RecentSession[]>({
    queryKey: ["progress", "recent"],
    queryFn: () => api.get<RecentSession[]>("/api/v1/progress/recent"),
  });
}
