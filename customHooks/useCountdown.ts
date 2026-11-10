"use client";

import { useEffect, useReducer } from "react";
import {
  catchUp,
  getRemaining,
  getWakeDelay,
  getWarning,
  initialTimer,
  updateTimer,
  type Timer,
  type TimerCommand,
  type TimerState,
} from "@/lib/countdown";
import { loadTimer, TIMER_KEY } from "@/lib/countdown-storage";

type Action =
  | (TimerCommand & { now: number })
  | { type: "restore"; timer: Timer; now: number };

function reducer(state: TimerState, action: Action): TimerState {
  if (action.type === "restore") {
    const { timer, now } = action;
    const restoredView =
      timer.run.phase === "ready"
        ? "home"
        : timer.sessions.length
          ? "auto-pilot"
          : "countdown";
    return { ...state, timer: catchUp(timer, now), now, restoredView };
  }
  return updateTimer(state, action);
}

export function useCountdown() {
  const [{ timer, now, draftMs, restoredView }, dispatch] = useReducer(
    reducer,
    {
      timer: initialTimer,
      now: 0,
      draftMs: null,
    },
  );
  const ready = restoredView !== undefined;

  useEffect(() => {
    dispatch({
      type: "restore",
      timer: loadTimer(() => window.localStorage),
      now: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    } catch {
      // The timer can still run when storage is unavailable.
    }
  }, [ready, timer]);

  useEffect(() => {
    const delay = getWakeDelay(timer, now);
    if (!ready || delay === undefined) return;
    const sync = () => dispatch({ type: "sync", now: Date.now() });
    const timeout = window.setTimeout(
      sync,
      Math.min(delay, Math.max(0, now + delay - Date.now())),
    );
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [ready, timer, now]);

  const remainingMs = getRemaining(timer, now);
  return {
    ...timer,
    remainingMs,
    warningMinutes: getWarning(timer, remainingMs),
    draftMs,
    restoredView,
    command: (command: TimerCommand) =>
      dispatch({ ...command, now: Date.now() }),
  };
}
