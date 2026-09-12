"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MapVisibilityEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    let resizeObserver = null;
    let mutationObserver = null;
    let lastWidth = 0;
    let lastHeight = 0;

    const refreshLeaflet = () => {
      const map = document.querySelector(".java-location-map.leaflet-container");
      if (!map) return;

      const rect = map.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return;

      const changed =
        Math.abs(rect.width - lastWidth) > 2 || Math.abs(rect.height - lastHeight) > 2;

      lastWidth = rect.width;
      lastHeight = rect.height;

      if (!changed && map.dataset.javaMapSized === "1") return;
      map.dataset.javaMapSized = "1";

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
        setTimeout(() => window.dispatchEvent(new Event("resize")), 420);
      });
    };

    const attachResizeObserver = () => {
      const map = document.querySelector(".java-location-map");
      if (!map || resizeObserver) return;

      resizeObserver = new ResizeObserver(() => refreshLeaflet());
      resizeObserver.observe(map);
      refreshLeaflet();
    };

    const timer = setTimeout(attachResizeObserver, 100);
    mutationObserver = new MutationObserver(() => {
      attachResizeObserver();
      refreshLeaflet();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    window.addEventListener("java:wizard-step", refreshLeaflet);

    return () => {
      clearTimeout(timer);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("java:wizard-step", refreshLeaflet);
    };
  }, [pathname]);

  return null;
}
