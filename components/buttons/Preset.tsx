"use client";

import { useContext } from "react";
import { cn } from "@/lib/utils";
import { DataContext } from "@/providers/DataProvider";
import { isDuration } from "@/lib/countdown";
import { getTimeInputMilliseconds } from "@/utils/functions";

export default function Preset({ presetTime }: { presetTime: string }) {
  const { timer } = useContext(DataContext);
  const durationMs = getTimeInputMilliseconds(presetTime);
  const selected = !timer.sessions.length && timer.countdownMs === durationMs;

  return (
    <button
      type="button"
      disabled={!isDuration(durationMs)}
      aria-pressed={selected}
      className={cn(
        "flex h-[40px] items-center justify-center rounded-3xl px-6 transition-all duration-200 md:text-xl",
        selected
          ? "bg-primary text-white hover:bg-primary/90 hover:shadow-md"
          : "border-2 text-gray-500 hover:border-primary/70 hover:text-primary hover:shadow-sm",
      )}
      onClick={() => timer.command({ type: "countdown", durationMs })}
    >
      {presetTime}
    </button>
  );
}
