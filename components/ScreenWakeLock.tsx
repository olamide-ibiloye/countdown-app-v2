"use client";

import { useEffect } from "react";

export default function ScreenWakeLock() {
  useEffect(() => {
    const wakeLock = navigator.wakeLock;
    if (!wakeLock) return;

    let lock: WakeLockSentinel | undefined;
    let requesting = false;
    let active = true;
    let disposed = false;

    function release() {
      const current = lock;
      lock = undefined;
      if (current && !current.released) void current.release().catch(() => {});
    }

    async function sync() {
      if (!active || document.visibilityState !== "visible") {
        release();
        return;
      }
      if (requesting || (lock && !lock.released)) return;

      requesting = true;
      try {
        const next = await wakeLock.request("screen");
        if (disposed || !active || document.visibilityState !== "visible") {
          await next.release();
        } else {
          lock = next;
        }
      } catch {
        // The browser or operating system may decline a wake lock.
      } finally {
        requesting = false;
      }
    }

    function onPageHide() {
      active = false;
      release();
    }

    function onPageShow() {
      active = true;
      void sync();
    }

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    void sync();

    return () => {
      disposed = true;
      onPageHide();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
