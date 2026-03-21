import { transitionCycle } from "../cycle";

describe("transitionCycle", () => {
  it("allows active → paused", () => {
    expect(transitionCycle("active", "paused")).toBeNull();
  });

  it("allows active → completed", () => {
    expect(transitionCycle("active", "completed")).toBeNull();
  });

  it("allows paused → active", () => {
    expect(transitionCycle("paused", "active")).toBeNull();
  });

  it("allows paused → completed", () => {
    expect(transitionCycle("paused", "completed")).toBeNull();
  });

  it("rejects completed → active", () => {
    expect(transitionCycle("completed", "active")).not.toBeNull();
  });

  it("rejects completed → paused", () => {
    expect(transitionCycle("completed", "paused")).not.toBeNull();
  });

  it("rejects active → active (no self-transition)", () => {
    expect(transitionCycle("active", "active")).not.toBeNull();
  });
});
