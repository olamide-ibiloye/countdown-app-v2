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
export const STAGE_FULLSCREEN = "aeon-stage-fullscreen";
export const STAGE_FULLSCREEN_BLOCKED = "aeon-stage-fullscreen-blocked";
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
  stageId: string;
  revision: number;
  fullscreen: boolean;
  screen?: string;
  at: number;
  width: number;
  height: number;
}

type StageMessage =
  | StageReport
  | { type: "disconnect" | "disconnected" | "close-blocked"; stageId: string };

export function useDisplayDetails(enabled: boolean) {
  const [supportsPlacement] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof displayWindow().getScreenDetails === "function",
  );
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
    if (!enabled || !supportsPlacement || !navigator.permissions?.query) return;
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
  }, [enabled, supportsPlacement]);

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

  return {
    details: screenDetails ? details : undefined,
    enable,
    supportsPlacement,
  };
}

export function useStageConnection(
  details: ReturnType<typeof useDisplayDetails>["details"],
  now: number,
) {
  const [report, setReport] = useState<StageReport>();
  const [lastConfirmedAt, setLastConfirmedAt] = useState(readLastConfirmation);
  const [disconnecting, setDisconnecting] = useState(false);
  const [hint, setHint] = useState("");
  const popup = useRef<Window | null>(null);
  const reportingWindow = useRef<{ stageId: string; window: Window } | null>(
    null,
  );
  const channelRef = useRef<BroadcastChannel | null>(null);
  const disconnectRequest = useRef<{ stageId: string; timeout: number } | null>(
    null,
  );

  useEffect(() => {
    const channel = new BroadcastChannel(STAGE_CHANNEL);
    channelRef.current = channel;
    function rememberStage(event: MessageEvent<StageMessage | string>) {
      if (event.origin !== location.origin || !event.source) return;
      if (
        event.data === STAGE_FULLSCREEN_BLOCKED &&
        (event.source === reportingWindow.current?.window ||
          event.source === popup.current)
      ) {
        setHint(
          "Your browser blocked fullscreen from the dashboard. Press F in the stage window.",
        );
      }
      if (
        typeof event.data === "object" &&
        event.data?.type === "report" &&
        "closed" in event.source
      ) {
        reportingWindow.current = {
          stageId: event.data.stageId,
          window: event.source,
        };
      }
    }
    window.addEventListener("message", rememberStage);
    channel.onmessage = ({ data }: MessageEvent<StageMessage>) => {
      if (
        (data?.type === "disconnected" || data?.type === "close-blocked") &&
        disconnectRequest.current?.stageId === data.stageId
      ) {
        clearTimeout(disconnectRequest.current.timeout);
        disconnectRequest.current = null;
        setDisconnecting(false);
        if (data.type === "disconnected") {
          setReport((current) =>
            current?.stageId === data.stageId ? undefined : current,
          );
          setHint("");
        } else {
          setHint(
            "Your browser couldn’t close the stage window. Close it manually to return to the desktop.",
          );
        }
        return;
      }
      if (data?.type !== "report") return;
      setReport(data);
      setLastConfirmedAt(data.at);
      try {
        sessionStorage.setItem(LAST_REPORT_KEY, String(data.at));
      } catch {
        // The current confirmation is still available in memory.
      }
    };
    return () => {
      if (disconnectRequest.current)
        clearTimeout(disconnectRequest.current.timeout);
      channelRef.current = null;
      window.removeEventListener("message", rememberStage);
      channel.close();
    };
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
        "Your browser blocked the stage window. Allow pop-ups for this site and try again.",
      );
      return;
    }
    popup.current.focus();
    setHint(
      external
        ? "Select Fullscreen Stage when you’re ready to present."
        : "Drag the stage window to the extended display. Press F or select Fullscreen in that window.",
    );
  }

  function disconnect() {
    if (!report || !channelRef.current || disconnectRequest.current) return;
    const { stageId } = report;
    const reported = reportingWindow.current;
    const target = reported?.stageId === stageId ? reported.window : undefined;
    setHint("");
    if (target && !target.closed && !report.fullscreen) target.close();
    if (target?.closed) {
      setReport(undefined);
      return;
    }
    setDisconnecting(true);
    disconnectRequest.current = {
      stageId,
      timeout: window.setTimeout(() => {
        disconnectRequest.current = null;
        setDisconnecting(false);
        if (target?.closed) {
          setReport((current) =>
            current?.stageId === stageId ? undefined : current,
          );
          return;
        }
        setHint(
          "The stage didn’t confirm it closed. If it’s still open, close the stage window manually.",
        );
      }, 4_000),
    };
    channelRef.current.postMessage({
      type: "disconnect",
      stageId,
    } satisfies StageMessage);
  }

  function fullscreen() {
    const reported = reportingWindow.current;
    const target =
      reported?.stageId === report?.stageId ? reported?.window : popup.current;
    if (!target || target.closed) {
      setHint("Use Open Stage to reconnect, then try Fullscreen Stage again.");
      return;
    }
    const options: WindowPostMessageOptions & { delegate: string } = {
      targetOrigin: location.origin,
      delegate: "fullscreen",
    };
    try {
      target.postMessage(STAGE_FULLSCREEN, options);
    } catch {
      setHint(
        "Your browser couldn’t send fullscreen to the stage. Press F in the stage window.",
      );
    }
  }

  return {
    report,
    lastConfirmedAt,
    connected,
    onExtendedDisplay,
    open,
    fullscreen,
    disconnect,
    disconnecting,
    hint,
    setHint,
  };
}

export function useStageReports(revision: number | undefined, screen?: string) {
  const [stageId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (revision === undefined) return;
    const channel = new BroadcastChannel(STAGE_CHANNEL);
    let closing = false;
    let closeTimeout: number | undefined;
    function onPageHide() {
      if (closing)
        channel.postMessage({
          type: "disconnected",
          stageId,
        } satisfies StageMessage);
    }
    channel.onmessage = ({ data }: MessageEvent<StageMessage>) => {
      if (data?.type !== "disconnect" || data.stageId !== stageId || closing)
        return;
      closing = true;
      function closeStage() {
        window.close();
        closeTimeout = window.setTimeout(() => {
          if (window.closed) return;
          closing = false;
          channel.postMessage({
            type: "close-blocked",
            stageId,
          } satisfies StageMessage);
        }, 250);
      }
      if (document.fullscreenElement) {
        void document.exitFullscreen().then(closeStage, closeStage);
      } else {
        closeStage();
      }
    };
    const send = () => {
      if (closing) return;
      const report: StageReport = {
        type: "report",
        stageId,
        revision,
        fullscreen: Boolean(document.fullscreenElement),
        screen,
        at: Date.now(),
        width: innerWidth,
        height: innerHeight,
      };
      channel.postMessage(report);
      window.opener?.postMessage(report, location.origin);
    };
    const frame = requestAnimationFrame(send);
    const interval = window.setInterval(send, 1_000);
    document.addEventListener("fullscreenchange", send);
    window.addEventListener("resize", send);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      clearTimeout(closeTimeout);
      document.removeEventListener("fullscreenchange", send);
      window.removeEventListener("resize", send);
      window.removeEventListener("pagehide", onPageHide);
      channel.close();
    };
  }, [revision, screen, stageId]);
}
