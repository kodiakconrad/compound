// Cycle repository — typed SQLite queries for cycles.
// Mirrors internal/store/cycle_store.go.

import { getDatabase } from "../database";
import { NotFoundError, UnprocessableError } from "../../domain/errors";
import { uuid as generateUUID } from "../../lib/uuid";
import { transitionCycle, type CycleStatus, type Cycle } from "../../domain/cycle";
import type { Session } from "../../domain/session";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface CycleRow {
  id: number;
  uuid: string;
  program_id: number;
  program_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

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

interface CycleListItem {
  uuid: string;
  program_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getCycleByUUID(uuid: string): Cycle {
  const db = getDatabase();
  const row = db.getFirstSync<CycleRow>(
    `SELECT c.id, c.uuid, c.program_id, p.name AS program_name,
            c.status, c.started_at, c.completed_at, c.created_at, c.updated_at
     FROM cycles c
     JOIN programs p ON p.id = c.program_id
     WHERE c.uuid = ?`,
    uuid
  );
  if (!row) throw new NotFoundError("cycle", uuid);
  return { ...row, status: row.status as CycleStatus, sessions: [] };
}

export function getCycleWithSessions(uuid: string): Cycle {
  const db = getDatabase();
  const cycle = getCycleByUUID(uuid);

  const sessionRows = db.getAllSync<SessionRow>(
    `SELECT id, uuid, cycle_id, program_workout_id, sort_order, status,
            started_at, completed_at, notes, created_at, updated_at
     FROM sessions WHERE cycle_id = ? ORDER BY sort_order`,
    cycle.id
  );

  cycle.sessions = sessionRows.map((r) => ({
    ...r,
    status: r.status as Session["status"],
  }));

  return cycle;
}

export function listActiveCycles(): CycleListItem[] {
  const db = getDatabase();
  return db.getAllSync<CycleListItem>(
    `SELECT c.uuid, p.name AS program_name, c.status,
            c.started_at, c.completed_at, c.created_at, c.updated_at
     FROM cycles c
     JOIN programs p ON p.id = c.program_id
     WHERE c.status = 'active'
     ORDER BY c.created_at DESC`
  );
}

// ---------------------------------------------------------------------------
// Create cycle — pre-generates sessions for all workouts in the program
// ---------------------------------------------------------------------------

export function createCycle(programUuid: string): Cycle {
  const db = getDatabase();
  let cycleUuid = "";

  db.withTransactionSync(() => {
    const now = new Date().toISOString();
    cycleUuid = generateUUID();

    // Resolve program
    const prog = db.getFirstSync<{ id: number }>(
      "SELECT id FROM programs WHERE uuid = ? AND deleted_at IS NULL",
      programUuid
    );
    if (!prog) throw new NotFoundError("program", programUuid);

    // Insert cycle
    db.runSync(
      `INSERT INTO cycles (uuid, program_id, status, started_at, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?)`,
      cycleUuid,
      prog.id,
      now,
      now,
      now
    );
    const cycleId = db.getFirstSync<{ id: number }>(
      "SELECT id FROM cycles WHERE uuid = ?",
      cycleUuid
    )!.id;

    // Pre-generate one session per workout
    const workouts = db.getAllSync<{ id: number; sort_order: number }>(
      "SELECT id, sort_order FROM program_workouts WHERE program_id = ? ORDER BY sort_order",
      prog.id
    );

    for (const w of workouts) {
      db.runSync(
        `INSERT INTO sessions (uuid, cycle_id, program_workout_id, sort_order, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        generateUUID(),
        cycleId,
        w.id,
        w.sort_order,
        now,
        now
      );
    }
  });

  return getCycleWithSessions(cycleUuid);
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export function updateCycleStatus(uuid: string, newStatus: CycleStatus): void {
  const db = getDatabase();
  const cycle = getCycleByUUID(uuid);

  const err = transitionCycle(cycle.status, newStatus);
  if (err) throw err;

  const now = new Date().toISOString();
  const completedAt = newStatus === "completed" ? now : cycle.completed_at;

  db.runSync(
    `UPDATE cycles SET status = ?, completed_at = ?, updated_at = ? WHERE uuid = ?`,
    newStatus,
    completedAt,
    now,
    uuid
  );
}

export function autoCompleteCycleBySessionId(sessionId: number): void {
  const db = getDatabase();

  // Get cycle_id from session
  const session = db.getFirstSync<{ cycle_id: number }>(
    "SELECT cycle_id FROM sessions WHERE id = ?",
    sessionId
  );
  if (!session) return;

  // Count incomplete sessions
  const result = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sessions
     WHERE cycle_id = ? AND status NOT IN ('completed', 'skipped')`,
    session.cycle_id
  );
  if (!result || result.count > 0) return;

  // All done — auto-complete the cycle
  const now = new Date().toISOString();
  db.runSync(
    `UPDATE cycles SET status = 'completed', completed_at = ?, updated_at = ?
     WHERE id = ? AND status = 'active'`,
    now,
    now,
    session.cycle_id
  );
}
