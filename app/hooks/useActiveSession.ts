import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../lib/api";

// Shape returned by GET /api/v1/sessions/active
// (matches the backend SessionDetailResponse DTO)
export interface LoggedSet {
  uuid: string;
  set_number: number;
  actual_reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  logged_at: string;
}

export interface SessionExercise {
  section_exercise_uuid: string;
  exercise_uuid: string;
  name: string;
  tracking_type: string;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  logged_sets: LoggedSet[];
}

export interface SessionSection {
  uuid: string;
  name: string;
  sort_order: number;
  exercises: SessionExercise[];
}

export interface ActiveSession {
  uuid: string;
  cycle_uuid: string;
  workout_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  sections: SessionSection[];
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
