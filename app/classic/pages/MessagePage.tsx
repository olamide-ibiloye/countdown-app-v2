"use client";

import Block from "@/components/block/Block";
import Controls from "@/components/controls/Controls";
import Message from "@/components/message/Message";
import { DataContext } from "@/providers/DataProvider";
import React, { useContext, useEffect, useState } from "react";

const MessagePage = () => {
  const { isVisible } = useContext(DataContext);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? (
    <div className="flex size-full flex-col">
      {isVisible ? <Controls setSchedule={undefined} /> : <Block />}

      <div className="flex-1">
        <Message />
      </div>

      <Block />
    </div>
  ) : (
    <Block size="full" />
  );
};

export default MessagePage;
