"use client";

import Block from "@/components/block/Block";
import Features from "@/components/features/Features";
import Hero from "@/components/hero/Hero";
import { useEffect, useState } from "react";

const HomePage = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? (
    <div className="flex size-full items-start justify-center">
      <div className="flex size-full max-w-[1440px] flex-col gap-[30px] text-white">
        <Hero />

        <Features />
      </div>
    </div>
  ) : (
    <Block size="full" />
  );
};

export default HomePage;
