"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MapVisibilityEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const timers = new Set();

    const schedule = (delay) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        const map = document.querySelector(".java-location-map.leaflet-container");
        if (!map) return;
        const rect = map.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        window.dispatchEvent(new Event("resize"));
      }, delay);
      timers.add(id);
    };

    const onWizardStep = (event) => {
      if (!event.detail?.open || event.detail?.step !== 2) return;
      schedule(60);
      schedule(220);
    };

    const onOrientation = () => schedule(120);

    window.addEventListener("java:wizard-step", onWizardStep);
    window.addEventListener("orientationchange", onOrientation);

    return () => {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      window.removeEventListener("java:wizard-step", onWizardStep);
      window.removeEventListener("orientationchange", onOrientation);
    };
  }, [pathname]);

  return null;
}
