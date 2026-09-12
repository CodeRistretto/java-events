"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const CAPTURE_KEY = "java-events-lead-captured";
const FOLLOWUP_KEY = "java-events-followup-consent";

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
    cartLengthCm: 320,
    cartWidthCm: 150,
    passageCm: 100,
    rescheduleExtraHours: 2,
  });
  const [form, setForm] = useState({ customerName: "", email: "", phone: "" });
  const [followupConsent, setFollowupConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quoteRef = useRef(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      const already = sessionStorage.getItem(CAPTURE_KEY) === "1";
      const followup = sessionStorage.getItem(FOLLOWUP_KEY) === "1";
      setCaptured(already);
      capturedRef.current = already;
      setFollowupConsent(followup);
    } catch {}

    fetch("/api/event-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.success) return;
        setSettings({
          minimumLeadDays: Number(data.settings?.minimum_lead_days ?? 7),
          balanceDueDaysBefore: Number(data.settings?.balance_due_days_before ?? 3),
          refundPercent: Number(data.settings?.cancellation_refund_bps ?? 5000) / 100,
          cartLengthCm: Number(data.settings?.cart_operating_length_cm ?? 320),
          cartWidthCm: Number(data.settings?.cart_operating_width_cm ?? 150),
          passageCm: Number(data.settings?.minimum_passage_width_cm ?? 100),
          rescheduleExtraHours: Number(data.settings?.reschedule_extra_hours ?? 2),
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

      if (termsCard) {
        const title = termsCard.querySelector(".check-title");
        const text = termsCard.querySelector(".check-text");
        if (title) title.textContent = "Acepto las condiciones operativas y de reserva";
        if (text) {
          text.textContent =
            "Confirmo que revisé el precio, el acceso del lugar y las condiciones mostradas arriba. Entiendo que la fecha sólo queda confirmada con el anticipo.";
        }
      }

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
          marketingConsent: followupConsent,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No fue posible guardar tus datos.");

      setReactInputByLabel("Nombre completo", form.customerName);
      setReactInputByLabel("Teléfono / WhatsApp", form.phone);
      setReactInputByLabel("Correo electrónico", form.email);

      try {
        sessionStorage.setItem(CAPTURE_KEY, "1");
        sessionStorage.setItem(FOLLOWUP_KEY, followupConsent ? "1" : "0");
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
            <div className="java-visible-terms-kicker">CONDICIONES IMPORTANTES DEL SERVICIO</div>
            <div className="java-visible-terms-grid">
              <div><span>Anticipación mínima</span><strong>{settings.minimumLeadDays} días</strong></div>
              <div><span>Saldo completo</span><strong>{settings.balanceDueDaysBefore} días antes</strong></div>
              <div><span>Acceso mínimo</span><strong>{settings.passageCm} cm libres</strong></div>
              <div><span>Área del Coffee Cart</span><strong>{settings.cartLengthCm} × {settings.cartWidthCm} cm</strong></div>
            </div>

            <div className="java-terms-detail">
              <h4>Antes de aceptar, toma en cuenta:</h4>
              <ul>
                <li><strong>Fecha y pago.</strong> La fecha queda confirmada únicamente después del pago del anticipo. El saldo debe liquidarse {settings.balanceDueDaysBefore} días antes del evento.</li>
                <li><strong>Falta de liquidación.</strong> Si el saldo no se paga dentro del plazo y el evento se cancela por esa causa, se devuelve {settings.refundPercent}% del anticipo; el resto se retiene por logística, preparación y bloqueo de fecha.</li>
                <li><strong>Lugar apto.</strong> El cliente/venue debe proporcionar un área firme y utilizable de al menos {settings.cartLengthCm} × {settings.cartWidthCm} cm, con un recorrido de mínimo {settings.passageCm} cm libres por puertas, pasillos y elevadores.</li>
                <li><strong>Acceso y montaje.</strong> Restricciones no informadas, escaleras, puertas angostas, elevadores insuficientes, falta de acceso de descarga o impedimentos del venue pueden impedir o retrasar el servicio.</li>
                <li><strong>Electricidad.</strong> El lugar debe contar con una conexión eléctrica adecuada y accesible. Fallas del inmueble o cortes ajenos a Java pueden limitar temporalmente la operación.</li>
                <li><strong>Agua.</strong> Java lleva sus propios garrafones; no es obligatorio que el venue tenga toma de agua potable para el Coffee Cart.</li>
                <li><strong>Alergias.</strong> El cliente debe informar alergias o restricciones alimentarias antes del evento. Trabajamos con ingredientes que pueden incluir leche, soya, nueces u otros alérgenos y no podemos garantizar un ambiente totalmente libre de contacto cruzado.</li>
                <li><strong>Daños o pérdidas.</strong> Daños, pérdida o rotura de equipo, accesorios o propiedad de Java causados por invitados, personal del venue o terceros podrán generar cargos adicionales documentados.</li>
                <li><strong>Exterior y clima.</strong> En eventos exteriores debe existir una zona razonablemente segura y protegida. Lluvia, viento extremo, calor, riesgo eléctrico u otras condiciones inseguras pueden obligar a pausar o suspender el servicio.</li>
                <li><strong>Retrasos.</strong> Retrasos atribuibles al cliente o al venue no extienden automáticamente el horario contratado. El tiempo adicional se cobra conforme a la tarifa vigente.</li>
                <li><strong>Reprogramación.</strong> Si el lugar resulta no apto o el evento requiere cambio de fecha, la reprogramación no es automática ni gratuita: depende de disponibilidad y, cuando proceda, tendrá un cargo equivalente a {settings.rescheduleExtraHours} horas adicionales, además de costos no recuperables que ya se hubieran generado.</li>
                <li><strong>Cambios.</strong> Cambios de invitados, horario, ubicación, menú o condiciones operativas pueden modificar el precio y están sujetos a disponibilidad.</li>
              </ul>
              <p className="java-terms-legal-note">Estas condiciones operativas no eliminan derechos que por ley no puedan renunciarse ni cubren actos imputables a Java que legalmente no puedan excluirse.</p>
            </div>
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

              <label className="java-followup-consent">
                <input type="checkbox" checked={followupConsent} onChange={(e) => setFollowupConsent(e.target.checked)} />
                <span>
                  Quiero recibir seguimiento de esta cotización si no termino mi reserva. Puede ser hasta un correo al mes durante máximo 12 meses y puedo darme de baja en cualquier momento.
                </span>
              </label>

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
