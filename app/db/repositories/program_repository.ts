// Program repository — typed SQLite queries for programs and their tree.
// Mirrors internal/store/program_store.go and internal/store/workout_store.go.

import { getDatabase } from "../database";
import { NotFoundError, UnprocessableError } from "../../domain/errors";
import { uuid as generateUUID } from "../../lib/uuid";
import { deepCopyProgram, type ProgramListItem, type SetScheme } from "../../domain/program";
import type { Program, ProgramWorkout, Section, SectionExercise } from "../../domain/program";
import type { ProgressionRule } from "../../domain/progression";
import { getExerciseIdByUUID } from "./exercise_repository";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface ProgramRow {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  is_prebuilt: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ProgramListRow extends ProgramRow {
  workout_count: number;
  has_active_cycle: number;
}

interface WorkoutRow {
  id: number;
  uuid: string;
  program_id: number;
  name: string;
  day_number: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SectionRow {
  id: number;
  uuid: string;
  program_workout_id: number;
  name: string;
  sort_order: number;
  rest_seconds: number | null;
  created_at: string;
  updated_at: string;
}

interface SectionExerciseRow {
  id: number;
  uuid: string;
  section_id: number;
  exercise_id: number;
  exercise_uuid: string;
  exercise_name: string;
  exercise_tracking_type: string;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_duration: number | null;
  target_distance: number | null;
  sort_order: number;
  notes: string | null;
  set_scheme: string | null;
  created_at: string;
  updated_at: string;
}

interface ProgressionRuleRow {
  id: number;
  uuid: string;
  section_exercise_id: number;
  strategy: string;
  increment: number | null;
  increment_pct: number | null;
  deload_threshold: number;
  deload_pct: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listPrograms(): ProgramListItem[] {
  const db = getDatabase();
  const rows = db.getAllSync<ProgramListRow>(
    `SELECT p.id, p.uuid, p.name, p.description, p.is_prebuilt,
            p.created_at, p.updated_at, p.deleted_at,
            COUNT(w.id) AS workout_count,
            EXISTS(SELECT 1 FROM cycles c WHERE c.program_id = p.id AND c.status = 'active') AS has_active_cycle
     FROM programs p
     LEFT JOIN program_workouts w ON w.program_id = p.id
     WHERE p.deleted_at IS NULL
     GROUP BY p.id
     ORDER BY p.updated_at DESC, p.id ASC`
  );
  return rows.map((r) => ({
    uuid: r.uuid,
    name: r.name,
    is_prebuilt: r.is_prebuilt === 1,
    workout_count: r.workout_count,
    has_active_cycle: r.has_active_cycle === 1,
    updated_at: r.updated_at,
  }));
}

export function getProgramDetail(uuid: string): Program {
  const db = getDatabase();

  // 1. Program
  const pRow = db.getFirstSync<ProgramRow>(
    `SELECT id, uuid, name, description, is_prebuilt, created_at, updated_at, deleted_at
     FROM programs WHERE uuid = ? AND deleted_at IS NULL`,
    uuid
  );
  if (!pRow) throw new NotFoundError("program", uuid);

  // Check for active cycles
  const activeCycle = db.getFirstSync<{ id: number }>(
    "SELECT c.id FROM cycles c WHERE c.program_id = ? AND c.status = 'active' LIMIT 1",
    pRow.id
  );

  const program: Program = {
    ...pRow,
    is_prebuilt: pRow.is_prebuilt === 1,
    has_active_cycle: activeCycle != null,
    workouts: [],
  };

  // 2. Workouts
  const wRows = db.getAllSync<WorkoutRow>(
    `SELECT id, uuid, program_id, name, day_number, sort_order, created_at, updated_at
     FROM program_workouts WHERE program_id = ? ORDER BY sort_order`,
    pRow.id
  );
  const workoutMap = new Map<number, ProgramWorkout>();
  for (const wr of wRows) {
    const w: ProgramWorkout = { ...wr, sections: [] };
    program.workouts.push(w);
    workoutMap.set(wr.id, w);
  }
  if (wRows.length === 0) return program;

  // 3. Sections
  const wIds = wRows.map((w) => w.id);
  const sRows = db.getAllSync<SectionRow>(
    `SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
     FROM sections WHERE program_workout_id IN (${placeholders(wIds)}) ORDER BY sort_order`,
    ...wIds
  );
  const sectionMap = new Map<number, Section>();
  for (const sr of sRows) {
    const s: Section = { ...sr, exercises: [] };
    workoutMap.get(sr.program_workout_id)?.sections.push(s);
    sectionMap.set(sr.id, s);
  }
  if (sRows.length === 0) return program;

  // 4. Section exercises (joined with exercises table for name/type)
  const sIds = sRows.map((s) => s.id);
  const seRows = db.getAllSync<SectionExerciseRow>(
    `SELECT se.id, se.uuid, se.section_id, se.exercise_id,
            e.uuid AS exercise_uuid, e.name AS exercise_name, e.tracking_type AS exercise_tracking_type,
            se.target_sets, se.target_reps, se.target_weight, se.target_duration, se.target_distance,
            se.sort_order, se.notes, se.set_scheme, se.created_at, se.updated_at
     FROM section_exercises se
     JOIN exercises e ON e.id = se.exercise_id
     WHERE se.section_id IN (${placeholders(sIds)})
     ORDER BY se.sort_order`,
    ...sIds
  );
  const seMap = new Map<number, SectionExercise>();
  for (const ser of seRows) {
    const se: SectionExercise = {
      ...ser,
      exercise_tracking_type: ser.exercise_tracking_type as SectionExercise["exercise_tracking_type"],
      set_scheme: ser.set_scheme ? (JSON.parse(ser.set_scheme) as SetScheme) : null,
      progression_rule: null,
    };
    sectionMap.get(ser.section_id)?.exercises.push(se);
    seMap.set(ser.id, se);
  }
  if (seRows.length === 0) return program;

  // 5. Progression rules
  const seIds = seRows.map((se) => se.id);
  const prRows = db.getAllSync<ProgressionRuleRow>(
    `SELECT id, uuid, section_exercise_id, strategy, increment, increment_pct,
            deload_threshold, deload_pct, created_at, updated_at
     FROM progression_rules WHERE section_exercise_id IN (${placeholders(seIds)})`,
    ...seIds
  );
  for (const pr of prRows) {
    const se = seMap.get(pr.section_exercise_id);
    if (se) {
      se.progression_rule = {
        ...pr,
        strategy: pr.strategy as ProgressionRule["strategy"],
      };
    }
  }

  return program;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateProgramInput {
  name: string;
  description?: string | null;
}

export function createProgram(input: CreateProgramInput): Program {
  const db = getDatabase();
  const now = new Date().toISOString();
  const uuid = generateUUID();

  db.runSync(
    `INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    uuid,
    input.name.trim(),
    input.description ?? null,
    now,
    now
  );

  return getProgramDetail(uuid);
}

export function updateProgram(
  uuid: string,
  updates: { name?: string; description?: string | null }
): Program {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = db.getFirstSync<ProgramRow>(
    "SELECT id, uuid, name, description, is_prebuilt, created_at, updated_at, deleted_at FROM programs WHERE uuid = ? AND deleted_at IS NULL",
    uuid
  );
  if (!existing) throw new NotFoundError("program", uuid);

  db.runSync(
    `UPDATE programs SET name = ?, description = ?, updated_at = ? WHERE uuid = ? AND deleted_at IS NULL`,
    (updates.name ?? existing.name).trim(),
    updates.description !== undefined ? updates.description : existing.description,
    now,
    uuid
  );

  return getProgramDetail(uuid);
}

export function softDeleteProgram(uuid: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(
    `UPDATE programs SET deleted_at = ?, updated_at = ? WHERE uuid = ? AND deleted_at IS NULL`,
    now,
    now,
    uuid
  );
  if (result.changes === 0) throw new NotFoundError("program", uuid);
}

export function copyProgram(sourceUuid: string): Program {
  const db = getDatabase();
  const source = getProgramDetail(sourceUuid);
  const copy = deepCopyProgram(source);

  db.withTransactionSync(() => {
    insertProgramTree(copy);
  });

  return getProgramDetail(copy.uuid);
}

// ---------------------------------------------------------------------------
// Workout CRUD
// ---------------------------------------------------------------------------

export function addWorkout(
  programUuid: string,
  input: { name: string; day_number: number }
): Program {
  const db = getDatabase();
  const now = new Date().toISOString();
  const uuid = generateUUID();

  const prog = db.getFirstSync<{ id: number }>(
    "SELECT id FROM programs WHERE uuid = ? AND deleted_at IS NULL",
    programUuid
  );
  if (!prog) throw new NotFoundError("program", programUuid);

  const maxSort = db.getFirstSync<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM program_workouts WHERE program_id = ?",
    prog.id
  );

  db.runSync(
    `INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuid,
    prog.id,
    input.name.trim(),
    input.day_number,
    (maxSort?.m ?? 0) + 1,
    now,
    now
  );

  return getProgramDetail(programUuid);
}

export function updateWorkout(
  programUuid: string,
  workoutUuid: string,
  updates: { name?: string; day_number?: number }
): Program {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = db.getFirstSync<WorkoutRow>(
    "SELECT id, uuid, program_id, name, day_number, sort_order, created_at, updated_at FROM program_workouts WHERE uuid = ?",
    workoutUuid
  );
  if (!existing) throw new NotFoundError("workout", workoutUuid);

  db.runSync(
    `UPDATE program_workouts SET name = ?, day_number = ?, updated_at = ? WHERE uuid = ?`,
    (updates.name ?? existing.name).trim(),
    updates.day_number ?? existing.day_number,
    now,
    workoutUuid
  );

  return getProgramDetail(programUuid);
}

export function deleteWorkout(programUuid: string, workoutUuid: string): Program {
  const db = getDatabase();
  const result = db.runSync("DELETE FROM program_workouts WHERE uuid = ?", workoutUuid);
  if (result.changes === 0) throw new NotFoundError("workout", workoutUuid);
  return getProgramDetail(programUuid);
}

// ---------------------------------------------------------------------------
// Section CRUD
// ---------------------------------------------------------------------------

export function addSection(
  programUuid: string,
  workoutUuid: string,
  input: { name: string; rest_seconds?: number | null }
): Program {
  const db = getDatabase();
  const now = new Date().toISOString();
  const uuid = generateUUID();

  const workout = db.getFirstSync<{ id: number }>(
    "SELECT id FROM program_workouts WHERE uuid = ?",
    workoutUuid
  );
  if (!workout) throw new NotFoundError("workout", workoutUuid);

  const maxSort = db.getFirstSync<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM sections WHERE program_workout_id = ?",
    workout.id
  );

  db.runSync(
    `INSERT INTO sections (uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuid,
    workout.id,
    input.name.trim(),
    (maxSort?.m ?? 0) + 1,
    input.rest_seconds ?? null,
    now,
    now
  );

  return getProgramDetail(programUuid);
}

export function updateSection(
  programUuid: string,
  sectionUuid: string,
  updates: { name?: string; rest_seconds?: number | null }
): Program {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existing = db.getFirstSync<SectionRow>(
    "SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at FROM sections WHERE uuid = ?",
    sectionUuid
  );
  if (!existing) throw new NotFoundError("section", sectionUuid);

  db.runSync(
    `UPDATE sections SET name = ?, rest_seconds = ?, updated_at = ? WHERE uuid = ?`,
    (updates.name ?? existing.name).trim(),
    updates.rest_seconds !== undefined ? updates.rest_seconds : existing.rest_seconds,
    now,
    sectionUuid
  );

  return getProgramDetail(programUuid);
}

export function deleteSection(programUuid: string, sectionUuid: string): Program {
  const db = getDatabase();
  const result = db.runSync("DELETE FROM sections WHERE uuid = ?", sectionUuid);
  if (result.changes === 0) throw new NotFoundError("section", sectionUuid);
  return getProgramDetail(programUuid);
}

// ---------------------------------------------------------------------------
// Section Exercise CRUD
// ---------------------------------------------------------------------------

export function addSectionExercise(
  programUuid: string,
  sectionUuid: string,
  input: {
    exercise_uuid: string;
    target_sets?: number | null;
    target_reps?: number | null;
    target_weight?: number | null;
    target_duration?: number | null;
    target_distance?: number | null;
    notes?: string | null;
    set_scheme?: SetScheme | null;
  }
): Program {
  const db = getDatabase();
  const now = new Date().toISOString();
  const uuid = generateUUID();

  const section = db.getFirstSync<{ id: number }>(
    "SELECT id FROM sections WHERE uuid = ?",
    sectionUuid
  );
  if (!section) throw new NotFoundError("section", sectionUuid);

  const exerciseId = getExerciseIdByUUID(input.exercise_uuid);

  const maxSort = db.getFirstSync<{ m: number | null }>(
    "SELECT MAX(sort_order) AS m FROM section_exercises WHERE section_id = ?",
    section.id
  );

  db.runSync(
    `INSERT INTO section_exercises
     (uuid, section_id, exercise_id, target_sets, target_reps, target_weight,
      target_duration, target_distance, sort_order, notes, set_scheme, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid,
    section.id,
    exerciseId,
    input.target_sets ?? null,
    input.target_reps ?? null,
    input.target_weight ?? null,
    input.target_duration ?? null,
    input.target_distance ?? null,
    (maxSort?.m ?? 0) + 1,
    input.notes ?? null,
    input.set_scheme ? JSON.stringify(input.set_scheme) : null,
    now,
    now
  );

  return getProgramDetail(programUuid);
}

export function deleteSectionExercise(
  programUuid: string,
  sectionExerciseUuid: string
): Program {
  const db = getDatabase();
  const result = db.runSync(
    "DELETE FROM section_exercises WHERE uuid = ?",
    sectionExerciseUuid
  );
  if (result.changes === 0) throw new NotFoundError("section_exercise", sectionExerciseUuid);
  return getProgramDetail(programUuid);
}

// ---------------------------------------------------------------------------
// Scaffold — create a full program tree in one transaction
// ---------------------------------------------------------------------------

export interface ScaffoldInput {
  name: string;
  description?: string | null;
  workouts: {
    name: string;
    day_number: number;
    sections: {
      name: string;
      rest_seconds?: number | null;
      exercises: {
        exercise_uuid: string;
        target_sets?: number | null;
        target_reps?: number | null;
        target_weight?: number | null;
        target_duration?: number | null;
        target_distance?: number | null;
        notes?: string | null;
        set_scheme?: SetScheme | null;
      }[];
    }[];
  }[];
}

export function scaffoldProgram(input: ScaffoldInput): Program {
  const db = getDatabase();
  let progUuid = "";

  db.withTransactionSync(() => {
    const now = new Date().toISOString();
    progUuid = generateUUID();

    db.runSync(
      `INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      progUuid,
      input.name.trim(),
      input.description ?? null,
      now,
      now
    );
    const progId = db.getFirstSync<{ id: number }>(
      "SELECT id FROM programs WHERE uuid = ?",
      progUuid
    )!.id;

    for (let wi = 0; wi < input.workouts.length; wi++) {
      const w = input.workouts[wi];
      const wUuid = generateUUID();
      db.runSync(
        `INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        wUuid,
        progId,
        w.name.trim(),
        w.day_number,
        wi + 1,
        now,
        now
      );
      const wId = db.getFirstSync<{ id: number }>(
        "SELECT id FROM program_workouts WHERE uuid = ?",
        wUuid
      )!.id;

      for (let si = 0; si < w.sections.length; si++) {
        const s = w.sections[si];
        const sUuid = generateUUID();
        db.runSync(
          `INSERT INTO sections (uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          sUuid,
          wId,
          s.name.trim(),
          si + 1,
          s.rest_seconds ?? null,
          now,
          now
        );
        const sId = db.getFirstSync<{ id: number }>(
          "SELECT id FROM sections WHERE uuid = ?",
          sUuid
        )!.id;

        for (let ei = 0; ei < s.exercises.length; ei++) {
          const ex = s.exercises[ei];
          const seUuid = generateUUID();
          const exerciseId = getExerciseIdByUUID(ex.exercise_uuid);
          db.runSync(
            `INSERT INTO section_exercises
             (uuid, section_id, exercise_id, target_sets, target_reps, target_weight,
              target_duration, target_distance, sort_order, notes, set_scheme, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            seUuid,
            sId,
            exerciseId,
            ex.target_sets ?? null,
            ex.target_reps ?? null,
            ex.target_weight ?? null,
            ex.target_duration ?? null,
            ex.target_distance ?? null,
            ei + 1,
            ex.notes ?? null,
            ex.set_scheme ? JSON.stringify(ex.set_scheme) : null,
            now,
            now
          );
        }
      }
    }

  });

  return getProgramDetail(progUuid);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function placeholders(arr: unknown[]): string {
  return arr.map(() => "?").join(", ");
}

// Insert a full program tree (used by copyProgram and seed).
// Expects to be called within a transaction.
function insertProgramTree(p: Program): Program {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.runSync(
    `INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    p.uuid,
    p.name,
    p.description,
    p.is_prebuilt ? 1 : 0,
    p.created_at || now,
    p.updated_at || now
  );
  const progId = db.getFirstSync<{ id: number }>(
    "SELECT id FROM programs WHERE uuid = ?",
    p.uuid
  )!.id;

  for (const w of p.workouts) {
    const wUuid = w.uuid || generateUUID();
    db.runSync(
      `INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      wUuid,
      progId,
      w.name,
      w.day_number,
      w.sort_order,
      w.created_at || now,
      w.updated_at || now
    );
    const wId = db.getFirstSync<{ id: number }>(
      "SELECT id FROM program_workouts WHERE uuid = ?",
      wUuid
    )!.id;

    for (const s of w.sections) {
      const sUuid = s.uuid || generateUUID();
      db.runSync(
        `INSERT INTO sections (uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        sUuid,
        wId,
        s.name,
        s.sort_order,
        s.rest_seconds,
        s.created_at || now,
        s.updated_at || now
      );
      const sId = db.getFirstSync<{ id: number }>(
        "SELECT id FROM sections WHERE uuid = ?",
        sUuid
      )!.id;

      for (const se of s.exercises) {
        const seUuid = se.uuid || generateUUID();
        db.runSync(
          `INSERT INTO section_exercises
           (uuid, section_id, exercise_id, target_sets, target_reps, target_weight,
            target_duration, target_distance, sort_order, notes, set_scheme, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          seUuid,
          sId,
          se.exercise_id,
          se.target_sets,
          se.target_reps,
          se.target_weight,
          se.target_duration,
          se.target_distance,
          se.sort_order,
          se.notes,
          se.set_scheme ? JSON.stringify(se.set_scheme) : null,
          se.created_at || now,
          se.updated_at || now
        );

        if (se.progression_rule) {
          const seId = db.getFirstSync<{ id: number }>(
            "SELECT id FROM section_exercises WHERE uuid = ?",
            seUuid
          )!.id;
          const prUuid = se.progression_rule.uuid || generateUUID();
          db.runSync(
            `INSERT INTO progression_rules
             (uuid, section_exercise_id, strategy, increment, increment_pct,
              deload_threshold, deload_pct, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            prUuid,
            seId,
            se.progression_rule.strategy,
            se.progression_rule.increment,
            se.progression_rule.increment_pct,
            se.progression_rule.deload_threshold,
            se.progression_rule.deload_pct,
            se.progression_rule.created_at || now,
            se.progression_rule.updated_at || now
          );
        }
      }
    }
  }

  return getProgramDetail(p.uuid);
}

// Exported for seed_programs.ts
export { insertProgramTree };
