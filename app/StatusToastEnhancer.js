"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function StatusToastEnhancer() {
  const pathname = usePathname();
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (pathname !== "/") return;

    function show(text) {
      if (!text) return;
      clearTimeout(timerRef.current);
      setToast({ id: Date.now(), text });
      timerRef.current = setTimeout(() => setToast(null), 10000);
    }

    function sync() {
      const allStatuses = Array.from(document.querySelectorAll("main.app-shell .status"));

      for (const node of allStatuses) {
        const isSuccess = node.classList.contains("success");
        const text = String(node.textContent || "").trim();

        if (!isSuccess) {
          node.classList.remove("java-status-toast-source-hidden");
          delete node.dataset.javaToastHandled;
          continue;
        }

        node.classList.add("java-status-toast-source-hidden");
        if (!text) continue;

        if (node.dataset.javaToastHandled !== text) {
          node.dataset.javaToastHandled = text;
          show(text);
        }
      }
    }

    const timer = setTimeout(sync, 80);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      clearTimeout(timer);
      clearTimeout(timerRef.current);
      observer.disconnect();
      document
        .querySelectorAll(".java-status-toast-source-hidden")
        .forEach((node) => node.classList.remove("java-status-toast-source-hidden"));
    };
  }, [pathname]);

  if (pathname !== "/" || !toast || typeof document === "undefined") return null;

  return createPortal(
    <div className="java-status-toast" role="status" aria-live="polite">
      <div className="java-status-toast-icon">✓</div>
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
