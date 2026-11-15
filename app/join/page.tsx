import { Suspense } from "react";
import { JetBrains_Mono } from "next/font/google";
import CrewView from "./CrewView";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--aeon-font-mono",
});

export const metadata = {
  title: "Crew View · Aeon Timer",
  description: "Join a read-only event countdown using your crew code.",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function JoinPage() {
  return (
    <div className={jetBrainsMono.variable}>
      <Suspense
        fallback={
          <main className="grid min-h-dvh place-items-center bg-background text-foreground">
            Loading crew view…
          </main>
        }
      >
        <CrewView />
      </Suspense>
    </div>
  );
}
