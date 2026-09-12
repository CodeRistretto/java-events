(() => {
  if (window.__JAVA_EVENTS_EMBED_LOADED__) return;
  window.__JAVA_EVENTS_EMBED_LOADED__ = true;

  const script = document.currentScript || Array.from(document.scripts).find((node) =>
    String(node.src || "").includes("java-events-embed.js")
  );

  if (!script) return;

  const scriptUrl = new URL(script.src, window.location.href);
  const appOrigin = script.dataset.appOrigin || scriptUrl.origin;
  const targetSelector = script.dataset.target || "#java-events-widget";
  const buttonLabel = script.dataset.label || "Cotizar mi evento";
  const mode = script.dataset.mode || "card";

  const trackingKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "fbclid",
    "ttclid",
  ];

  function buildAppUrl() {
    const url = new URL("/", appOrigin);
    url.searchParams.set("embed", "1");
    url.searchParams.set("open", "1");

    const current = new URL(window.location.href);
    for (const key of trackingKeys) {
      const value = current.searchParams.get(key);
      if (value) url.searchParams.set(key, value);
    }

    return url.toString();
  }

  const style = document.createElement("style");
  style.id = "java-events-embed-styles";
  style.textContent = `
    .jev-widget,
    .jev-widget * {
      box-sizing: border-box;
    }

    .jev-widget {
      --jev-red: #d81f26;
      --jev-ink: #171717;
      --jev-muted: #6b6b6b;
      --jev-bg: #f5f5f3;
      --jev-border: #e6e4df;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--jev-ink);
    }

    .jev-card {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      padding: 32px;
      border: 1px solid var(--jev-border);
      border-radius: 28px;
      background: var(--jev-bg);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.06);
    }

    .jev-eyebrow {
      margin: 0 0 10px;
      color: var(--jev-red);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .jev-card h3 {
      margin: 0;
      max-width: 620px;
      color: var(--jev-ink);
      font-size: clamp(30px, 5vw, 52px);
      line-height: 0.98;
      letter-spacing: -0.045em;
      font-weight: 800;
    }

    .jev-card p {
      margin: 16px 0 0;
      max-width: 620px;
      color: var(--jev-muted);
      font-size: 16px;
      line-height: 1.6;
    }

    .jev-actions {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 24px;
    }

    .jev-open {
      appearance: none;
      border: 0;
      border-radius: 999px;
      background: var(--jev-red);
      color: #fff;
      padding: 15px 24px;
      min-height: 52px;
      font: inherit;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease;
      box-shadow: 0 10px 24px rgba(216, 31, 38, 0.2);
    }

    .jev-open:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 30px rgba(216, 31, 38, 0.26);
    }

    .jev-note {
      color: var(--jev-muted);
      font-size: 13px;
      line-height: 1.4;
    }

    .jev-button-only {
      display: inline-flex;
    }

    .jev-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(12, 12, 12, 0.64);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .jev-overlay.is-open {
      display: flex;
    }

    .jev-dialog {
      position: relative;
      width: min(1180px, 96vw);
      height: min(900px, 92vh);
      overflow: hidden;
      border-radius: 28px;
      background: #fff;
      box-shadow: 0 32px 100px rgba(0, 0, 0, 0.34);
    }

    .jev-frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #f5f5f3;
    }

    .jev-close {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 4;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.94);
      color: #171717;
      font-size: 25px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
    }

    @media (max-width: 700px) {
      .jev-card {
        padding: 24px;
        border-radius: 22px;
      }

      .jev-card h3 {
        font-size: 38px;
      }

      .jev-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .jev-open {
        width: 100%;
      }

      .jev-overlay {
        padding: 0;
      }

      .jev-dialog {
        width: 100vw;
        height: 100dvh;
        border-radius: 0;
      }

      .jev-close {
        top: 10px;
        right: 10px;
      }
    }
  `;

  if (!document.getElementById(style.id)) {
    document.head.appendChild(style);
  }

  const overlay = document.createElement("div");
  overlay.className = "jev-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="jev-dialog" role="dialog" aria-modal="true" aria-label="Cotizar evento con Java Times Caffé">
      <button class="jev-close" type="button" aria-label="Cerrar">×</button>
      <iframe
        class="jev-frame"
        title="Java Times Caffé Events"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
        allow="payment; clipboard-write"
      ></iframe>
    </div>
  `;
  document.body.appendChild(overlay);

  const frame = overlay.querySelector(".jev-frame");
  const closeButton = overlay.querySelector(".jev-close");
  let previousOverflow = "";

  function openWidget() {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");

    if (!frame.src) {
      frame.src = buildAppUrl();
    }

    window.setTimeout(() => closeButton.focus(), 0);
  }

  function closeWidget() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = previousOverflow;
  }

  closeButton.addEventListener("click", closeWidget);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeWidget();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) {
      closeWidget();
    }
  });

  const target = document.querySelector(targetSelector);
  const host = target || document.createElement("div");
  host.classList.add("jev-widget");

  if (!target) {
    document.body.appendChild(host);
  }

  if (mode === "button") {
    host.innerHTML = `<div class="jev-button-only"><button class="jev-open" type="button">${buttonLabel} →</button></div>`;
  } else {
    host.innerHTML = `
      <div class="jev-card">
        <div class="jev-eyebrow">Java Times Caffé · Events</div>
        <h3>Lleva Java a tu evento.</h3>
        <p>Cotiza tu Java Coffee Cart, revisa disponibilidad y aparta tu fecha en línea sin salir de Java Times Caffé.</p>
        <div class="jev-actions">
          <button class="jev-open" type="button">${buttonLabel} →</button>
          <span class="jev-note">Cotización en línea · Fecha sujeta a disponibilidad</span>
        </div>
      </div>
    `;
  }

  host.querySelector(".jev-open")?.addEventListener("click", openWidget);

  window.JavaEvents = {
    open: openWidget,
    close: closeWidget,
  };
})();
