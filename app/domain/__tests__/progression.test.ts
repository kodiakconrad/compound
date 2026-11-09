import { nextWeight, validateProgressionRule } from "../progression";

describe("nextWeight", () => {
  const linearRule = {
    strategy: "linear" as const,
    increment: 2.5,
    increment_pct: null,
    deload_threshold: 3,
    deload_pct: 10,
  };

  const percentageRule = {
    strategy: "percentage" as const,
    increment: null,
    increment_pct: 5,
    deload_threshold: 3,
    deload_pct: 10,
  };

  const waveRule = {
    strategy: "wave" as const,
    increment: null,
    increment_pct: null,
    deload_threshold: 3,
    deload_pct: 10,
  };

  it("increments linearly on zero failures", () => {
    expect(nextWeight(linearRule, 100, 0)).toBe(102.5);
  });

  it("increments by percentage on zero failures", () => {
    expect(nextWeight(percentageRule, 100, 0)).toBe(105);
  });

  it("holds weight on wave strategy", () => {
    expect(nextWeight(waveRule, 100, 0)).toBe(100);
  });

  it("holds weight on 1 failure (below threshold)", () => {
    expect(nextWeight(linearRule, 100, 1)).toBe(100);
  });

  it("holds weight on 2 failures (below threshold of 3)", () => {
    expect(nextWeight(linearRule, 100, 2)).toBe(100);
  });

  it("deloads on failures equal to threshold", () => {
    // 100 * (1 - 10/100) = 90
    expect(nextWeight(linearRule, 100, 3)).toBe(90);
  });

  it("deloads on failures exceeding threshold", () => {
    expect(nextWeight(linearRule, 100, 5)).toBe(90);
  });

  it("deloads percentage rule the same way", () => {
    expect(nextWeight(percentageRule, 200, 3)).toBe(180);
  });

  it("deloads wave rule the same way", () => {
    expect(nextWeight(waveRule, 100, 3)).toBe(90);
  });

  it("handles zero current weight", () => {
    expect(nextWeight(linearRule, 0, 0)).toBe(2.5);
  });
});

describe("validateProgressionRule", () => {
  it("accepts valid linear rule", () => {
    expect(
      validateProgressionRule({
        strategy: "linear",
        increment: 2.5,
        deload_threshold: 3,
        deload_pct: 10,
      })
    ).toBeNull();
  });

  it("rejects linear without increment", () => {
    const err = validateProgressionRule({
      strategy: "linear",
      increment: null,
      deload_threshold: 3,
      deload_pct: 10,
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("increment");
  });

  it("rejects invalid strategy", () => {
    const err = validateProgressionRule({
      strategy: "invalid",
      deload_threshold: 3,
      deload_pct: 10,
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("strategy");
  });

  it("rejects deload_threshold < 1", () => {
    const err = validateProgressionRule({
      strategy: "linear",
      increment: 2.5,
      deload_threshold: 0,
      deload_pct: 10,
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("deload_threshold");
  });

  it("rejects deload_pct > 100", () => {
    const err = validateProgressionRule({
      strategy: "linear",
      increment: 2.5,
      deload_threshold: 3,
      deload_pct: 150,
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("deload_pct");
  });

  it("accepts valid percentage rule", () => {
    expect(
      validateProgressionRule({
        strategy: "percentage",
        increment_pct: 5,
        deload_threshold: 3,
        deload_pct: 10,
      })
    ).toBeNull();
  });

  it("rejects percentage without increment_pct", () => {
    const err = validateProgressionRule({
      strategy: "percentage",
      increment_pct: null,
      deload_threshold: 3,
      deload_pct: 10,
    });
    expect(err).not.toBeNull();
    expect(err!.field).toBe("increment_pct");
  });
});
