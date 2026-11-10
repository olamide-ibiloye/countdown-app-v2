"use client";

import Block from "@/components/block/Block";
import Controls from "@/components/controls/Controls";
import Time from "@/components/time/Time";
import { DataContext } from "@/providers/DataProvider";
import React, { useContext, useEffect, useState } from "react";

const TimePage = () => {
  const { isVisible } = useContext(DataContext);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? (
    <div className="flex size-full flex-col">
      {isVisible ? <Controls setSchedule={undefined} /> : <Block />}

      <Time />

      <Block />
    </div>
  ) : (
    <Block size="full" />
  );
};

export default TimePage;
