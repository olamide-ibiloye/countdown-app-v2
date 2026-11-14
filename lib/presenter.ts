import { isDuration } from "./countdown";

export const PRESENTER_KEY = "aeonPresenter:v1";
export const STAGE_CHANNEL = "aeonStage:v1";
export const ADD_TIME_MS = [30_000, 60_000, 300_000] as const;
const MAX_DURATION_MS = 100 * 60 * 60 * 1000;

export interface Session {
  kind?: "countdown";
  id: string;
  name: string;
  durationMs: number;
}

export function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const session = value as Partial<Session>;
  return (
    typeof session.id === "string" &&
    typeof session.name === "string" &&
    (session.kind === undefined || session.kind === "countdown") &&
    isDuration(session.durationMs)
  );
}

type TimerPhase =
  | { phase: "ready" }
  | { phase: "running"; deadline: number }
  | { phase: "paused"; remainingMs: number };

export type ActiveTimer = Session & TimerPhase & { warningCeilingMs?: number };

export type ImageFit = "fill" | "fit";

export type StageOutput =
  | { kind: "standby" | "countdown" }
  | { kind: "clock"; twentyFourHours: boolean }
  | { kind: "message"; html: string }
  | {
      kind: "image";
      imageId: string;
      name: string;
      fit: ImageFit;
      queueItemId?: string;
    };

export interface ImageQueueItem {
  kind: "image";
  id: string;
  name: string;
  imageId: string;
  fit: ImageFit;
}

export type QueueItem = Session | ImageQueueItem;

export function isQueueItem(value: unknown): value is QueueItem {
  if (isSession(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<ImageQueueItem>;
  return (
    item.kind === "image" &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.imageId === "string" &&
    (item.fit === "fill" || item.fit === "fit")
  );
}

export interface PresenterEvent {
  queue: QueueItem[];
  timer: ActiveTimer | null;
  output: StageOutput;
  revision: number;
}

export const initialEvent: PresenterEvent = {
  queue: [],
  timer: null,
  output: { kind: "standby" },
  revision: 0,
};

export function remainingTime(timer: ActiveTimer, now: number): number {
  if (timer.phase === "running") return Math.max(0, timer.deadline - now);
  if (timer.phase === "paused") return timer.remainingMs;
  return timer.durationMs;
}

export function warningMinutes(timer: ActiveTimer, remainingMs: number) {
  if (timer.phase !== "running" || !remainingMs) return;
  return [5, 2].find((minutes) => {
    const threshold = minutes * 60_000;
    return (
      (timer.warningCeilingMs ?? timer.durationMs) >= threshold &&
      remainingMs <= threshold &&
      remainingMs > threshold - 5_000
    );
  });
}

export function parseDuration(value: string): number | undefined {
  if (!/^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(value)) return;
  const parts = value.split(":").map(Number);
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, ...parts];
  if (seconds > 59 || (parts.length === 3 && minutes > 59)) return;
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1_000;
  if (isDuration(ms) && ms < MAX_DURATION_MS) return ms;
}

export function clockFormat(ms: number) {
  const total = Math.ceil(ms / 1_000);
  const seconds = String(total % 60).padStart(2, "0");
  const minutes = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatPresenterClock(now: number, twentyFourHours: boolean) {
  return new Date(now).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !twentyFourHours,
  });
}

export type PresenterCommand =
  | { type: "queue"; queue: QueueItem[] }
  | { type: "enqueue"; item: QueueItem }
  | { type: "cue"; session: Session }
  | { type: "output"; output: StageOutput }
  | { type: "image-fit"; imageId: string; fit: ImageFit }
  | { type: "play" | "pause" | "reset" | "end" }
  | { type: "extend"; durationMs: (typeof ADD_TIME_MS)[number] };

export function updateEvent(
  event: PresenterEvent,
  command: PresenterCommand,
  now: number,
): PresenterEvent {
  const { timer, output, revision } = event;
  if (command.type === "queue") return { ...event, queue: command.queue };
  if (command.type === "enqueue")
    return { ...event, queue: [...event.queue, command.item] };
  if (command.type === "end") {
    return { ...initialEvent, queue: event.queue, revision: revision + 1 };
  }
  if (command.type === "cue") {
    return {
      ...event,
      timer: { ...command.session, phase: "ready" },
      output: { kind: "countdown" },
      revision: revision + 1,
    };
  }
  if (command.type === "output") {
    if (command.output.kind === "countdown" && !timer) return event;
    return { ...event, output: command.output, revision: revision + 1 };
  }
  if (command.type === "image-fit") {
    if (
      output.kind !== "image" ||
      output.imageId !== command.imageId ||
      output.fit === command.fit
    )
      return event;
    return {
      ...event,
      output: { ...output, fit: command.fit },
      revision: revision + 1,
    };
  }
  if (!timer) return event;

  const { id, name, durationMs, warningCeilingMs } = timer;
  const session = { id, name, durationMs };
  const remainingMs = remainingTime(timer, now);
  let next: ActiveTimer;
  switch (command.type) {
    case "play":
      if (timer.phase === "running") return event;
      next = {
        ...session,
        warningCeilingMs,
        phase: "running",
        deadline: now + remainingMs,
      };
      break;
    case "pause":
      if (timer.phase !== "running" || !remainingMs) return event;
      next = { ...session, warningCeilingMs, phase: "paused", remainingMs };
      break;
    case "reset":
      next = { ...session, phase: "ready" };
      break;
    case "extend":
      if (!remainingMs) return event;
      if (timer.phase === "ready") {
        next = { ...timer, durationMs: durationMs + command.durationMs };
        break;
      }
      next = {
        ...(timer.phase === "running"
          ? { ...timer, deadline: timer.deadline + command.durationMs }
          : { ...timer, remainingMs: remainingMs + command.durationMs }),
        warningCeilingMs: Math.max(
          warningCeilingMs ?? durationMs,
          remainingMs + command.durationMs,
        ),
      };
      break;
  }
  return {
    ...event,
    timer: next,
    revision: output.kind === "countdown" ? revision + 1 : revision,
  };
}

export function readPresenterEvent(raw: string | null): PresenterEvent {
  try {
    if (!raw) return initialEvent;
    const event: PresenterEvent = JSON.parse(raw);
    if (
      !event ||
      !Number.isSafeInteger(event.revision) ||
      event.revision < 0 ||
      !Array.isArray(event.queue) ||
      !event.queue.every(isQueueItem)
    )
      return initialEvent;
    const { timer, output } = event;
    if (
      timer !== null &&
      (!timer ||
        typeof timer.name !== "string" ||
        typeof timer.id !== "string" ||
        !isDuration(timer.durationMs) ||
        !(
          timer.phase === "ready" ||
          (timer.phase === "running" && isDuration(timer.deadline)) ||
          (timer.phase === "paused" && isDuration(timer.remainingMs))
        ))
    )
      return initialEvent;
    if (
      !output ||
      !(
        output.kind === "standby" ||
        (output.kind === "countdown" && timer) ||
        (output.kind === "clock" &&
          typeof output.twentyFourHours === "boolean") ||
        (output.kind === "message" && typeof output.html === "string") ||
        (output.kind === "image" &&
          typeof output.imageId === "string" &&
          typeof output.name === "string" &&
          (output.queueItemId === undefined ||
            typeof output.queueItemId === "string") &&
          (output.fit === "fill" || output.fit === "fit"))
      )
    )
      return initialEvent;
    return event;
  } catch {
    return initialEvent;
  }
}
