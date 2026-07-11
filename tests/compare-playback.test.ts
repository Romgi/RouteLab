import { describe, expect, it } from "vitest";
import {
  formatExecutionTime,
  getPlaybackDurationMs,
  getRealtimeLaneStep,
  getTimelineStepAtElapsed,
  parsePlaybackMode,
  PLAYBACK_SPEEDS,
} from "@/lib/compare-playback";

describe("Compare Mode playback timing", () => {
  it("offers multipliers through 100x and parses real-time mode", () => {
    expect(PLAYBACK_SPEEDS).toEqual([0.5, 1, 2, 4, 10, 25, 50, 100]);
    expect(parsePlaybackMode("100")).toBe(100);
    expect(parsePlaybackMode("realtime")).toBe("realtime");
    expect(parsePlaybackMode("invalid")).toBe(1);
  });

  it("lets high multipliers advance multiple events per rendered frame", () => {
    const durationMs = getPlaybackDurationMs({
      startStep: 0,
      maxStep: 100,
      mode: 100,
      realtimeDurationMs: 0,
    });
    expect(durationMs).toBe(680);
    expect(
      getTimelineStepAtElapsed({
        startStep: 0,
        maxStep: 100,
        elapsedMs: 16,
        durationMs,
      }),
    ).toBe(2);
    expect(
      getTimelineStepAtElapsed({
        startStep: 0,
        maxStep: 100,
        elapsedMs: durationMs,
        durationMs,
      }),
    ).toBe(100);
  });

  it("maps each real-time lane to its own measured completion time", () => {
    expect(
      getRealtimeLaneStep({
        elapsedMs: 3,
        executionTimeMs: 6,
        traceLength: 101,
      }),
    ).toBe(50);
    expect(
      getRealtimeLaneStep({
        elapsedMs: 16,
        executionTimeMs: 0,
        traceLength: 101,
      }),
    ).toBe(100);
  });

  it("formats sub-millisecond and visible execution durations honestly", () => {
    expect(formatExecutionTime(0)).toBe("<0.01 ms");
    expect(formatExecutionTime(0.125)).toBe("0.13 ms");
    expect(formatExecutionTime(12.34)).toBe("12.3 ms");
    expect(formatExecutionTime(1234)).toBe("1.23 s");
  });
});
