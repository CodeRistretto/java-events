"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const CAPTURE_KEY = "java-events-lead-captured";

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function setReactInputByLabel(labelText, value) {
  const fields = Array.from(document.querySelectorAll("main.app-shell .field"));
  const field = fields.find((item) => {
    const label = item.querySelector("label");
    return label?.textContent?.trim().toLowerCase() === labelText.toLowerCase();
  });
  const input = field?.querySelector("input");
  if (!input) return;

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function LeadCaptureEnhancer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [quoteContext, setQuoteContext] = useState(null);
  const [termsMount, setTermsMount] = useState(null);
  const [settings, setSettings] = useState({
    minimumLeadDays: 7,
    balanceDueDaysBefore: 3,
    refundPercent: 50,
  });
  const [form, setForm] = useState({ customerName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quoteRef = useRef(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      const already = sessionStorage.getItem(CAPTURE_KEY) === "1";
      setCaptured(already);
      capturedRef.current = already;
    } catch {}

    fetch("/api/event-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.success) return;
        setSettings({
          minimumLeadDays: Number(data.settings?.minimum_lead_days ?? 7),
          balanceDueDaysBefore: Number(data.settings?.balance_due_days_before ?? 3),
          refundPercent: Number(data.settings?.cancellation_refund_bps ?? 5000) / 100,
        });
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  useEffect(() => {
    if (pathname !== "/") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      const isQuote = url.includes("/api/quote") && init?.method?.toUpperCase() === "POST";
      let requestBody = null;

      if (isQuote && typeof init.body === "string") {
        try {
          requestBody = JSON.parse(init.body);
        } catch {}
      }

      const response = await originalFetch(input, init);

      if (isQuote && response.ok) {
        try {
          const data = await response.clone().json();
          if (data?.success && data?.quote) {
            const context = { requestBody: requestBody || {}, quote: data.quote };
            quoteRef.current = context;
            setQuoteContext(context);
            if (!capturedRef.current) setTimeout(() => setOpen(true), 120);
          }
        } catch {}
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    function improveButtonsAndMountTerms() {
      const buttons = Array.from(document.querySelectorAll("main.app-shell button"));
      const calculate = buttons.find((button) =>
        String(button.textContent || "").includes("Calcular precio del evento")
      );
      if (calculate && !calculate.dataset.javaProgressiveCopy) {
        calculate.dataset.javaProgressiveCopy = "1";
        calculate.textContent = "Ver precio de mi evento";
      }

      const termsCard = Array.from(document.querySelectorAll("main.app-shell .check-card")).find(
        (card) => String(card.textContent || "").includes("Entiendo qué estoy contratando")
      );

      if (termsCard && !document.querySelector(".java-visible-terms-mount")) {
        const node = document.createElement("div");
        node.className = "java-visible-terms-mount";
        termsCard.parentElement?.insertBefore(node, termsCard);
        setTermsMount(node);
      }
    }

    function protectReserve(event) {
      const button = event.target.closest?.("button");
      if (!button) return;
      if (!String(button.textContent || "").includes("Apartar fecha con anticipo")) return;
      if (capturedRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      setError("");
      setOpen(true);
    }

    const timer = setTimeout(improveButtonsAndMountTerms, 120);
    const observer = new MutationObserver(improveButtonsAndMountTerms);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", protectReserve, true);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", protectReserve, true);
      document.querySelector(".java-visible-terms-mount")?.remove();
    };
  }, [pathname]);

  async function submitLead(event) {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const context = quoteContext || quoteRef.current;
      if (!context?.quote) throw new Error("Primero calcula el precio de tu evento.");

      const body = context.requestBody || {};
      const quote = context.quote || {};
      const response = await fetch("/api/event-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          email: form.email,
          phone: form.phone,
          serviceAreaId: body.serviceAreaId,
          guestCount: body.guestCount,
          startTime: body.startTime,
          endTime: body.endTime,
          durationHours: body.durationHours,
          selectedAddOns: body.selectedAddOns,
          quoteTotalCents: quote.totalCents,
          quoteDepositCents: quote.depositCents,
          quoteBalanceCents: quote.balanceCents,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No fue posible guardar tus datos.");

      setReactInputByLabel("Nombre completo", form.customerName);
      setReactInputByLabel("Teléfono / WhatsApp", form.phone);
      setReactInputByLabel("Correo electrónico", form.email);

      try {
        sessionStorage.setItem(CAPTURE_KEY, "1");
      } catch {}
      capturedRef.current = true;
      setCaptured(true);
      setOpen(false);

      setTimeout(() => {
        const heading = Array.from(document.querySelectorAll("main.app-shell h3")).find((item) =>
          String(item.textContent || "").includes("¿Dónde instalaremos")
        );
        heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {termsMount &&
        createPortal(
          <div className="java-visible-terms">
            <div className="java-visible-terms-kicker">CONDICIONES DE RESERVA</div>
            <div className="java-visible-terms-grid">
              <div><span>Anticipación mínima</span><strong>{settings.minimumLeadDays} días</strong></div>
              <div><span>Saldo completo</span><strong>{settings.balanceDueDaysBefore} días antes</strong></div>
              <div><span>Si se cancela por falta de pago</span><strong>Se devuelve {settings.refundPercent}% del anticipo</strong></div>
            </div>
            <p>
              El porcentaje restante del anticipo se retiene por logística, preparación y por haber bloqueado la fecha para otros clientes.
            </p>
          </div>,
          termsMount
        )}

      {open && typeof document !== "undefined" &&
        createPortal(
          <div className="java-lead-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
            <form className="java-lead-modal" onSubmit={submitLead} onMouseDown={(event) => event.stopPropagation()}>
              <button type="button" className="java-lead-close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
              <div className="java-lead-kicker">TU PRECIO ESTÁ LISTO</div>
              <h2>Guarda tu cotización y continúa con la reserva.</h2>
              <p>
                Te mostramos el precio antes de pedirte tus datos. Ahora necesitamos sólo lo esencial para guardar tu interés y continuar con la fecha.
              </p>

              {quoteContext?.quote && (
                <div className="java-lead-price">
                  <div><span>Total del evento</span><strong>{money(quoteContext.quote.total)}</strong></div>
                  <div><span>Anticipo para apartar</span><strong>{money(quoteContext.quote.deposit)}</strong></div>
                </div>
              )}

              <div className="java-lead-fields">
                <label><span>Nombre completo</span><input required autoFocus value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
                <label><span>WhatsApp</span><input required inputMode="tel" placeholder="10 dígitos" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label className="full"><span>Correo electrónico</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              </div>

              {error && <div className="java-lead-error">{error}</div>}

              <button className="java-lead-submit" type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Continuar con mi evento →"}
              </button>
              <small>No se realiza ningún cobro en este paso.</small>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
