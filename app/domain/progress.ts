// Progress read models — mirrors internal/domain/progress.go.
// These are pure data types with no business logic.

export interface HistoryEntry {
  session_id: number;
  session_uuid: string;
  completed_at: string;
  weight: number;
}

export interface PersonalRecord {
  weight: number;
  actual_reps: number | null;
  session_uuid: string;
  completed_at: string;
}

export interface PersonalRecordListEntry {
  exercise_uuid: string;
  exercise_name: string;
  weight: number;
  actual_reps: number | null;
  completed_at: string;
}

export interface ExerciseChartPoint {
  date: string;
  weight: number;
  reps: number;
  volume: number;
}

export interface RecentSession {
  uuid: string;
  cycle_uuid: string;
  status: string;
  completed_at: string | null;
  workout_name: string;
  program_name: string;
}

export interface ProgressSummary {
  total_sessions: number;
  weeks_trained: number;
  current_streak: number;
}
