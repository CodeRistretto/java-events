"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MapVisibilityEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    let resizeObserver = null;
    let mountObserver = null;
    let observedMap = null;
    let frame = null;
    let lastWidth = 0;
    let lastHeight = 0;

    const refreshLeaflet = () => {
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        frame = null;

        const map = document.querySelector(".java-location-map.leaflet-container");
        if (!map) return;

        const rect = map.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;

        const changed =
          Math.abs(rect.width - lastWidth) > 2 || Math.abs(rect.height - lastHeight) > 2;

        if (!changed && map.dataset.javaMapSized === "1") return;

        lastWidth = rect.width;
        lastHeight = rect.height;
        map.dataset.javaMapSized = "1";

        // Leaflet listens to the native resize event and recalculates its viewport.
        // Emit it only when the container actually changes size. Observing Leaflet's
        // own style/class mutations created a feedback loop and could freeze the page.
        window.dispatchEvent(new Event("resize"));
      });
    };

    const attachResizeObserver = () => {
      const map = document.querySelector(".java-location-map");
      if (!map || map === observedMap) return;

      resizeObserver?.disconnect();
      observedMap = map;
      lastWidth = 0;
      lastHeight = 0;

      resizeObserver = new ResizeObserver(() => refreshLeaflet());
      resizeObserver.observe(map);
      refreshLeaflet();
    };

    const initial = window.setTimeout(attachResizeObserver, 80);

    // Only watch for the map node being mounted. Do not watch style/class changes:
    // Leaflet changes those while resizing and that can recursively trigger itself.
    mountObserver = new MutationObserver(() => attachResizeObserver());
    mountObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const onWizardStep = () => {
      attachResizeObserver();
      window.setTimeout(refreshLeaflet, 40);
    };

    window.addEventListener("java:wizard-step", onWizardStep);

    return () => {
      clearTimeout(initial);
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mountObserver?.disconnect();
      window.removeEventListener("java:wizard-step", onWizardStep);
    };
  }, [pathname]);

  return null;
}
