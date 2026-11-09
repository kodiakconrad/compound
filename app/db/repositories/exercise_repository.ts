// Exercise repository — typed SQLite queries for exercises.
// Mirrors internal/store/exercise_store.go.

import { getDatabase } from "../database";
import { NotFoundError } from "../../domain/errors";
import { uuid as generateUUID } from "../../lib/uuid";
import { validateExercise, type Exercise } from "../../domain/exercise";

// ---------------------------------------------------------------------------
// Row type — what SQLite returns (booleans come back as 0/1 integers)
// ---------------------------------------------------------------------------

interface ExerciseRow {
  id: number;
  uuid: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  tracking_type: string;
  notes: string | null;
  is_custom: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRow(row: ExerciseRow): Exercise {
  return {
    ...row,
    tracking_type: row.tracking_type as Exercise["tracking_type"],
    is_custom: row.is_custom === 1,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getExercise(uuid: string): Exercise {
  const db = getDatabase();
  const row = db.getFirstSync<ExerciseRow>(
    `SELECT id, uuid, name, muscle_group, equipment, tracking_type,
            notes, is_custom, created_at, updated_at, deleted_at
     FROM exercises
     WHERE uuid = ? AND deleted_at IS NULL`,
    uuid
  );
  if (!row) {
    throw new NotFoundError("exercise", uuid);
  }
  return mapRow(row);
}

export interface ListExercisesParams {
  muscle_group?: string;
  equipment?: string;
  search?: string;
}

export function listExercises(params?: ListExercisesParams): Exercise[] {
  const db = getDatabase();
  const conditions: string[] = ["deleted_at IS NULL"];
  const args: (string | number)[] = [];

  if (params?.muscle_group) {
    conditions.push("muscle_group = ?");
    args.push(params.muscle_group);
  }
  if (params?.equipment) {
    conditions.push("equipment = ?");
    args.push(params.equipment);
  }
  if (params?.search) {
    conditions.push("name LIKE ?");
    args.push(`%${params.search}%`);
  }

  const query = `
    SELECT id, uuid, name, muscle_group, equipment, tracking_type,
           notes, is_custom, created_at, updated_at, deleted_at
    FROM exercises
    WHERE ${conditions.join(" AND ")}
    ORDER BY name ASC
  `;

  const rows = db.getAllSync<ExerciseRow>(query, ...args);
  return rows.map(mapRow);
}

export interface CreateExerciseInput {
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
  tracking_type?: string;
  notes?: string | null;
}

export function createExercise(input: CreateExerciseInput): Exercise {
  const db = getDatabase();
  const now = new Date().toISOString();
  const uuid = generateUUID();
  const trackingType = input.tracking_type ?? "weight_reps";

  const err = validateExercise({
    name: input.name,
    tracking_type: trackingType,
    muscle_group: input.muscle_group,
    equipment: input.equipment,
  });
  if (err) throw err;

  db.runSync(
    `INSERT INTO exercises (uuid, name, muscle_group, equipment, tracking_type, notes, is_custom, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    uuid,
    input.name.trim(),
    input.muscle_group ?? null,
    input.equipment ?? null,
    trackingType,
    input.notes ?? null,
    now,
    now
  );

  return getExercise(uuid);
}

export function updateExercise(
  uuid: string,
  updates: Partial<CreateExerciseInput>
): Exercise {
  const db = getDatabase();
  const existing = getExercise(uuid);
  const now = new Date().toISOString();

  const name = updates.name ?? existing.name;
  const muscleGroup =
    updates.muscle_group !== undefined
      ? updates.muscle_group
      : existing.muscle_group;
  const equipment =
    updates.equipment !== undefined ? updates.equipment : existing.equipment;
  const trackingType = updates.tracking_type ?? existing.tracking_type;
  const notes =
    updates.notes !== undefined ? updates.notes : existing.notes;

  const err = validateExercise({
    name,
    tracking_type: trackingType,
    muscle_group: muscleGroup,
    equipment,
  });
  if (err) throw err;

  const result = db.runSync(
    `UPDATE exercises
     SET name = ?, muscle_group = ?, equipment = ?, tracking_type = ?, notes = ?, updated_at = ?
     WHERE uuid = ? AND deleted_at IS NULL`,
    name.trim(),
    muscleGroup ?? null,
    equipment ?? null,
    trackingType,
    notes ?? null,
    now,
    uuid
  );
  if (result.changes === 0) {
    throw new NotFoundError("exercise", uuid);
  }

  return getExercise(uuid);
}

export function softDeleteExercise(uuid: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(
    `UPDATE exercises SET deleted_at = ?, updated_at = ? WHERE uuid = ? AND deleted_at IS NULL`,
    now,
    now,
    uuid
  );
  if (result.changes === 0) {
    throw new NotFoundError("exercise", uuid);
  }
}

// ---------------------------------------------------------------------------
// Lookup helper — resolve exercise UUID to integer ID.
// Used by other repositories when inserting section_exercises.
// ---------------------------------------------------------------------------

export function getExerciseIdByUUID(uuid: string): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ id: number }>(
    "SELECT id FROM exercises WHERE uuid = ? AND deleted_at IS NULL",
    uuid
  );
  if (!row) {
    throw new NotFoundError("exercise", uuid);
  }
  return row.id;
}
