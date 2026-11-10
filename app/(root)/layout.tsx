"use client";

import "./classic-fonts.css";
import { ReactNode, useContext } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import Navbar from "@/components/nav/Navbar";
import Sidebar from "@/components/nav/Sidebar";
import DataProvider, { DataContext } from "@/providers/DataProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

const ClassicLayout = ({ children }: { children: ReactNode }) => {
  const { isFullscreen, setFeature, setIsFullscreen, timer, feature } =
    useContext(DataContext);

  useHotkeys("ctrl+shift+h", () => setFeature("home"));
  useHotkeys("ctrl+shift+a", () => setFeature("auto-pilot"));
  useHotkeys("ctrl+shift+c", () => setFeature("countdown"));
  useHotkeys("ctrl+shift+t", () => setFeature("time"));
  useHotkeys("ctrl+shift+m", () => setFeature("message"));
  useHotkeys("ctrl+shift+f", () => setIsFullscreen(!isFullscreen));
  const onTimerPage = feature === "countdown" || feature === "auto-pilot";
  useHotkeys("ctrl+shift+r", (event) => {
    if (!onTimerPage) return;
    event.preventDefault();
    timer.command({ type: "reset" });
  });
  useHotkeys("space", (event) => {
    if (!onTimerPage || (feature === "auto-pilot" && !timer.sessions.length))
      return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("button, [role=button], [role=dialog]")
    )
      return;
    event.preventDefault();
    timer.command({ type: "toggle" });
  });

  return (
    <main>
      {!isFullscreen && (
        <div className="flex min-h-screen flex-col  xl:h-screen">
          <Navbar />

          <div className="flex size-full flex-1">
            <Sidebar />

            <section className="flex flex-1 flex-col items-center justify-center p-5">
              <div className="h-full min-h-full w-full max-w-[1440px]">
                {children}
              </div>
            </section>
          </div>
        </div>
      )}

      {isFullscreen && (
        <div className="flex h-screen w-full min-w-full flex-col justify-center ">
          {children}
        </div>
      )}
    </main>
  );
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <TooltipProvider>
        <ClassicLayout>{children}</ClassicLayout>
      </TooltipProvider>
      <Toaster />
    </DataProvider>
  );
}
