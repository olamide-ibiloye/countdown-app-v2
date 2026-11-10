import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Presenter from "./Presenter";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--aeon-font-mono",
});

export const metadata: Metadata = {
  title: "Aeon Timer | Presenter v3",
  description:
    "An offline presenter console and stage display for live events.",
};

export default function PresenterPage() {
  return (
    <div className={jetBrainsMono.variable}>
      <Presenter />
    </div>
  );
}
