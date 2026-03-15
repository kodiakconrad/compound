import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

// ---------------------------------------------------------------------------
// Types — match backend CycleResponse and CycleWithSessionsResponse DTOs
// ---------------------------------------------------------------------------

/** Flat cycle shape returned by GET /api/v1/cycles (list endpoint). */
export interface CycleListItem {
  uuid: string;
  program_id: number;
  program_name: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/** Flat session shape within a CycleWithSessions response. */
export interface CycleSession {
  uuid: string;
  cycle_id: number;
  program_workout_id: number;
  sort_order: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** Full cycle shape with sessions, returned by GET /api/v1/cycles/{uuid}. */
export interface CycleWithSessions {
  uuid: string;
  program_id: number;
  program_name: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  sessions: CycleSession[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// List response shape — paginated list of cycles
// ---------------------------------------------------------------------------

interface CycleListResponse {
  cycles: CycleListItem[];
  has_more: boolean;
  cursor?: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useActiveCycles fetches all cycles with status=active.
 *
 * Used by the Today tab to determine if the user has any active training.
 * Returns an empty array when there are no active cycles.
 */
export function useActiveCycles() {
  return useQuery<CycleListItem[]>({
    queryKey: ["cycles", "active"],
    queryFn: async () => {
      const resp = await api.get<CycleListResponse>(
        "/api/v1/cycles?status=active"
      );
      return resp.cycles;
    },
    // Refetch every 60 seconds — active cycles change infrequently.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * useCycleDetail fetches a single cycle with its sessions.
 *
 * Used by the Today tab to find the next pending session within an active cycle.
 * Disabled when cycleUUID is undefined (no active cycle).
 */
export function useCycleDetail(cycleUUID: string | undefined) {
  return useQuery<CycleWithSessions>({
    queryKey: ["cycles", cycleUUID],
    queryFn: () =>
      api.get<CycleWithSessions>(`/api/v1/cycles/${cycleUUID}`),
    enabled: cycleUUID !== undefined,
  });
}
