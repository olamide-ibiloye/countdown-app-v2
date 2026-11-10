"use client";

import React, { useContext } from "react";
import SetCountdown from "../buttons/SetCountdown";
import SetMessage from "../buttons/SetMessage";
import ToggleTimeFormat from "../buttons/ToggleTimeFormat";
import ButtonGroup from "../buttons/ButtonGroup";
import { DataContext } from "@/providers/DataProvider";
import SetSchedule from "../buttons/SetSchedule";

interface SetScheduleProps {
  setSchedule?: () => void;
}

const Controls = ({ setSchedule }: SetScheduleProps) => {
  const { feature } = useContext(DataContext);

  return (
    <div className="flex w-full min-w-full justify-center">
      <div className="flex h-[100px] w-full max-w-[1440px] items-center justify-center gap-4">
        <div className="flex-1">
          {feature === "countdown" && <SetCountdown />}
          {feature === "auto-pilot" && setSchedule && (
            <SetSchedule handleClick={setSchedule} />
          )}
          {feature === "message" && <SetMessage />}
          {feature === "time" && <ToggleTimeFormat />}
        </div>

        <ButtonGroup />
      </div>
    </div>
  );
};

export default Controls;
