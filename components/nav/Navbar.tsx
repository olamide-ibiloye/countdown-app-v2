"use client";

import React from "react";
import ModeToggle from "../modeToggle/ModeToggle";
import MobileNav from "./MobileNav";
import BrandIcon from "./BrandIcon";

const Navbar = () => {
  return (
    <nav className="bg-light-2 relative mx-auto flex h-16 w-full items-center border-y px-4 py-8 backdrop-blur-lg dark:bg-dark-1 dark:opacity-75">
      <div className="flex-1">
        <BrandIcon />
      </div>

      <a
        href="/presenter"
        className="mr-3 rounded-md border px-3 py-2 text-sm font-semibold"
      >
        Presenter v3
      </a>
      <ModeToggle />
      <MobileNav />
    </nav>
  );
};

export default Navbar;
