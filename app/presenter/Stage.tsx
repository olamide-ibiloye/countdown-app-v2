"use client";

import { useCallback, useEffect, useState } from "react";
import { presenterButton } from "./styles";
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
        "grid size-full place-items-center overflow-hidden bg-white p-[5%] text-center font-presenter-mono text-primary [container-type:size] dark:bg-dark-2 dark:text-primary-foreground",
        output.kind === "standby" && "bg-black dark:bg-black",
        output.kind === "image" &&
          "grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] bg-black p-0 dark:bg-black",
        alert &&
          "bg-destructive text-destructive-foreground motion-safe:animate-flash dark:bg-destructive dark:text-destructive-foreground",
      )}
    >
      {content && (
        <Heading
          className={cn(
            alert
              ? "text-[length:min(10cqi,20cqb)] font-[820] leading-none"
              : "whitespace-nowrap text-[length:min(23cqi,42cqb)] font-extrabold tabular-nums leading-none tracking-[-0.055em]",
            output.kind === "clock" &&
              "text-[length:min(12.5cqi,30cqb)] font-[650]",
            !alert &&
              content.length > 5 &&
              output.kind === "countdown" &&
              "text-[length:min(17cqi,36cqb)]",
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
        <div className="max-h-full w-full overflow-auto text-[length:min(5cqi,10cqb)] leading-[1.25] [overflow-wrap:anywhere] [&_blockquote]:border-s-[0.1em] [&_blockquote]:border-current [&_blockquote]:ps-[0.35em] [&_h1]:text-[1.8em] [&_h1]:font-extrabold [&_h2]:text-[1.45em] [&_h2]:font-[750] [&_h3]:text-[1.2em] [&_h3]:font-bold [&_ol]:mx-auto [&_ol]:w-fit [&_ol]:list-decimal [&_ol]:ps-[1em] [&_ol]:text-left [&_ul]:mx-auto [&_ul]:w-fit [&_ul]:list-disc [&_ul]:ps-[1em] [&_ul]:text-left">
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
    <main className="fixed inset-0 z-[100] overflow-hidden bg-white text-white [color-scheme:light] aria-[busy=true]:bg-black dark:bg-dark-2 dark:[color-scheme:dark]">
      <ReportedStageContent
        key={event.output.kind === "image" ? event.output.imageId : "standard"}
        event={event}
        now={now}
        screen={details?.current}
        stageId={stageId}
      />
      {!fullscreen && (
        <div className="absolute right-3.5 top-3.5 text-right text-[0.85rem] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-primary dark:[&_:focus-visible]:outline-primary-contrast">
          <button
            type="button"
            className={presenterButton()}
            onClick={enterFullscreen}
          >
            Fullscreen
          </button>
          {message && (
            <p className="mt-[7px]" role="status">
              {message}
            </p>
          )}
        </div>
      )}
      {storageError && (
        <p
          className="absolute right-3.5 top-3.5 text-right text-[0.85rem] [&_:focus-visible]:outline [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-[3px] [&_:focus-visible]:outline-primary dark:[&_:focus-visible]:outline-primary-contrast"
          role="alert"
        >
          Stage state is unavailable.
        </p>
      )}
    </main>
  );
}
