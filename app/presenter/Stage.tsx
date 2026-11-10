"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import parse, { domToReact, Element, type DOMNode } from "html-react-parser";
import {
  clockFormat,
  formatPresenterClock,
  remainingTime,
  warningMinutes,
  type PresenterEvent,
} from "@/lib/presenter";
import { StageImage } from "./LocalImage";
import { useStageClock } from "./usePresenter";
import {
  STAGE_FULLSCREEN,
  STAGE_FULLSCREEN_BLOCKED,
  useDisplayDetails,
  useStageReports,
} from "./useStageDisplay";

const messageTags = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "hr",
]);

const messageOptions = {
  replace(node: DOMNode) {
    if (!(node instanceof Element)) return;
    if (!messageTags.has(node.name)) return <></>;
    const Tag = node.name as "p";
    if (node.name === "br" || node.name === "hr") return <Tag />;
    return <Tag>{domToReact(node.children as DOMNode[], messageOptions)}</Tag>;
  },
};

export function StageContent({
  event,
  now,
  preview = false,
  onImageReady,
}: {
  event: PresenterEvent;
  now: number;
  preview?: boolean;
  onImageReady?: (imageId: string) => void;
}) {
  const { output, timer } = event;
  const remaining = timer && now ? remainingTime(timer, now) : 0;
  const countdown = output.kind === "countdown" && timer && now;
  const expired = countdown && remaining === 0;
  const warning = countdown && warningMinutes(timer, remaining);
  const alert = expired || Boolean(warning);
  let content;

  if (countdown) {
    content = expired
      ? "TIME’S UP"
      : warning
        ? `${warning} MINUTE${warning === 1 ? "" : "S"} LEFT`
        : clockFormat(remaining);
  } else if (output.kind === "clock" && now) {
    content = formatPresenterClock(now, output.twentyFourHours);
  }
  const Heading = preview ? "div" : "h1";

  return (
    <div
      className={cn(
        "aeon-output",
        output.kind === "standby" && "aeon-standby",
        output.kind === "image" && "aeon-image-output",
        alert && "aeon-alert motion-safe:animate-flash",
      )}
    >
      {content && (
        <Heading
          className={cn(
            alert ? "aeon-signal" : "aeon-digits",
            output.kind === "clock" && "aeon-digits-clock",
            !alert &&
              content.length > 5 &&
              output.kind === "countdown" &&
              "aeon-digits-hours",
          )}
        >
          {content}
        </Heading>
      )}
      {output.kind === "image" && (
        <StageImage
          key={output.imageId}
          {...output}
          preview={preview}
          onReady={onImageReady}
        />
      )}
      {output.kind === "message" && (
        <div className="aeon-stage-message">
          {parse(output.html, messageOptions)}
        </div>
      )}
    </div>
  );
}

function ReportedStageContent({
  event,
  now,
  screen,
  stageId,
}: {
  event: PresenterEvent;
  now: number;
  screen?: string;
  stageId: string;
}) {
  const [loadedImageId, setLoadedImageId] = useState<string>();
  const ready =
    event.output.kind !== "image" || loadedImageId === event.output.imageId;
  useStageReports(now ? event.revision : undefined, stageId, screen, ready);
  return (
    <StageContent event={event} now={now} onImageReady={setLoadedImageId} />
  );
}

export function StageWindow({
  event,
  storageError,
}: {
  event: PresenterEvent;
  storageError: boolean;
}) {
  const now = useStageClock(
    event.timer?.phase === "running" ? event.timer.deadline : undefined,
  );
  const { details } = useDisplayDetails(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [stageId] = useState(() => crypto.randomUUID());

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
      setMessage("");
      return true;
    } catch {
      setMessage(
        "Use your browser’s fullscreen command or try the button again.",
      );
      return false;
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "f" || e.repeat || document.fullscreenElement)
        return;
      e.preventDefault();
      void enterFullscreen();
    }
    function onMessage(event: MessageEvent) {
      if (
        event.origin === location.origin &&
        event.source === window.opener &&
        event.data === STAGE_FULLSCREEN &&
        !document.fullscreenElement
      ) {
        void enterFullscreen().then((entered) => {
          if (!entered)
            window.opener?.postMessage(
              STAGE_FULLSCREEN_BLOCKED,
              location.origin,
            );
        });
      }
    }
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    onChange();
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, [enterFullscreen]);

  return (
    <main className="aeon-stage-window">
      <ReportedStageContent
        key={event.output.kind === "image" ? event.output.imageId : "standard"}
        event={event}
        now={now}
        screen={details?.current}
        stageId={stageId}
      />
      {!fullscreen && (
        <div className="aeon-stage-setup">
          <button type="button" onClick={enterFullscreen}>
            Fullscreen
          </button>
          {message && <p role="status">{message}</p>}
        </div>
      )}
      {storageError && (
        <p className="aeon-stage-setup" role="alert">
          Stage state is unavailable.
        </p>
      )}
    </main>
  );
}
