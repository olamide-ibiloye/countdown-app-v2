"use client";

import { useContext } from "react";
import { DataContext } from "@/providers/DataProvider";
import { getFormattedTime } from "@/utils/functions";
import { cn } from "@/lib/utils";
import PresetBlock from "../editCountdown/PresetBlock";
import EditCountDown from "../editCountdown/EditCountDown";
import ScheduleStepper from "../stepper/ScheduleStepper";
import Block from "../block/Block";

export default function CountDown() {
  const { timer, isVisible, feature } = useContext(DataContext);
  if (timer.draftMs !== null)
    return <EditCountDown durationMs={timer.draftMs} />;

  const currentTime = getFormattedTime(timer.remainingMs);
  return (
    <div className="flex size-full flex-col items-center justify-between">
      <h1
        className={cn(
          "flex w-full flex-1 items-center justify-center text-center font-bold",
          currentTime.length > 5 ? "size-hour-included" : "size-hour-excluded",
        )}
      >
        {currentTime}
      </h1>

      {timer.sessions.length > 0 && feature === "auto-pilot" ? (
        <ScheduleStepper
          sessions={timer.sessions}
          activeStep={timer.run.step}
        />
      ) : isVisible &&
        timer.run.phase !== "running" &&
        feature === "countdown" ? (
        <PresetBlock />
      ) : (
        <Block />
      )}
    </div>
  );
}
