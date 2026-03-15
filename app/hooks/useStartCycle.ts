import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { CycleWithSessions } from "../lib/types";

// useStartCycle wraps POST /api/v1/programs/{uuid}/start.
//
// The backend creates a new cycle and pre-generates one session per workout.
// Returns a CycleWithSessions response.
//
// The mutation argument is the program's uuid.
//
// On success it invalidates the programs list (so an "Active" badge could
// appear) and any cycle-related caches.
export function useStartCycle() {
  const queryClient = useQueryClient();

  return useMutation<CycleWithSessions, Error, string>({
    mutationFn: (programUuid) =>
      api.post<CycleWithSessions>(`/api/v1/programs/${programUuid}/start`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
}
