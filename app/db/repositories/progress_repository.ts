// Progress repository — typed SQLite queries for progress tracking.
// Mirrors internal/store/progress_store.go and internal/db/query/progress.sql.

import { getDatabase } from "../database";
import type {
  ProgressSummary,
  PersonalRecordListEntry,
  ExerciseChartPoint,
  RecentSession,
} from "../../domain/progress";

// ---------------------------------------------------------------------------
// Progress summary
// ---------------------------------------------------------------------------

export function getProgressSummary(): ProgressSummary {
  const db = getDatabase();

  const totalRow = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM sessions WHERE status = 'completed'"
  );
  const total = totalRow?.count ?? 0;

  const weeksRow = db.getFirstSync<{ weeks: number }>(
    `SELECT COUNT(DISTINCT strftime('%Y-%W', completed_at)) AS weeks
     FROM sessions
     WHERE status = 'completed' AND completed_at IS NOT NULL`
  );
  const weeks = weeksRow?.weeks ?? 0;

  // Current streak: walk completed/skipped sessions newest-first
  const statuses = db.getAllSync<{ status: string }>(
    `SELECT status FROM sessions
     WHERE status IN ('completed', 'skipped')
     ORDER BY updated_at DESC, id DESC`
  );

  let streak = 0;
  for (const s of statuses) {
    if (s.status === "completed") {
      streak++;
    } else {
      break;
    }
  }

  return {
    total_sessions: total,
    weeks_trained: weeks,
    current_streak: streak,
  };
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export function getAllPersonalRecords(): PersonalRecordListEntry[] {
  const db = getDatabase();
  return db.getAllSync<PersonalRecordListEntry>(
    `SELECT e.uuid AS exercise_uuid,
            e.name AS exercise_name,
            sl.weight,
            sl.actual_reps,
            s.completed_at
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     JOIN exercises e ON e.id = sl.exercise_id
     WHERE s.status = 'completed'
       AND sl.weight IS NOT NULL
       AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
       AND sl.weight = (
         SELECT MAX(sl2.weight)
         FROM set_logs sl2
         JOIN sessions s2 ON s2.id = sl2.session_id
         WHERE sl2.exercise_id = sl.exercise_id
           AND s2.status = 'completed'
           AND sl2.weight IS NOT NULL
           AND (sl2.target_reps IS NULL OR sl2.actual_reps >= sl2.target_reps)
       )
     GROUP BY sl.exercise_id
     ORDER BY e.name`
  );
}

// ---------------------------------------------------------------------------
// Exercise chart data
// ---------------------------------------------------------------------------

export function getExerciseChartData(exerciseUuid: string): ExerciseChartPoint[] {
  const db = getDatabase();
  return db.getAllSync<ExerciseChartPoint>(
    `SELECT DATE(s.completed_at) AS date,
            MAX(sl.weight) AS weight,
            sl.actual_reps AS reps,
            CAST(MAX(sl.weight) * sl.actual_reps AS REAL) AS volume
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     JOIN exercises e ON e.id = sl.exercise_id
     WHERE e.uuid = ?
       AND s.status = 'completed'
       AND sl.weight IS NOT NULL
       AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
     GROUP BY s.id
     ORDER BY s.completed_at ASC`,
    exerciseUuid
  );
}

// ---------------------------------------------------------------------------
// Recent sessions
// ---------------------------------------------------------------------------

export function getRecentSessions(limit: number = 5): RecentSession[] {
  const db = getDatabase();
  return db.getAllSync<RecentSession>(
    `SELECT s.uuid,
            c.uuid AS cycle_uuid,
            s.status,
            s.completed_at,
            pw.name AS workout_name,
            p.name AS program_name
     FROM sessions s
     JOIN program_workouts pw ON pw.id = s.program_workout_id
     JOIN cycles c ON c.id = s.cycle_id
     JOIN programs p ON p.id = c.program_id
     WHERE s.status IN ('completed', 'skipped')
     ORDER BY s.completed_at DESC, s.id DESC
     LIMIT ?`,
    limit
  );
}
