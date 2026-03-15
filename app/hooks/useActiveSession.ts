import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../lib/api";

// Shape returned by GET /api/v1/sessions/active
// (matches the backend SessionDetailResponse DTO exactly)

export interface SetLogResponse {
  uuid: string;
  exercise_uuid: string;
  section_exercise_uuid?: string;
  set_number: number;
  target_reps?: number;
  actual_reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
  completed_at: string;
}

export interface SessionExercise {
  section_exercise_uuid: string;
  exercise_uuid: string;
  exercise_name: string;
  tracking_type: string;
  target_sets?: number;
  target_reps?: number;
  static_target_weight?: number;
  computed_target_weight?: number;
  target_duration?: number;
  target_distance?: number;
  sort_order: number;
  notes?: string;
  set_logs: SetLogResponse[];
}

export interface SessionSection {
  uuid: string;
  name: string;
  sort_order: number;
  rest_seconds?: number;
  exercises: SessionExercise[];
}

export interface ActiveSession {
  uuid: string;
  cycle_id: number;
  cycle_uuid: string;
  program_workout_id: number;
  workout_name: string;
  sort_order: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  sections: SessionSection[];
  created_at: string;
  updated_at: string;
}

// useActiveSession fetches the currently in-progress session.
// Returns null when there is no active session (404 → no_active_session).
// All other errors are re-thrown for the calling component to handle.
export function useActiveSession() {
  return useQuery<ActiveSession | null>({
    queryKey: ["activeSession"],
    queryFn: async () => {
      try {
        return await api.get<ActiveSession>("/api/v1/sessions/active");
      } catch (err) {
        if (err instanceof ApiError && err.code === "no_active_session") {
          return null;
        }
        throw err;
      }
    },
    // Refetch every 30 seconds while the app is foregrounded so the Today tab
    // stays in sync if a session is started from another device or browser.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
