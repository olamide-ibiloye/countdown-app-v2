"use client";

import React, { createContext, useState, ReactNode, useEffect } from "react";
import { useLocalStorage } from "@/customHooks/useLocalStorage";
import { useCountdown } from "@/customHooks/useCountdown";
import { initialTimer } from "@/lib/countdown";

const CONTROLS_TIMEOUT_MS = 10_000;

interface MessageItems {
  message: string;
  tempMessage: string;
}

interface DataContextType {
  feature: string;
  setFeature: (feature: string) => void;
  timer: ReturnType<typeof useCountdown>;
  messageEditMode: boolean;
  setMessageEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  twentyFourHoursFormat: boolean;
  setTwentyFourHoursFormat: React.Dispatch<React.SetStateAction<boolean>>;
  message: MessageItems;
  setMessage: React.Dispatch<React.SetStateAction<MessageItems>>;
  isVisible: boolean;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
}

const initialContext: DataContextType = {
  feature: "home",
  setFeature: () => {},
  timer: {
    ...initialTimer,
    remainingMs: initialTimer.countdownMs,
    warningMinutes: undefined,
    draftMs: null,
    restoredView: undefined,
    command: () => {},
  },
  messageEditMode: false,
  setMessageEditMode: () => {},
  isVisible: false,
  isFullscreen: false,
  setIsFullscreen: () => {},
  message: { message: "", tempMessage: "" },
  setMessage: () => {},
  twentyFourHoursFormat: true,
  setTwentyFourHoursFormat: () => {},
};

export const DataContext = createContext(initialContext);

const DataProvider = ({ children }: { children: ReactNode }) => {
  const timer = useCountdown();
  const [selectedFeature, selectFeature] = useState<string>();
  const feature = selectedFeature ?? timer.restoredView ?? "home";
  const [messageEditMode, setMessageEditMode] = useState(false);
  const isPlaying = timer.run.phase === "running";
  const setFeature = (nextFeature: string) => {
    selectFeature(nextFeature);
    if (nextFeature !== "countdown" && timer.draftMs !== null) {
      timer.command({ type: "cancel-edit" });
    }
  };
  const [isVisible, setIsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [twentyFourHoursFormat, setTwentyFourHoursFormat] = useLocalStorage({
    key: "twentyFourHoursFormat",
    defaultValue: JSON.stringify(true),
  });
  const [message, setMessage] = useLocalStorage({
    key: "message",
    defaultValue: JSON.stringify({
      message: "<h1>Type your message here...</h1>",
      tempMessage: "",
    }),
  });
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleMouseMove = () => {
      setIsVisible(true);

      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        if (isPlaying) {
          setIsVisible(false);
        }
      }, CONTROLS_TIMEOUT_MS);
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [isPlaying]);

  return (
    <DataContext.Provider
      value={{
        feature,
        setFeature,
        timer,
        messageEditMode,
        setMessageEditMode,
        message,
        setMessage,
        isVisible: !isPlaying || isVisible,
        isFullscreen,
        setIsFullscreen,
        twentyFourHoursFormat,
        setTwentyFourHoursFormat,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export default DataProvider;
