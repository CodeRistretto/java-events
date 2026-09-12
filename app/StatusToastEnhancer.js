"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function StatusToastEnhancer() {
  const pathname = usePathname();
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (pathname !== "/") return;

    function show(text, tone = "success") {
      if (!text) return;
      clearTimeout(timerRef.current);
      setToast({ id: Date.now(), text, tone });
      timerRef.current = window.setTimeout(() => setToast(null), 10000);
    }

    function customToast(event) {
      show(event.detail?.text, event.detail?.tone || "success");
    }

    function sync() {
      frameRef.current = null;
      const allStatuses = Array.from(document.querySelectorAll("main.app-shell .status"));

      for (const node of allStatuses) {
        const isSuccess = node.classList.contains("success");
        const text = String(node.textContent || "").trim();

        if (!isSuccess) {
          if (node.classList.contains("java-status-toast-source-hidden")) {
            node.classList.remove("java-status-toast-source-hidden");
          }
          if (node.dataset.javaToastHandled) delete node.dataset.javaToastHandled;
          continue;
        }

        if (!node.classList.contains("java-status-toast-source-hidden")) {
          node.classList.add("java-status-toast-source-hidden");
        }

        if (!text) continue;
        if (node.dataset.javaToastHandled === text) continue;

        node.dataset.javaToastHandled = text;
        show(text, "success");
      }
    }

    function scheduleSync() {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(sync);
    }

    const timer = window.setTimeout(scheduleSync, 80);
    const observer = new MutationObserver(scheduleSync);

    // Important: do not observe class/style attributes here. This enhancer changes
    // the class of success messages itself; observing attributes can create a
    // self-triggering MutationObserver loop that freezes the quote wizard.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("java:toast", customToast);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timerRef.current);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      observer.disconnect();
      window.removeEventListener("java:toast", customToast);
      document
        .querySelectorAll(".java-status-toast-source-hidden")
        .forEach((node) => node.classList.remove("java-status-toast-source-hidden"));
    };
  }, [pathname]);

  if (pathname !== "/" || !toast || typeof document === "undefined") return null;

  const warning = toast.tone === "warning";

  return createPortal(
    <div
      className={`java-status-toast ${warning ? "warning" : "success"}`}
      role="status"
      aria-live="polite"
    >
      <div className="java-status-toast-icon">{warning ? "!" : "✓"}</div>
      <div className="java-status-toast-copy">
        <small>JAVA EVENTS</small>
        <strong>{toast.text}</strong>
      </div>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => {
          clearTimeout(timerRef.current);
          setToast(null);
        }}
      >
        ×
      </button>
      <span className="java-status-toast-progress" key={toast.id} />
    </div>,
    document.body
  );
}
