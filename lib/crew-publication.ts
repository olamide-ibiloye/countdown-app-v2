import { CREW_POLL_MS } from "./crew";

const KEY = "aeonCrewPublication:v1";
export interface CrewPublication {
  code: string;
  sentAt: number;
  attemptedAt: number;
  fingerprint: string;
  failures: number;
  retryAt: number;
  stopping?: boolean;
}
export function readPublication(code: string): CrewPublication {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      value?.code === code &&
      typeof value.fingerprint === "string" &&
      [value.sentAt, value.attemptedAt, value.failures, value.retryAt].every(
        Number.isFinite,
      )
    )
      return value;
  } catch {
    /* Treat unavailable/old metadata as no successful publication. */
  }
  return {
    code,
    sentAt: 0,
    attemptedAt: 0,
    fingerprint: "",
    failures: 0,
    retryAt: 0,
  };
}
export function savePublication(value: CrewPublication) {
  localStorage.setItem(KEY, JSON.stringify(value));
}
export function publicationBlocked(record: CrewPublication, now: number) {
  return now >= record.attemptedAt && now < record.retryAt;
}
export function publicationUnchanged(
  record: CrewPublication,
  fingerprint: string,
  now: number,
) {
  return (
    record.fingerprint === fingerprint &&
    now >= record.attemptedAt &&
    now - record.attemptedAt < CREW_POLL_MS - 100
  );
}
export async function publicationFingerprint(value: string) {
  if (!crypto.subtle) return value;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
