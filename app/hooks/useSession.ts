import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  getSessionDetail,
  startSessionByUUID,
} from "../db/repositories/session_repository";
import type { ActiveSession } from "./useActiveSession";

// useSessionDetail loads a session with full detail from local SQLite.
export function useSessionDetail(
  cycleUUID: string | undefined,
  sessionUUID: string | undefined
) {
  return useQuery<ActiveSession>({
    queryKey: ["sessionDetail", cycleUUID, sessionUUID],
    queryFn: () => getSessionDetail(sessionUUID!),
    enabled: cycleUUID !== undefined && sessionUUID !== undefined,
  });
}

// useStartSession transitions a session from pending to in_progress.
export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { cycleUUID: string; sessionUUID: string }>({
    mutationFn: async ({ sessionUUID }) => startSessionByUUID(sessionUUID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
}
