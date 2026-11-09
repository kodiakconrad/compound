import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createCycle } from "../db/repositories/cycle_repository";
import type { Cycle } from "../domain/cycle";

// useStartCycle creates a new cycle for a program in local SQLite.
// Pre-generates one session per workout.
export function useStartCycle() {
  const queryClient = useQueryClient();

  return useMutation<Cycle, Error, string>({
    mutationFn: async (programUuid) => createCycle(programUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    },
  });
}
