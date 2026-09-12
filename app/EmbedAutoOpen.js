"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function EmbedAutoOpen() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const params = new URLSearchParams(window.location.search);
    const framed = window.self !== window.top;
    if (params.get("embed") !== "1" && !framed) return;

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

      body.java-events-embedded main.app-shell > .hero,
      body.java-events-embedded .java-events-landing-mount,
      body.java-events-embedded main.app-shell > footer {
        display: none !important;
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
        padding: 24px;
        text-align: center;
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

      .java-embed-loading button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        background: #D81F26;
        color: #fff;
        min-height: 44px;
        padding: 0 18px;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
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
    let didRequestOpen = false;

    const wizardReady = () => {
      const launch = document.querySelector(".java-quote-wizard-launch");
      const panel = document.querySelector(".java-quote-wizard-panel");
      const formSection = panel?.querySelector(".form-section");
      const progressMount = panel?.querySelector(":scope > .java-quote-wizard-progress-mount");
      const footerMount = panel?.querySelector(":scope > .java-quote-wizard-footer-mount");

      return Boolean(launch && panel && formSection && progressMount && footerMount);
    };

    const tryOpen = () => {
      if (!shouldOpen) return true;
      if (document.body.classList.contains("java-quote-wizard-open")) return true;
      if (didRequestOpen) return false;
      if (!wizardReady()) return false;

      const launch = document.querySelector(".java-quote-wizard-launch");
      if (!launch) return false;

      didRequestOpen = true;
      launch.click();
      return true;
    };

    const finishWhenOpen = () => {
      if (!document.body.classList.contains("java-quote-wizard-open")) return false;
      loading.remove();
      window.dispatchEvent(new Event("resize"));
      return true;
    };

    const showRetry = () => {
      didRequestOpen = false;
      loading.innerHTML = `
        <div>
          <small>No pudimos abrir la cotización automáticamente</small>
          <button type="button">Reintentar</button>
        </div>
      `;
      loading.querySelector("button")?.addEventListener("click", () => {
        attempts = 0;
        loading.innerHTML = '<div><span></span><small>Preparando tu cotización</small></div>';
        tryOpen();
      });
    };

    if (!tryOpen()) {
      observer = new MutationObserver(() => {
        if (tryOpen()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    interval = window.setInterval(() => {
      attempts += 1;

      if (!didRequestOpen) tryOpen();

      if (finishWhenOpen()) {
        window.clearInterval(interval);
        interval = null;
        observer?.disconnect();
        return;
      }

      // If React received the click before the wizard DOM was fully synchronized,
      // allow one more guarded attempt instead of leaving the embed stuck forever.
      if (didRequestOpen && attempts % 20 === 0) {
        didRequestOpen = false;
      }

      if (attempts >= 200) {
        window.clearInterval(interval);
        interval = null;
        observer?.disconnect();
        showRetry();
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
