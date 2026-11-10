"use client";

import { useEffect, useRef, useState } from "react";
import { STAGE_CHANNEL } from "@/lib/presenter";

interface Display extends Screen {
  left: number;
  top: number;
  availLeft: number;
  availTop: number;
  label: string;
}

interface DisplayDetails extends EventTarget {
  screens: Display[];
  currentScreen: Display;
}

type DisplayWindow = Window & {
  getScreenDetails?: () => Promise<DisplayDetails>;
};
const displayWindow = () => window as DisplayWindow;
const screenKey = (screen: Display) => `${screen.left},${screen.top}`;
const LAST_REPORT_KEY = "aeonStageLastConfirmed:v1";

function readLastConfirmation() {
  try {
    return Number(sessionStorage.getItem(LAST_REPORT_KEY)) || undefined;
  } catch {
    return undefined;
  }
}

interface StageReport {
  type: "report";
  revision: number;
  fullscreen: boolean;
  screen?: string;
  at: number;
  width: number;
  height: number;
}

export function useDisplayDetails(enabled: boolean) {
  const [details, setDetails] = useState<{
    screens: Display[];
    current: string;
  }>();
  const [screenDetails, setScreenDetails] = useState<DisplayDetails>();

  async function enable() {
    try {
      const displays = await displayWindow().getScreenDetails?.();
      if (!displays) return false;
      setScreenDetails(displays);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (!enabled || !displayWindow().getScreenDetails) return;
    let permission: PermissionStatus | undefined;
    let cancelled = false;
    const onPermission = () => {
      if (permission?.state === "granted") {
        displayWindow()
          .getScreenDetails?.()
          .then((result) => {
            if (!cancelled) setScreenDetails(result);
          })
          .catch(() => {});
      } else {
        setScreenDetails(undefined);
      }
    };
    navigator.permissions
      .query({ name: "window-management" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        permission = result;
        permission.addEventListener("change", onPermission);
        onPermission();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      permission?.removeEventListener("change", onPermission);
    };
  }, [enabled]);

  useEffect(() => {
    if (!screenDetails) return;
    const read = () =>
      setDetails({
        screens: [...screenDetails.screens],
        current: screenKey(screenDetails.currentScreen),
      });
    read();
    screenDetails.addEventListener("screenschange", read);
    screenDetails.addEventListener("currentscreenchange", read);
    return () => {
      screenDetails.removeEventListener("screenschange", read);
      screenDetails.removeEventListener("currentscreenchange", read);
    };
  }, [screenDetails]);

  return { details: screenDetails ? details : undefined, enable };
}

export function useStageConnection(
  details: ReturnType<typeof useDisplayDetails>["details"],
  now: number,
) {
  const [report, setReport] = useState<StageReport>();
  const [previousConfirmation] = useState(readLastConfirmation);
  const [hint, setHint] = useState("");
  const popup = useRef<Window | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(STAGE_CHANNEL);
    channel.onmessage = ({ data }: MessageEvent<StageReport>) => {
      if (data?.type !== "report") return;
      setReport(data);
      try {
        sessionStorage.setItem(LAST_REPORT_KEY, String(data.at));
      } catch {
        // The current confirmation is still available in memory.
      }
    };
    return () => channel.close();
  }, []);

  const connected = Boolean(report && now && now - report.at < 4_000);
  const onExtendedDisplay = Boolean(
    report?.screen &&
    details &&
    report.screen !== details.current &&
    details.screens.some((screen) => screenKey(screen) === report.screen),
  );

  function open() {
    const external = details?.screens.find(
      (screen) => screenKey(screen) !== details.current,
    );
    const features = external
      ? `popup,left=${external.availLeft},top=${external.availTop},width=${external.availWidth},height=${external.availHeight}`
      : "popup,width=960,height=540";
    if (!popup.current || popup.current.closed) {
      popup.current = window.open("/presenter?stage=1", "aeon-stage", features);
    }
    if (!popup.current) {
      setHint(
        "Chrome blocked the stage window. Allow pop-ups for this site and try again.",
      );
      return;
    }
    popup.current.focus();
    setHint(
      external
        ? "If Chrome leaves the stage windowed, press F in the stage window or select Fullscreen."
        : "Drag the stage window to the HDMI display, then press F or select Fullscreen.",
    );
  }

  return {
    report,
    lastConfirmedAt: report?.at ?? previousConfirmation,
    connected,
    onExtendedDisplay,
    open,
    hint,
    setHint,
  };
}

export function useStageReports(revision: number | undefined, screen?: string) {
  useEffect(() => {
    if (revision === undefined) return;
    const channel = new BroadcastChannel(STAGE_CHANNEL);
    const send = () => {
      const report: StageReport = {
        type: "report",
        revision,
        fullscreen: Boolean(document.fullscreenElement),
        screen,
        at: Date.now(),
        width: innerWidth,
        height: innerHeight,
      };
      channel.postMessage(report);
    };
    const frame = requestAnimationFrame(send);
    const interval = window.setInterval(send, 1_000);
    document.addEventListener("fullscreenchange", send);
    window.addEventListener("resize", send);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      document.removeEventListener("fullscreenchange", send);
      window.removeEventListener("resize", send);
      channel.close();
    };
  }, [revision, screen]);
}
