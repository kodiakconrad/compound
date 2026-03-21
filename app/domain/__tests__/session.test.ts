import { startSession, completeSession, skipSession } from "../session";
import type { Session } from "../session";

function makeSession(status: string): Session {
  return {
    id: 1,
    uuid: "test-uuid",
    cycle_id: 1,
    program_workout_id: 1,
    sort_order: 1,
    status: status as Session["status"],
    started_at: null,
    completed_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("startSession", () => {
  it("allows starting a pending session", () => {
    expect(startSession(makeSession("pending"))).toBeNull();
  });

  it("rejects starting an in_progress session", () => {
    expect(startSession(makeSession("in_progress"))).not.toBeNull();
  });

  it("rejects starting a completed session", () => {
    expect(startSession(makeSession("completed"))).not.toBeNull();
  });

  it("rejects starting a skipped session", () => {
    expect(startSession(makeSession("skipped"))).not.toBeNull();
  });
});

describe("completeSession", () => {
  it("allows completing an in_progress session", () => {
    expect(completeSession(makeSession("in_progress"))).toBeNull();
  });

  it("rejects completing a pending session", () => {
    expect(completeSession(makeSession("pending"))).not.toBeNull();
  });

  it("rejects completing a completed session", () => {
    expect(completeSession(makeSession("completed"))).not.toBeNull();
  });
});

describe("skipSession", () => {
  it("allows skipping a pending session", () => {
    expect(skipSession(makeSession("pending"))).toBeNull();
  });

  it("allows skipping an in_progress session", () => {
    expect(skipSession(makeSession("in_progress"))).toBeNull();
  });

  it("rejects skipping a completed session", () => {
    expect(skipSession(makeSession("completed"))).not.toBeNull();
  });

  it("rejects skipping a skipped session", () => {
    expect(skipSession(makeSession("skipped"))).not.toBeNull();
  });
});
