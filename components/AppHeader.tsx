"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, Share2, Keyboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { presenterButton } from "@/app/presenter/styles";

export function AppHeader({
  label = "v3",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-3.5 border-b border-border bg-background px-[clamp(16px,4vw,56px)] py-3">
      <Link
        href="/"
        aria-label="Aeon Timer home"
        className="flex items-center gap-[11px]"
      >
        <span
          className="size-[38px] shrink-0 bg-[url('../public/logo512.png')] bg-contain bg-center bg-no-repeat"
          aria-hidden="true"
        />
        <span className="font-bold">
          Aeon
          <span className="text-primary dark:text-primary-contrast">Timer</span>
        </span>
        <span
          className={
            label === "v3"
              ? "hidden text-xs text-muted-foreground sm:inline"
              : "text-xs text-muted-foreground"
          }
        >
          {label}
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-[9px]">{children}</div>
    </header>
  );
}

export function AppMenu({
  offline,
  sharing,
  changeEvent = false,
  onShortcuts,
}: {
  offline?: ReactNode;
  sharing?: { label: string; onOpen: () => void };
  changeEvent?: boolean;
  onShortcuts?: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="App menu"
          className={presenterButton({ variant: "quiet" })}
        >
          <Menu size={18} />
          <span className="sr-only">Menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        {offline && (
          <>
            <div className="px-2 py-2 text-xs" role="status">
              {offline}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {sharing && (
          <>
            <DropdownMenuItem
              onSelect={() => {
                window.setTimeout(sharing.onOpen, 0);
              }}
            >
              <Share2 size={16} className="mr-2" />
              {sharing.label}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {onShortcuts && (
          <DropdownMenuItem onSelect={() => window.setTimeout(onShortcuts, 0)}>
            <Keyboard size={16} className="mr-2" />
            Keyboard shortcuts
            <span className="ml-auto pl-4 text-muted-foreground">?</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun size={16} className="mr-2" />
          ) : (
            <Moon size={16} className="mr-2" />
          )}
          {resolvedTheme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"}
        </DropdownMenuItem>
        {changeEvent && <DropdownMenuSeparator />}
        {changeEvent && (
          <DropdownMenuItem asChild>
            <Link href="/join">Change event</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
