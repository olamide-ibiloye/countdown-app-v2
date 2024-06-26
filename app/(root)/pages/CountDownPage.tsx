"use client";

import Alert from "@/components/alert/Alert";
import Block from "@/components/block/Block";
import Controls from "@/components/controls/Controls";
import CountDown from "@/components/countdown/CountDown";
import TimeUp from "@/components/timeUp/TimeUp";
import { DataContext } from "@/providers/DataProvider";
import { useState, useEffect, useContext } from "react";

const CountDownPage = () => {
  const { isVisible, setFeature, showAlert, showTimeUp } =
    useContext(DataContext);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    setFeature("countdown");
  }, [setFeature]);

  return isClient ? (
    <div className="flex size-full flex-col">
      <Alert displayTimeMilliseconds={300000} />

      <Alert displayTimeMilliseconds={120000} />

      <TimeUp />

      {!showAlert &&
        !showTimeUp &&
        (isVisible ? <Controls setSchedule={undefined} /> : <Block />)}

      {!showAlert && !showTimeUp && (
        <div className="flex-1">
          <CountDown />
        </div>
      )}
    </div>
  ) : (
    <Block size="full" />
  );
};

export default CountDownPage;
