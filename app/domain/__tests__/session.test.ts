import {
  startSession,
  completeSession,
  skipSession,
  restSecondsAfterSet,
} from "../session";
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

describe("restSecondsAfterSet", () => {
  const flat = { target_sets: 3, set_scheme: null };

  it("uses the section rest between sets of the same exercise", () => {
    expect(restSecondsAfterSet(flat, 1, 60)).toBe(60);
  });

  it("falls back to 90s when the section has no rest", () => {
    expect(restSecondsAfterSet(flat, 2, null)).toBe(90);
  });

  it("rests 2 minutes after the last set of an exercise", () => {
    expect(restSecondsAfterSet(flat, 3, 60)).toBe(120);
  });

  it("keeps a longer section rest after the last set", () => {
    expect(restSecondsAfterSet(flat, 3, 180)).toBe(180);
  });

  it("treats extra sets beyond the target as the last set", () => {
    expect(restSecondsAfterSet(flat, 4, 60)).toBe(120);
  });

  it("counts sets from the scheme when the exercise uses one", () => {
    const scheme = {
      target_sets: null,
      set_scheme: {
        type: "pyramid" as const,
        sets: [{ reps: 10, weight: 40 }, { reps: 8, weight: 45 }],
      },
    };
    expect(restSecondsAfterSet(scheme, 1, 60)).toBe(60);
    expect(restSecondsAfterSet(scheme, 2, 60)).toBe(120);
  });

  it("uses the section rest when the set count is unknown", () => {
    expect(restSecondsAfterSet({ target_sets: null, set_scheme: null }, 5, 60)).toBe(60);
  });
});
