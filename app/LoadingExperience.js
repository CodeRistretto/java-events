"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function LoadingExperience() {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (pathname !== "/") {
      setLoading(false);
      return;
    }

    function sync() {
      const panel = document.querySelector("main.app-shell .panel.form-section");
      const text = String(panel?.textContent || "").trim();
      setLoading(text === "Cargando Java Events...");
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  if (!hydrated || !loading || typeof document === "undefined") return null;

  return createPortal(
    <div className="java-events-loading" role="status" aria-live="polite">
      <div className="java-events-loading-card">
        <div className="java-events-loading-kicker">JAVA TIMES CAFFÉ · EVENTS</div>
        <div className="java-events-loading-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <strong>Preparando tu experiencia Java</strong>
        <p>Estamos cargando disponibilidad, bebidas y precios.</p>
        <div className="java-events-loading-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>,
    document.body
  );
}
