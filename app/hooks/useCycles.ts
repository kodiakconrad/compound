import { useQuery } from "@tanstack/react-query";

import {
  listActiveCycles,
  getCycleWithSessions,
} from "../db/repositories/cycle_repository";
import type { Cycle } from "../domain/cycle";

// useActiveCycles returns all active cycles from local SQLite.
export function useActiveCycles() {
  return useQuery({
    queryKey: ["cycles", "active"],
    queryFn: () => listActiveCycles(),
  });
}

// useCycleDetail loads a cycle with its sessions from local SQLite.
export function useCycleDetail(cycleUUID: string | undefined) {
  return useQuery<Cycle>({
    queryKey: ["cycles", cycleUUID],
    queryFn: () => getCycleWithSessions(cycleUUID!),
    enabled: cycleUUID !== undefined,
  });
}
