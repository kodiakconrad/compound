import { setupTestDB, TestDatabase } from "./testDatabase";

jest.mock("../../lib/uuid", () => ({
  uuid: () => require("crypto").randomUUID(),
}));

import {
  createCycle,
  getCycleByUUID,
  getCycleWithSessions,
  listActiveCycles,
  updateCycleStatus,
} from "../../db/repositories/cycle_repository";
import {
  createProgram,
  addWorkout,
} from "../../db/repositories/program_repository";
import { NotFoundError, UnprocessableError } from "../../domain/errors";

let db: TestDatabase;

beforeEach(() => {
  db = setupTestDB();
});

afterEach(() => {
  db.close();
  jest.restoreAllMocks();
});

// Helper: create a program with N workouts, return its UUID
function seedProgram(workoutCount: number = 2): string {
  const p = createProgram({ name: "Test Program" });
  for (let i = 1; i <= workoutCount; i++) {
    addWorkout(p.uuid, { name: `Day ${i}`, day_number: i });
  }
  return p.uuid;
}

// ---------------------------------------------------------------------------
// createCycle
// ---------------------------------------------------------------------------

describe("createCycle", () => {
  it("creates a cycle with pre-generated sessions", () => {
    const progUuid = seedProgram(3);
    const cycle = createCycle(progUuid);

    expect(cycle.uuid).toBeDefined();
    expect(cycle.status).toBe("active");
    expect(cycle.started_at).toBeDefined();
    expect(cycle.sessions.length).toBe(3);
    expect(cycle.sessions[0].status).toBe("pending");
    expect(cycle.sessions[0].sort_order).toBe(1);
  });

  it("throws NotFoundError for missing program", () => {
    expect(() => createCycle("nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getCycleByUUID
// ---------------------------------------------------------------------------

describe("getCycleByUUID", () => {
  it("retrieves a cycle by UUID", () => {
    const progUuid = seedProgram();
    const created = createCycle(progUuid);
    const fetched = getCycleByUUID(created.uuid);

    expect(fetched.uuid).toBe(created.uuid);
    expect(fetched.status).toBe("active");
    expect(fetched.program_name).toBe("Test Program");
  });

  it("throws NotFoundError for missing UUID", () => {
    expect(() => getCycleByUUID("nonexistent")).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getCycleWithSessions
// ---------------------------------------------------------------------------

describe("getCycleWithSessions", () => {
  it("returns cycle with all sessions", () => {
    const progUuid = seedProgram(2);
    const cycle = createCycle(progUuid);
    const full = getCycleWithSessions(cycle.uuid);

    expect(full.sessions.length).toBe(2);
    expect(full.sessions[0].sort_order).toBe(1);
    expect(full.sessions[1].sort_order).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// listActiveCycles
// ---------------------------------------------------------------------------

describe("listActiveCycles", () => {
  it("returns only active cycles", () => {
    const progUuid = seedProgram();
    const c1 = createCycle(progUuid);
    const c2 = createCycle(progUuid);

    // Complete one cycle
    updateCycleStatus(c1.uuid, "completed");

    const active = listActiveCycles();
    expect(active.length).toBe(1);
    expect(active[0].uuid).toBe(c2.uuid);
  });

  it("returns empty array when no active cycles", () => {
    expect(listActiveCycles().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateCycleStatus
// ---------------------------------------------------------------------------

describe("updateCycleStatus", () => {
  it("transitions active -> paused", () => {
    const progUuid = seedProgram();
    const cycle = createCycle(progUuid);
    updateCycleStatus(cycle.uuid, "paused");
    const fetched = getCycleByUUID(cycle.uuid);
    expect(fetched.status).toBe("paused");
  });

  it("transitions paused -> active", () => {
    const progUuid = seedProgram();
    const cycle = createCycle(progUuid);
    updateCycleStatus(cycle.uuid, "paused");
    updateCycleStatus(cycle.uuid, "active");
    const fetched = getCycleByUUID(cycle.uuid);
    expect(fetched.status).toBe("active");
  });

  it("transitions active -> completed", () => {
    const progUuid = seedProgram();
    const cycle = createCycle(progUuid);
    updateCycleStatus(cycle.uuid, "completed");
    const fetched = getCycleByUUID(cycle.uuid);
    expect(fetched.status).toBe("completed");
    expect(fetched.completed_at).toBeDefined();
  });

  it("throws UnprocessableError for invalid transition (completed -> active)", () => {
    const progUuid = seedProgram();
    const cycle = createCycle(progUuid);
    updateCycleStatus(cycle.uuid, "completed");
    expect(() => updateCycleStatus(cycle.uuid, "active")).toThrow(UnprocessableError);
  });

  it("throws NotFoundError for missing cycle", () => {
    expect(() => updateCycleStatus("nonexistent", "paused")).toThrow(NotFoundError);
  });
});
