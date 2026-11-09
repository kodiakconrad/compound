import { useMutation, useQueryClient } from "@tanstack/react-query";

import { skipSessionByUUID } from "../db/repositories/session_repository";

interface SkipSessionArgs {
  cycleUUID: string;
  sessionUUID: string;
  notes?: string;
}

// useSkipSession transitions a session to skipped.
export function useSkipSession() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, SkipSessionArgs>({
    mutationFn: async ({ sessionUUID, notes }) =>
      skipSessionByUUID(sessionUUID, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      queryClient.invalidateQueries({ queryKey: ["sessionDetail"] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
