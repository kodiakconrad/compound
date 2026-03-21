import { useQuery } from "@tanstack/react-query";

import { getRecentSessions } from "../db/repositories/progress_repository";
import type { RecentSession } from "../domain/progress";

// useRecentSessions loads the last 5 completed/skipped sessions from local SQLite.
export function useRecentSessions() {
  return useQuery<RecentSession[]>({
    queryKey: ["progress", "recent"],
    queryFn: () => getRecentSessions(),
  });
}
