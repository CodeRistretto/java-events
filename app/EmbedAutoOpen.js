"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function EmbedAutoOpen() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") !== "1") return;

    const shouldOpen = params.get("open") !== "0";
    document.documentElement.classList.add("java-events-embedded");
    document.body.classList.add("java-events-embedded");

    const style = document.createElement("style");
    style.dataset.javaEmbedMode = "1";
    style.textContent = `
      html.java-events-embedded,
      body.java-events-embedded {
        margin: 0 !important;
        min-height: 100% !important;
        background: #f5f5f7 !important;
        overflow: hidden !important;
      }

      body.java-events-embedded .java-quote-wizard-launch {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      body.java-events-embedded .java-quote-wizard-topline > button {
        display: none !important;
      }

      body.java-events-embedded .java-quote-wizard-panel {
        top: 0 !important;
        width: 100vw !important;
        max-width: none !important;
        max-height: 100dvh !important;
        min-height: 100dvh !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
      }

      body.java-events-embedded .java-quote-wizard-backdrop {
        background: #f5f5f7 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .java-embed-loading {
        position: fixed;
        inset: 0;
        z-index: 7999;
        display: grid;
        place-items: center;
        background: #f5f5f7;
        color: #1d1d1f;
        font-family: "Syne", Arial, sans-serif;
      }

      .java-embed-loading > div {
        display: grid;
        justify-items: center;
        gap: 14px;
      }

      .java-embed-loading span {
        width: 34px;
        height: 34px;
        border: 3px solid rgba(216,31,38,.16);
        border-top-color: #D81F26;
        border-radius: 50%;
        animation: javaEmbedSpin .72s linear infinite;
      }

      .java-embed-loading small {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .11em;
        text-transform: uppercase;
      }

      body.java-quote-wizard-open .java-embed-loading {
        display: none;
      }

      @keyframes javaEmbedSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    const loading = document.createElement("div");
    loading.className = "java-embed-loading";
    loading.setAttribute("aria-hidden", "true");
    loading.innerHTML = '<div><span></span><small>Preparando tu cotización</small></div>';
    document.body.appendChild(loading);

    let attempts = 0;
    let interval = null;
    let observer = null;

    const tryOpen = () => {
      if (!shouldOpen) return true;
      if (document.body.classList.contains("java-quote-wizard-open")) return true;

      const launch = document.querySelector(".java-quote-wizard-launch");
      if (!launch) return false;

      launch.click();
      return true;
    };

    const finishWhenOpen = () => {
      if (!document.body.classList.contains("java-quote-wizard-open")) return false;
      loading.remove();
      window.dispatchEvent(new Event("resize"));
      return true;
    };

    if (!tryOpen()) {
      observer = new MutationObserver(() => {
        if (tryOpen()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    interval = window.setInterval(() => {
      attempts += 1;
      tryOpen();
      if (finishWhenOpen() || attempts >= 160) {
        window.clearInterval(interval);
        interval = null;
        observer?.disconnect();
      }
    }, 75);

    return () => {
      if (interval) window.clearInterval(interval);
      observer?.disconnect();
      loading.remove();
      style.remove();
      document.documentElement.classList.remove("java-events-embedded");
      document.body.classList.remove("java-events-embedded");
    };
  }, [pathname]);

  return null;
}
