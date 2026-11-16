"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function PresenterToasts() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      closeButton
      duration={4500}
      toastOptions={{
        classNames: {
          toast: "!border-border !bg-card !text-foreground",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
