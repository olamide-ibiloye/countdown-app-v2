"use client";

import { useContext } from "react";
import { DataContext } from "@/providers/DataProvider";
import HomePage from "./pages/HomePage";
import AutoPilotPage from "./pages/AutoPilotPage";
import CountDownPage from "./pages/CountDownPage";
import TimePage from "./pages/TimePage";
import MessagePage from "./pages/MessagePage";

const Home = () => {
  const { feature } = useContext(DataContext);

  return (
    <section className="size-full px-5 xl:px-20">
      {feature === "home" && <HomePage />}
      {feature === "auto-pilot" && <AutoPilotPage />}
      {feature === "countdown" && <CountDownPage />}
      {feature === "time" && <TimePage />}
      {feature === "message" && <MessagePage />}
    </section>
  );
};

export default Home;
