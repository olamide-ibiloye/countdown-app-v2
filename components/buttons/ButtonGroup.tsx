"use client";

import { DataContext } from "@/providers/DataProvider";
import { useContext } from "react";
import PlayAndPause from "./PlayAndPause";
import Reset from "./Reset";
import FullScreen from "./FullScreen";
import MobileNav from "../nav/MobileNav";

const ButtonGroup = () => {
  const { feature, isFullscreen, timer } = useContext(DataContext);

  return (
    <div className="flex gap-4">
      {feature === "countdown" && (
        <>
          <PlayAndPause />
          <Reset />
        </>
      )}

      {feature === "auto-pilot" && (
        <>
          {timer.sessions.length > 0 && <PlayAndPause />}
          <Reset />
        </>
      )}

      <FullScreen />

      {isFullscreen && <MobileNav />}
    </div>
  );
};

export default ButtonGroup;
