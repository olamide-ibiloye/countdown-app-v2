import { initialTimer, isDuration, type Timer } from "./countdown";
import { getMilliseconds } from "../utils/functions";

export const TIMER_KEY = "countdownTimer:v1";

function readTimer(value: unknown): Timer | undefined {
  if (typeof value !== "object" || value === null) return;
  const { countdownMs, sessions, run } = value as Partial<Timer>;
  if (
    !isDuration(countdownMs) ||
    !Array.isArray(sessions) ||
    !sessions.every(isDuration) ||
    !run ||
    !Number.isInteger(run.step) ||
    run.step < 0 ||
    run.step >= Math.max(1, sessions.length)
  )
    return;

  switch (run.phase) {
    case "ready":
      if (run.step !== 0) return;
      break;
    case "finished":
      if (run.step !== Math.max(0, sessions.length - 1)) return;
      break;
    case "break":
      if (run.step + 1 >= sessions.length || !isDuration(run.deadline)) return;
      break;
    case "running":
      if (!isDuration(run.deadline)) return;
      break;
    case "paused":
      if (
        !isDuration(run.remainingMs) ||
        run.remainingMs > (sessions[run.step] ?? countdownMs)
      )
        return;
      break;
    default:
      return;
  }
  return { countdownMs, sessions, run };
}

function migrateLegacy(raw: string): Timer {
  const {
    hours,
    minutes,
    seconds,
    totalMilliseconds,
    stepperQueue,
    workQueue,
  } = JSON.parse(raw);
  const configuredMs = getMilliseconds({ hours, minutes, seconds });
  const countdownMs = isDuration(configuredMs)
    ? configuredMs
    : initialTimer.countdownMs;
  const sessions = Array.isArray(stepperQueue)
    ? stepperQueue.map((minutes: number) => minutes * 60_000).filter(isDuration)
    : [];
  const step =
    sessions.length && Array.isArray(workQueue)
      ? Math.max(0, sessions.length - workQueue.length - 1)
      : 0;
  const duration = sessions[step] ?? countdownMs;

  // The old format stored remaining time, but no running status or deadline.
  const hasProgress = step > 0 || totalMilliseconds < duration;
  const run =
    isDuration(totalMilliseconds) &&
    totalMilliseconds <= duration &&
    hasProgress
      ? { phase: "paused" as const, step, remainingMs: totalMilliseconds }
      : { phase: "ready" as const, step: 0 };
  return { countdownMs, sessions, run };
}

export function loadTimer(getStorage: () => Pick<Storage, "getItem">): Timer {
  try {
    const storage = getStorage();
    const current = storage.getItem(TIMER_KEY);
    if (current) return readTimer(JSON.parse(current)) ?? initialTimer;
    const legacy = storage.getItem("timeItems");
    return legacy ? migrateLegacy(legacy) : initialTimer;
  } catch {
    return initialTimer;
  }
}
