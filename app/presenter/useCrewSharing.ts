"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  PRESENTER_KEY,
  readPresenterEvent,
  type PresenterEvent,
} from "@/lib/presenter";
import {
  CREW_CHANGE,
  CREW_POLL_MS,
  CREW_SESSION_KEY,
  CREW_STOP_KEY,
  CREW_SEQUENCE_KEY,
  crewSnapshot,
  readCrewSession,
  saveCrewSession,
  stopCrewLocally,
  type CrewSession,
} from "@/lib/crew";
import {
  CrewRequestError,
  crewRequest,
  crewRetryDelay,
} from "@/lib/crew-request";

import {
  readPublication,
  savePublication,
  publicationBlocked,
  publicationUnchanged,
  publicationFingerprint,
} from "@/lib/crew-publication";

function subscribe(sync: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === CREW_SESSION_KEY || event.key === null) sync();
  };
  window.addEventListener(CREW_CHANGE, sync);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CREW_CHANGE, sync);
    window.removeEventListener("storage", storage);
  };
}
function sessionRaw() {
  try {
    return localStorage.getItem(CREW_SESSION_KEY);
  } catch {
    return null;
  }
}

export function useCrewSharing(event: PresenterEvent) {
  const raw = useSyncExternalStore(subscribe, sessionRaw, () => null);
  const session = raw ? readCrewSession() : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastPublished, setLastPublished] = useState(0);
  const pump = useRef<() => void>(() => {});
  const fingerprint = JSON.stringify(event);

  useEffect(() => {
    if (!raw) return;
    const expectedCode = readCrewSession()?.code;
    if (!expectedCode) return;
    let active = true;
    let inFlight = false;
    let queued = false;
    async function sync() {
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        const send = async () => {
          const current = readCrewSession();
          if (!current || current.code !== expectedCode) return;
          const record = readPublication(current.code);
          const attemptedAt = Date.now();
          if (
            publicationBlocked(record, attemptedAt) &&
            (!current.pendingStop || record.stopping)
          )
            return;
          try {
            if (current.pendingStop) {
              await crewRequest("DELETE", {
                code: current.code,
                token: current.token,
              });
              if (readCrewSession()?.code === current.code)
                saveCrewSession(null);
              if (active) setError("");
            } else {
              const event = readPresenterEvent(
                localStorage.getItem(PRESENTER_KEY),
              );
              const fingerprint = await publicationFingerprint(
                JSON.stringify(event),
              );
              if (publicationUnchanged(record, fingerprint, Date.now())) {
                if (active) {
                  setLastPublished(record.sentAt);
                  setError("");
                }
                return;
              }
              const sentAt = Date.now();
              // Preserve ordering across refreshes and backward wall-clock changes.
              const previous = Number(localStorage.getItem(CREW_SEQUENCE_KEY));
              const sequence = Math.max(
                sentAt,
                Number.isSafeInteger(previous) ? previous + 1 : 1,
              );
              localStorage.setItem(CREW_SEQUENCE_KEY, String(sequence));
              await crewRequest("PUT", {
                code: current.code,
                token: current.token,
                sequence,
                snapshot: crewSnapshot(event, sentAt),
              });
              savePublication({
                code: current.code,
                sentAt: Date.now(),
                attemptedAt,
                fingerprint,
                failures: 0,
                retryAt: 0,
              });
              if (active) {
                setLastPublished(Date.now());
                setError("");
              }
            }
          } catch (cause) {
            const failures = record.failures + 1;
            savePublication({
              ...record,
              attemptedAt,
              stopping: Boolean(current.pendingStop),
              failures,
              retryAt: Date.now() + crewRetryDelay(failures, cause),
            });
            throw cause;
          }
        };
        if (navigator.locks) {
          await navigator.locks.request(
            "aeon-crew-publish",
            { ifAvailable: true },
            (lock) => (lock ? send() : undefined),
          );
        } else await send();
      } catch (cause) {
        if (
          readCrewSession()?.code === expectedCode &&
          cause instanceof CrewRequestError &&
          (cause.status === 404 || cause.status === 403)
        ) {
          saveCrewSession(null);
        }
        if (active)
          setError(
            cause instanceof CrewRequestError
              ? cause.message
              : "Connection lost. Sharing will retry automatically; your local timer is unaffected.",
          );
      } finally {
        inFlight = false;
        if (queued && active) {
          queued = false;
          void sync();
        }
      }
    }
    pump.current = () => {
      if (active) void sync();
    };
    const wake = () => {
      if (document.visibilityState === "visible") pump.current();
    };
    const interval = window.setInterval(() => pump.current(), CREW_POLL_MS);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    document.addEventListener("visibilitychange", wake);
    pump.current();
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [raw]);

  useEffect(() => {
    pump.current();
  }, [fingerprint]);

  async function start() {
    if (busy || readCrewSession()) return;
    setBusy(true);
    setError("");
    try {
      // Verify persistence before creating a remotely accessible event.
      localStorage.setItem(CREW_SESSION_KEY, "null");
      const stopMarker = localStorage.getItem(CREW_STOP_KEY);
      const created = await crewRequest<CrewSession>(
        "POST",
        crewSnapshot(
          readPresenterEvent(localStorage.getItem(PRESENTER_KEY)),
          Date.now(),
        ),
      );
      try {
        saveCrewSession({
          ...created,
          pendingStop: localStorage.getItem(CREW_STOP_KEY) !== stopMarker,
        });
      } catch {
        await crewRequest("DELETE", {
          code: created.code,
          token: created.token,
        });
        throw new Error("Storage unavailable");
      }
    } catch (cause) {
      setError(
        cause instanceof CrewRequestError
          ? cause.message
          : "Couldn’t start sharing. Check your internet connection and browser storage.",
      );
    } finally {
      setBusy(false);
    }
  }
  function stop() {
    try {
      stopCrewLocally();
      setError("");
    } catch {
      setError(
        "Couldn’t save the cancellation. Check browser storage and try again.",
      );
    }
  }
  return { session, start, stop, busy, error, lastPublished };
}
