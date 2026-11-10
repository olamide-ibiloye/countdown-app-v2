export const SECOND_MS = 1_000;
export const BREAK_MS = 10 * SECOND_MS;
const WARNING_MS = 5 * SECOND_MS;
const WARNING_MINUTES = [5, 2];

type Run =
  | { phase: "ready" | "finished"; step: number }
  | { phase: "running" | "break"; step: number; deadline: number }
  | { phase: "paused"; step: number; remainingMs: number };

export interface Timer {
  countdownMs: number;
  sessions: number[];
  run: Run;
}

export const initialTimer: Timer = {
  countdownMs: 600_000,
  sessions: [],
  run: { phase: "ready", step: 0 },
};

export const getDuration = (timer: Timer) =>
  timer.sessions[timer.run.step] ?? timer.countdownMs;

export function getRemaining(timer: Timer, now: number): number {
  const { run } = timer;
  switch (run.phase) {
    case "ready":
      return getDuration(timer);
    case "finished":
      return 0;
    case "paused":
      return run.remainingMs;
    case "running":
    case "break":
      return Math.max(0, run.deadline - now);
  }
}

export function catchUp(timer: Timer, now: number): Timer {
  let { run } = timer;
  while (
    (run.phase === "running" || run.phase === "break") &&
    now >= run.deadline
  ) {
    const { step, deadline } = run;
    if (run.phase === "break") {
      run = {
        phase: "running",
        step: step + 1,
        deadline: deadline + timer.sessions[step + 1],
      };
    } else if (step + 1 < timer.sessions.length) {
      run = { phase: "break", step, deadline: deadline + BREAK_MS };
    } else {
      run = { phase: "finished", step };
    }
  }
  return run === timer.run ? timer : { ...timer, run };
}

export function getWarning(
  timer: Timer,
  remainingMs: number,
): number | undefined {
  if (timer.run.phase !== "running") return;
  return WARNING_MINUTES.find((minutes) => {
    const threshold = minutes * 60 * SECOND_MS;
    return (
      getDuration(timer) >= threshold &&
      remainingMs <= threshold &&
      remainingMs > threshold - WARNING_MS
    );
  });
}

export function getWakeDelay(timer: Timer, now: number): number | undefined {
  if (timer.run.phase !== "running" && timer.run.phase !== "break") return;
  const remainingMs = getRemaining(timer, now);
  if (remainingMs === 0) return 0;

  // Wake when the displayed second changes, or at the next phase deadline.
  return remainingMs % SECOND_MS || SECOND_MS;
}

export type DurationUnit = "hours" | "minutes" | "seconds";

const units: Record<DurationUnit, { ms: number; limit: number }> = {
  hours: { ms: 3_600_000, limit: 100 },
  minutes: { ms: 60_000, limit: 60 },
  seconds: { ms: SECOND_MS, limit: 60 },
};

export function getDurationPart(duration: number, unit: DurationUnit): number {
  const { ms, limit } = units[unit];
  return Math.floor(duration / ms) % limit;
}

export const isDuration = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export type TimerCommand =
  | {
      type:
        | "sync"
        | "toggle"
        | "reset"
        | "skip"
        | "edit"
        | "cancel-edit"
        | "confirm";
    }
  | { type: "adjust"; unit: DurationUnit; amount: 1 | -1 }
  | { type: "countdown"; durationMs: number }
  | { type: "program"; sessions: number[] };

export interface TimerState {
  timer: Timer;
  now: number;
  draftMs: number | null;
  restoredView?: "countdown" | "auto-pilot" | "home";
}

export function updateTimer(
  state: TimerState,
  command: TimerCommand & { now: number },
): TimerState {
  const { now } = command;
  let timer = catchUp(state.timer, now);
  let { draftMs } = state;
  const { run } = timer;

  const configureCountdown = (durationMs: number) => {
    timer = {
      countdownMs: durationMs,
      sessions: [],
      run: { phase: "ready", step: 0 },
    };
    draftMs = null;
  };

  switch (command.type) {
    case "countdown":
      if (isDuration(command.durationMs))
        configureCountdown(command.durationMs);
      break;
    case "program":
      if (command.sessions.length && command.sessions.every(isDuration)) {
        timer = {
          ...timer,
          sessions: command.sessions,
          run: { phase: "ready", step: 0 },
        };
        draftMs = null;
      }
      break;
    case "reset":
      timer = { ...timer, run: { phase: "ready", step: 0 } };
      draftMs = null;
      break;
    case "skip":
      if (run.phase === "break") {
        const step = run.step + 1;
        timer = {
          ...timer,
          run: { phase: "running", step, deadline: now + timer.sessions[step] },
        };
      }
      break;
    case "edit":
      draftMs = timer.countdownMs;
      if (run.phase === "running" && !timer.sessions.length) {
        timer = {
          ...timer,
          run: {
            phase: "paused",
            step: 0,
            remainingMs: getRemaining(timer, now),
          },
        };
      }
      break;
    case "cancel-edit":
      draftMs = null;
      break;
    case "adjust":
      if (draftMs !== null) {
        const { ms, limit } = units[command.unit];
        const current = getDurationPart(draftMs, command.unit);
        const next = (current + command.amount + limit) % limit;
        draftMs += (next - current) * ms;
      }
      break;
    case "confirm":
      if (isDuration(draftMs)) configureCountdown(draftMs);
      break;
    case "toggle":
      if (draftMs !== null) {
        if (!isDuration(draftMs)) break;
        configureCountdown(draftMs);
      }
      if (timer.run.phase === "ready" || timer.run.phase === "paused") {
        timer = {
          ...timer,
          run: {
            phase: "running",
            step: timer.run.step,
            deadline: now + getRemaining(timer, now),
          },
        };
      } else if (timer.run.phase === "running") {
        timer = {
          ...timer,
          run: {
            phase: "paused",
            step: timer.run.step,
            remainingMs: getRemaining(timer, now),
          },
        };
      }
      break;
  }

  return { ...state, timer, now, draftMs };
}
