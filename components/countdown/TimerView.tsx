"use client";

import { useContext } from "react";
import { DataContext } from "@/providers/DataProvider";
import { SECOND_MS } from "@/lib/countdown";
import Block from "../block/Block";
import Controls from "../controls/Controls";
import Signal from "../signal/Signal";
import CountDown from "./CountDown";

export default function TimerView({
  openSchedule,
}: {
  openSchedule?: () => void;
}) {
  const { timer, isVisible } = useContext(DataContext);

  if (!timer.restoredView) return <Block size="full" />;
  if (timer.draftMs === null) {
    if (timer.run.phase === "break") {
      return (
        <Signal
          message="Session Over!"
          nextSession={{
            seconds: Math.ceil(timer.remainingMs / SECOND_MS),
            onSkip: () => timer.command({ type: "skip" }),
          }}
        />
      );
    }
    if (timer.run.phase === "finished") {
      return (
        <Signal
          message="Time's Up"
          onClose={() => timer.command({ type: "reset" })}
        />
      );
    }
    if (timer.warningMinutes !== undefined) {
      return (
        <Signal
          message={`You have less than ${timer.warningMinutes} minutes!`}
        />
      );
    }
  }

  return (
    <div className="flex size-full flex-col">
      {isVisible ? <Controls setSchedule={openSchedule} /> : <Block />}
      <div className="size-full flex-1">
        <CountDown />
      </div>
    </div>
  );
}
