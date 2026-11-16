"use client";

import {
  ADD_TIME_MS,
  remainingTime,
  type ActiveTimer,
  type PresenterCommand,
} from "@/lib/presenter";
import { presenterButton } from "./styles";

export function CountdownControls({
  timer,
  now,
  dispatch,
}: {
  timer: ActiveTimer;
  now: number;
  dispatch: (command: PresenterCommand) => boolean;
}) {
  const remaining = now ? remainingTime(timer, now) : timer.durationMs;
  const finished = timer.phase === "running" && remaining === 0;
  const running = timer.phase === "running" && !finished;
  return (
    <section
      aria-label="Countdown controls"
      className="mt-3.5 grid gap-3 border-t border-border pt-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Countdown</h2>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {finished
            ? "Finished"
            : running
              ? "Running"
              : timer.phase === "paused"
                ? "Paused"
                : "Ready"}
        </span>
      </div>
      <div className="flex flex-wrap gap-[9px]">
        <button
          type="button"
          className={presenterButton({ variant: "primary" })}
          disabled={finished}
          onClick={() => dispatch({ type: running ? "pause" : "play" })}
        >
          {running
            ? "Pause"
            : timer.phase === "paused"
              ? "Resume Countdown"
              : "Start Countdown"}
        </button>
        <button
          type="button"
          className={presenterButton()}
          disabled={timer.phase === "ready"}
          onClick={() => dispatch({ type: "reset" })}
        >
          Reset
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-[9px] text-xs text-muted-foreground">
        <span>Add Time</span>
        {ADD_TIME_MS.map((durationMs, index) => (
          <button
            type="button"
            key={durationMs}
            className={presenterButton({ size: "small" })}
            disabled={finished}
            onClick={() => dispatch({ type: "extend", durationMs })}
          >
            {["+30 sec", "+1 min", "+5 min"][index]}
          </button>
        ))}
      </div>
    </section>
  );
}
