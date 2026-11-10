"use client";

import { useEffect, useState } from "react";

export function useOffline() {
  const [status, setStatus] = useState<"preparing" | "ready" | "unavailable">(
    process.env.NODE_ENV === "production" ? "preparing" : "unavailable",
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let cancelled = false;
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => setStatus("unavailable"), 20_000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout);
      if (!cancelled) setStatus(data === "ready" ? "ready" : "unavailable");
    };

    async function prepare() {
      if (!("serviceWorker" in navigator))
        throw new Error("Offline access is unavailable");
      const existing =
        await navigator.serviceWorker.getRegistration("/presenter");
      if (!existing)
        await navigator.serviceWorker.register("/presenter-worker.js", {
          scope: "/presenter",
        });
      const registration = await navigator.serviceWorker.ready;
      if (!cancelled)
        registration.active?.postMessage("prepare", [channel.port2]);
    }
    prepare().catch(() => {
      clearTimeout(timeout);
      if (!cancelled) setStatus("unavailable");
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      channel.port1.close();
    };
  }, []);

  return status;
}
