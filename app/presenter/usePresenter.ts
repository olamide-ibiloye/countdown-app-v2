"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  initialEvent,
  PRESENTER_KEY,
  readPresenterEvent,
  updateEvent,
  type PresenterCommand,
} from "@/lib/presenter";

const localChange = "aeon-presenter-change";

function subscribe(sync: () => void) {
  const onStorage = (change: StorageEvent) => {
    if (change.key === PRESENTER_KEY || change.key === null) sync();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", sync);
  window.addEventListener(localChange, sync);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", sync);
    window.removeEventListener(localChange, sync);
  };
}

function snapshot() {
  try {
    return localStorage.getItem(PRESENTER_KEY);
  } catch {
    return undefined;
  }
}

function currentMode() {
  return new URLSearchParams(location.search).has("stage")
    ? "stage"
    : "console";
}

const subscribeToMode = () => () => {};

export function usePresenter() {
  const mode = useSyncExternalStore(
    subscribeToMode,
    currentMode,
    () => undefined,
  );
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const [writeFailed, setWriteFailed] = useState(false);
  const event = raw === undefined ? initialEvent : readPresenterEvent(raw);

  function dispatch(command: PresenterCommand) {
    try {
      const current = readPresenterEvent(localStorage.getItem(PRESENTER_KEY));
      const next = updateEvent(current, command, Date.now());
      if (next === current) return true;
      localStorage.setItem(PRESENTER_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(localChange));
      setWriteFailed(false);
      return true;
    } catch {
      setWriteFailed(true);
      return false;
    }
  }

  return {
    event,
    mode,
    dispatch,
    storageError: raw === undefined || writeFailed,
  };
}

export function useStageClock(deadline?: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let timeout: number;
    function tick() {
      clearTimeout(timeout);
      const time = Date.now();
      setNow(time);
      const clockDelay = 1_000 - (time % 1_000);
      const timerDelay =
        deadline !== undefined && deadline > time
          ? (deadline - time) % 1_000 || 1_000
          : clockDelay;
      timeout = window.setTimeout(tick, Math.min(clockDelay, timerDelay));
    }
    tick();
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, [deadline]);
  return now;
}
