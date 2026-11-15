import { z } from "zod";
import {
  remainingTime,
  type PresenterEvent,
  type QueueItem,
} from "./presenter";

export const CREW_POLL_MS = 10_000;
export const CREW_STALE_MS = 35_000;
export const CREW_SESSION_KEY = "aeonCrewShare:v1";
export const CREW_CHANGE = "aeon-crew-change";
export const CREW_STOP_KEY = "aeonCrewStop:v1";
export const CREW_SEQUENCE_KEY = "aeonCrewSequence:v1";
export const crewCode = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);
const itemSchema = z.object({
  name: z.string().max(200),
  kind: z.enum(["countdown", "image"]),
  durationMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
});
export const crewOutputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("countdown") }),
  z.object({ kind: z.literal("standby") }),
  z.object({ kind: z.literal("message"), html: z.string().max(32_000) }),
  z.object({ kind: z.literal("image"), name: z.string().max(200) }),
  z.object({
    kind: z.literal("clock"),
    twentyFourHours: z.boolean(),
    timeMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en-GB", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
  }),
]);
export const crewSnapshotSchema = z.object({
  // Optional so existing sharing sessions can roll forward across deployments.
  output: crewOutputSchema.optional(),
  timer: z
    .object({
      name: z.string().max(200),
      phase: z.enum(["ready", "running", "paused"]),
      remainingMs: z.number().min(0).max(Number.MAX_SAFE_INTEGER),
    })
    .nullable(),
  current: itemSchema.nullable(),
  next: itemSchema.nullable(),
});
export type CrewSnapshot = z.infer<typeof crewSnapshotSchema>;
export interface CrewUpdate {
  snapshot: CrewSnapshot;
  updatedAt: number;
  expiresAt: number;
  serverNow: number;
}
export interface CrewSession {
  code: string;
  token: string;
  expiresAt: number;
  pendingStop?: boolean;
}

function describe(item: QueueItem | undefined) {
  if (!item) return null;
  return {
    kind: item.kind === "image" ? ("image" as const) : ("countdown" as const),
    name: item.name.slice(0, 200),
    ...(item.kind === "image" ? {} : { durationMs: item.durationMs }),
  };
}

export function crewSnapshot(event: PresenterEvent, now: number): CrewSnapshot {
  const { timer, output, queue } = event;
  const currentId =
    output.kind === "image" && output.queueItemId
      ? output.queueItemId
      : timer?.id;
  const currentIndex = queue.findIndex((item) => item.id === currentId);
  const current =
    output.kind === "image"
      ? { kind: "image" as const, name: output.name.slice(0, 200) }
      : timer
        ? {
            kind: "countdown" as const,
            name: timer.name.slice(0, 200),
            durationMs: timer.durationMs,
          }
        : null;
  const sharedOutput =
    output.kind === "clock"
      ? {
          ...output,
          timeMs: now,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
      : output.kind === "image"
        ? { kind: "image" as const, name: output.name.slice(0, 200) }
        : output;
  return {
    output: sharedOutput,
    timer: timer
      ? {
          name: timer.name.slice(0, 200),
          phase: timer.phase,
          remainingMs: remainingTime(timer, now),
        }
      : null,
    current,
    next: describe(queue[currentIndex + 1]),
  };
}

export function readCrewSession(): CrewSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(CREW_SESSION_KEY) || "null");
    return value &&
      crewCode.safeParse(value.code).success &&
      typeof value.token === "string" &&
      /^[a-f0-9]{64}$/.test(value.token) &&
      Number.isFinite(value.expiresAt) &&
      (value.pendingStop === undefined ||
        typeof value.pendingStop === "boolean")
      ? value
      : null;
  } catch {
    return null;
  }
}

export function saveCrewSession(value: CrewSession | null) {
  if (value) localStorage.setItem(CREW_SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(CREW_SESSION_KEY);
  window.dispatchEvent(new Event(CREW_CHANGE));
}

export function stopCrewLocally() {
  localStorage.setItem(CREW_STOP_KEY, crypto.randomUUID());
  const session = readCrewSession();
  if (session) saveCrewSession({ ...session, pendingStop: true });
}
