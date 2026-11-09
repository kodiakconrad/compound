import { useMutation, useQueryClient } from "@tanstack/react-query";

import { completeSessionByUUID } from "../db/repositories/session_repository";

interface CompleteSessionArgs {
  cycleUUID: string;
  sessionUUID: string;
  notes?: string;
}

// useCompleteSession transitions a session from in_progress to completed.
export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CompleteSessionArgs>({
    mutationFn: async ({ sessionUUID, notes }) =>
      completeSessionByUUID(sessionUUID, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      queryClient.invalidateQueries({ queryKey: ["sessionDetail"] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
