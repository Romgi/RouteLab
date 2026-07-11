export const BASE_EVENT_DURATION_MS = 680;
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 10, 25, 50, 100] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
export type PlaybackMode = PlaybackSpeed | "realtime";

export function parsePlaybackMode(value: string): PlaybackMode {
  if (value === "realtime") return value;
  const speed = Number(value) as PlaybackSpeed;
  return PLAYBACK_SPEEDS.includes(speed) ? speed : 1;
}

export function getPlaybackDurationMs({
  startStep,
  maxStep,
  mode,
  realtimeDurationMs,
  realtimeStartElapsedMs = 0,
}: {
  startStep: number;
  maxStep: number;
  mode: PlaybackMode;
  realtimeDurationMs: number;
  realtimeStartElapsedMs?: number;
}): number {
  const remainingSteps = Math.max(0, maxStep - startStep);
  if (remainingSteps === 0) return 0;
  if (mode === "realtime") {
    return Math.max(0, realtimeDurationMs - realtimeStartElapsedMs);
  }
  return (remainingSteps * BASE_EVENT_DURATION_MS) / mode;
}

export function getTimelineStepAtElapsed({
  startStep,
  maxStep,
  elapsedMs,
  durationMs,
}: {
  startStep: number;
  maxStep: number;
  elapsedMs: number;
  durationMs: number;
}): number {
  const firstStep = Math.min(maxStep, Math.max(0, startStep));
  const remainingSteps = Math.max(0, maxStep - firstStep);
  if (remainingSteps === 0 || durationMs <= 0) return maxStep;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return Math.min(maxStep, firstStep + Math.floor(progress * remainingSteps));
}

export function getRealtimeLaneStep({
  elapsedMs,
  executionTimeMs,
  traceLength,
}: {
  elapsedMs: number;
  executionTimeMs: number;
  traceLength: number;
}): number {
  const finalStep = Math.max(0, traceLength - 1);
  if (finalStep === 0 || executionTimeMs <= 0) return finalStep;
  const progress = Math.min(1, Math.max(0, elapsedMs / executionTimeMs));
  return Math.min(finalStep, Math.floor(progress * finalStep));
}

export function formatExecutionTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  if (milliseconds < 0.01) return "<0.01 ms";
  if (milliseconds < 1) return `${milliseconds.toFixed(2)} ms`;
  if (milliseconds < 10) return `${milliseconds.toFixed(2)} ms`;
  if (milliseconds < 1000) return `${milliseconds.toFixed(1)} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}
