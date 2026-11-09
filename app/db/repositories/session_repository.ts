// Session repository — typed SQLite queries for sessions and set logs.
// Mirrors internal/store/session_store.go.

import { getDatabase } from "../database";
import { NotFoundError, UnprocessableError, NoActiveSessionError } from "../../domain/errors";
import { uuid as generateUUID } from "../../lib/uuid";
import {
  startSession as validateStart,
  completeSession as validateComplete,
  skipSession as validateSkip,
  type Session,
  type SessionDetail,
  type SessionDetailSection,
  type SessionDetailExercise,
  type SetLog,
} from "../../domain/session";
import type { TrackingType } from "../../domain/exercise";
import type { SetScheme } from "../../domain/program";
import { nextWeight } from "../../domain/progression";
import { autoCompleteCycleBySessionId } from "./cycle_repository";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: number;
  uuid: string;
  cycle_id: number;
  program_workout_id: number;
  sort_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SetLogRow {
  id: number;
  uuid: string;
  session_id: number;
  exercise_id: number;
  exercise_uuid: string;
  section_exercise_id: number | null;
  section_exercise_uuid: string | null;
  set_number: number;
  target_reps: number | null;
  actual_reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  rpe: number | null;
  completed_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function getSessionRow(uuid: string): SessionRow {
  const db = getDatabase();
  const row = db.getFirstSync<SessionRow>(
    `SELECT id, uuid, cycle_id, program_workout_id, sort_order, status,
            started_at, completed_at, notes, created_at, updated_at
     FROM sessions WHERE uuid = ?`,
    uuid
  );
  if (!row) throw new NotFoundError("session", uuid);
  return row;
}

export function getActiveSession(): SessionDetail | null {
  const db = getDatabase();
  const row = db.getFirstSync<{ uuid: string }>(
    "SELECT uuid FROM sessions WHERE status = 'in_progress' LIMIT 1"
  );
  if (!row) return null;
  return getSessionDetail(row.uuid);
}

export function getSessionDetail(uuid: string): SessionDetail {
  const db = getDatabase();
  const session = getSessionRow(uuid);

  // Get context: workout name and cycle UUID
  const ctx = db.getFirstSync<{ workout_name: string; cycle_uuid: string }>(
    `SELECT pw.name AS workout_name, c.uuid AS cycle_uuid
     FROM program_workouts pw
     JOIN cycles c ON c.id = ?
     WHERE pw.id = ?`,
    session.cycle_id,
    session.program_workout_id
  );

  // Load sections for this workout
  const sections = loadSectionsForWorkout(session.program_workout_id, session.id);

  return {
    uuid: session.uuid,
    cycle_id: session.cycle_id,
    cycle_uuid: ctx?.cycle_uuid ?? "",
    program_workout_id: session.program_workout_id,
    workout_name: ctx?.workout_name ?? "",
    sort_order: session.sort_order,
    status: session.status as Session["status"],
    started_at: session.started_at,
    completed_at: session.completed_at,
    notes: session.notes,
    sections,
    created_at: session.created_at,
    updated_at: session.updated_at,
  };
}

function loadSectionsForWorkout(
  workoutId: number,
  sessionId: number
): SessionDetailSection[] {
  const db = getDatabase();

  const sRows = db.getAllSync<{
    id: number;
    uuid: string;
    name: string;
    sort_order: number;
    rest_seconds: number | null;
  }>(
    `SELECT id, uuid, name, sort_order, rest_seconds
     FROM sections WHERE program_workout_id = ? ORDER BY sort_order`,
    workoutId
  );

  const sections: SessionDetailSection[] = [];

  for (const sr of sRows) {
    const seRows = db.getAllSync<{
      id: number;
      uuid: string;
      exercise_id: number;
      exercise_uuid: string;
      exercise_name: string;
      tracking_type: string;
      target_sets: number | null;
      target_reps: number | null;
      target_weight: number | null;
      target_duration: number | null;
      target_distance: number | null;
      sort_order: number;
      notes: string | null;
      set_scheme: string | null;
    }>(
      `SELECT se.id, se.uuid, se.exercise_id,
              e.uuid AS exercise_uuid, e.name AS exercise_name, e.tracking_type,
              se.target_sets, se.target_reps, se.target_weight,
              se.target_duration, se.target_distance, se.sort_order,
              se.notes, se.set_scheme
       FROM section_exercises se
       JOIN exercises e ON e.id = se.exercise_id
       WHERE se.section_id = ? ORDER BY se.sort_order`,
      sr.id
    );

    const exercises: SessionDetailExercise[] = seRows.map((ser) => {
      // Compute target weight via progression rules
      const computed = computeTargetWeight(ser.id);

      // Load set logs for this exercise in this session
      const setLogs = db.getAllSync<SetLogRow>(
        `SELECT sl.id, sl.uuid, sl.session_id, sl.exercise_id,
                e.uuid AS exercise_uuid, sl.section_exercise_id,
                se_outer.uuid AS section_exercise_uuid,
                sl.set_number, sl.target_reps, sl.actual_reps, sl.weight,
                sl.duration, sl.distance, sl.rpe, sl.completed_at, sl.created_at
         FROM set_logs sl
         JOIN exercises e ON e.id = sl.exercise_id
         LEFT JOIN section_exercises se_outer ON se_outer.id = sl.section_exercise_id
         WHERE sl.session_id = ? AND sl.section_exercise_id = ?
         ORDER BY sl.set_number`,
        sessionId,
        ser.id
      );

      return {
        section_exercise_uuid: ser.uuid,
        exercise_uuid: ser.exercise_uuid,
        exercise_name: ser.exercise_name,
        tracking_type: ser.tracking_type as TrackingType,
        target_sets: ser.target_sets,
        target_reps: ser.target_reps,
        static_target_weight: ser.target_weight,
        computed_target_weight: computed,
        target_duration: ser.target_duration,
        target_distance: ser.target_distance,
        sort_order: ser.sort_order,
        notes: ser.notes,
        set_logs: setLogs,
      };
    });

    sections.push({
      uuid: sr.uuid,
      name: sr.name,
      sort_order: sr.sort_order,
      rest_seconds: sr.rest_seconds,
      exercises,
    });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Progression weight computation — mirrors computeProgressionWeights in Go
// ---------------------------------------------------------------------------

function computeTargetWeight(sectionExerciseId: number): number | null {
  const db = getDatabase();

  // Get progression rule for this section exercise
  const rule = db.getFirstSync<{
    strategy: string;
    increment: number | null;
    increment_pct: number | null;
    deload_threshold: number;
    deload_pct: number;
  }>(
    `SELECT strategy, increment, increment_pct, deload_threshold, deload_pct
     FROM progression_rules WHERE section_exercise_id = ?`,
    sectionExerciseId
  );
  if (!rule) return null;

  // Get historical set logs for this section_exercise across all completed sessions
  const history = db.getAllSync<{
    session_id: number;
    target_reps: number | null;
    actual_reps: number | null;
    weight: number | null;
  }>(
    `SELECT sl.session_id, sl.target_reps, sl.actual_reps, sl.weight
     FROM set_logs sl
     JOIN sessions s ON s.id = sl.session_id
     WHERE sl.section_exercise_id = ? AND s.status = 'completed'
     ORDER BY s.completed_at DESC, sl.set_number ASC`,
    sectionExerciseId
  );

  if (history.length === 0) return null;

  // Group by session, find the most recent session's weight and failure status
  const sessionGroups = new Map<number, typeof history>();
  for (const h of history) {
    const group = sessionGroups.get(h.session_id) ?? [];
    group.push(h);
    sessionGroups.set(h.session_id, group);
  }

  // Walk sessions newest-first to count consecutive failures
  const sessionIds = [...sessionGroups.keys()]; // Already ordered newest-first from the query
  let currentWeight: number | null = null;
  let consecutiveFailures = 0;

  for (const sid of sessionIds) {
    const sets = sessionGroups.get(sid)!;

    // Get weight from the most recent session
    if (currentWeight === null) {
      currentWeight = sets[0]?.weight ?? null;
    }

    // A session fails if any set has actual_reps < target_reps
    const failed = sets.some(
      (s) =>
        s.target_reps != null &&
        s.actual_reps != null &&
        s.actual_reps < s.target_reps
    );

    if (failed) {
      consecutiveFailures++;
    } else {
      break; // Streak of successes begins — stop counting
    }
  }

  if (currentWeight === null) return null;

  return nextWeight(
    {
      strategy: rule.strategy as "linear" | "percentage" | "wave",
      increment: rule.increment,
      increment_pct: rule.increment_pct,
      deload_threshold: rule.deload_threshold,
      deload_pct: rule.deload_pct,
    },
    currentWeight,
    consecutiveFailures
  );
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export function startSessionByUUID(uuid: string): void {
  const db = getDatabase();
  const session = getSessionRow(uuid);
  const sessionObj: Session = { ...session, status: session.status as Session["status"] };

  const err = validateStart(sessionObj);
  if (err) throw err;

  const now = new Date().toISOString();
  db.runSync(
    `UPDATE sessions SET status = 'in_progress', started_at = ?, updated_at = ? WHERE uuid = ?`,
    now,
    now,
    uuid
  );
}

export function completeSessionByUUID(uuid: string, notes?: string): void {
  const db = getDatabase();
  const session = getSessionRow(uuid);
  const sessionObj: Session = { ...session, status: session.status as Session["status"] };

  const err = validateComplete(sessionObj);
  if (err) throw err;

  const now = new Date().toISOString();
  db.runSync(
    `UPDATE sessions SET status = 'completed', completed_at = ?, notes = ?, updated_at = ? WHERE uuid = ?`,
    now,
    notes ?? session.notes,
    now,
    uuid
  );

  // Auto-complete cycle if all sessions are done
  autoCompleteCycleBySessionId(session.id);
}

export function skipSessionByUUID(uuid: string, notes?: string): void {
  const db = getDatabase();
  const session = getSessionRow(uuid);
  const sessionObj: Session = { ...session, status: session.status as Session["status"] };

  const err = validateSkip(sessionObj);
  if (err) throw err;

  const now = new Date().toISOString();
  db.runSync(
    `UPDATE sessions SET status = 'skipped', notes = ?, updated_at = ? WHERE uuid = ?`,
    notes ?? session.notes,
    now,
    uuid
  );

  autoCompleteCycleBySessionId(session.id);
}

// ---------------------------------------------------------------------------
// Set log operations
// ---------------------------------------------------------------------------

export interface LogSetInput {
  section_exercise_uuid?: string;
  exercise_uuid?: string;
  set_number: number;
  target_reps?: number;
  actual_reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  rpe?: number;
}

export function logSet(sessionUuid: string, input: LogSetInput): SetLog {
  const db = getDatabase();
  const session = getSessionRow(sessionUuid);

  if (session.status !== "in_progress") {
    throw new UnprocessableError("can only log sets for in_progress sessions");
  }

  const now = new Date().toISOString();
  const uuid = generateUUID();

  // Resolve exercise and section_exercise IDs
  let exerciseId: number;
  let sectionExerciseId: number | null = null;

  if (input.section_exercise_uuid) {
    const se = db.getFirstSync<{
      id: number;
      exercise_id: number;
    }>(
      "SELECT id, exercise_id FROM section_exercises WHERE uuid = ?",
      input.section_exercise_uuid
    );
    if (!se) throw new NotFoundError("section_exercise", input.section_exercise_uuid);
    sectionExerciseId = se.id;
    exerciseId = se.exercise_id;
  } else if (input.exercise_uuid) {
    const ex = db.getFirstSync<{ id: number }>(
      "SELECT id FROM exercises WHERE uuid = ? AND deleted_at IS NULL",
      input.exercise_uuid
    );
    if (!ex) throw new NotFoundError("exercise", input.exercise_uuid);
    exerciseId = ex.id;
  } else {
    throw new UnprocessableError("either section_exercise_uuid or exercise_uuid is required");
  }

  db.runSync(
    `INSERT INTO set_logs
     (uuid, session_id, exercise_id, section_exercise_id, set_number,
      target_reps, actual_reps, weight, duration, distance, rpe, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid,
    session.id,
    exerciseId,
    sectionExerciseId,
    input.set_number,
    input.target_reps ?? null,
    input.actual_reps ?? null,
    input.weight ?? null,
    input.duration ?? null,
    input.distance ?? null,
    input.rpe ?? null,
    now,
    now
  );

  // Return the created set log
  const row = db.getFirstSync<SetLogRow>(
    `SELECT sl.id, sl.uuid, sl.session_id, sl.exercise_id,
            e.uuid AS exercise_uuid, sl.section_exercise_id,
            se.uuid AS section_exercise_uuid,
            sl.set_number, sl.target_reps, sl.actual_reps, sl.weight,
            sl.duration, sl.distance, sl.rpe, sl.completed_at, sl.created_at
     FROM set_logs sl
     JOIN exercises e ON e.id = sl.exercise_id
     LEFT JOIN section_exercises se ON se.id = sl.section_exercise_id
     WHERE sl.uuid = ?`,
    uuid
  );

  return row!;
}

export function deleteSetLog(setLogUuid: string): void {
  const db = getDatabase();
  const result = db.runSync("DELETE FROM set_logs WHERE uuid = ?", setLogUuid);
  if (result.changes === 0) throw new NotFoundError("set_log", setLogUuid);
}

export function deleteSetLogsForExercise(
  sessionUuid: string,
  exerciseUuid: string
): void {
  const db = getDatabase();
  const session = getSessionRow(sessionUuid);
  const ex = db.getFirstSync<{ id: number }>(
    "SELECT id FROM exercises WHERE uuid = ?",
    exerciseUuid
  );
  if (!ex) throw new NotFoundError("exercise", exerciseUuid);

  db.runSync(
    "DELETE FROM set_logs WHERE session_id = ? AND exercise_id = ?",
    session.id,
    ex.id
  );
}
