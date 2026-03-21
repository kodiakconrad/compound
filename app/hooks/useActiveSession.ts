import { useQuery } from "@tanstack/react-query";

import { getActiveSession } from "../db/repositories/session_repository";
import type { SessionDetail } from "../domain/session";

// Re-export types that components import from this file.
export type ActiveSession = SessionDetail;
export type { SessionDetailSection as SessionSection } from "../domain/session";
export type { SessionDetailExercise as SessionExercise } from "../domain/session";
export type { SetLog as SetLogResponse } from "../domain/session";

// useActiveSession loads the currently in-progress session from local SQLite.
// Returns null if no session is active. No polling needed — local reads are instant.
export function useActiveSession() {
  return useQuery<ActiveSession | null>({
    queryKey: ["activeSession"],
    queryFn: () => getActiveSession(),
  });
}
