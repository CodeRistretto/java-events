"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function EmbedAutoOpen() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") !== "1") return;

    document.body.classList.add("java-events-embedded");

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const launch = document.querySelector(".java-quote-wizard-launch");

      if (launch) {
        launch.click();
        window.clearInterval(interval);
        return;
      }

      if (attempts >= 120) {
        window.clearInterval(interval);
      }
    }, 100);

    return () => {
      window.clearInterval(interval);
      document.body.classList.remove("java-events-embedded");
    };
  }, [pathname]);

  return null;
}
