"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STEPS = [
  { id: 1, label: "Evento", title: "Fecha, horario e invitados" },
  { id: 2, label: "Lugar", title: "Ubicación del evento" },
  { id: 3, label: "Acceso", title: "Acceso y operación" },
  { id: 4, label: "Precio", title: "Extras y cotización" },
  { id: 5, label: "Reserva", title: "Datos, términos y anticipo" },
];

function field(label) {
  const wanted = label.toLowerCase();
  return Array.from(document.querySelectorAll("main.app-shell .field")).find((node) => {
    const text = node.querySelector("label")?.textContent?.trim().toLowerCase() || "";
    return text === wanted || text.includes(wanted);
  });
}

function control(label) {
  return field(label)?.querySelector("input, select, textarea") || null;
}

function hasValue(node) {
  return Boolean(String(node?.value || "").trim());
}

function focusNode(node) {
  if (!node) return;
  node.scrollIntoView?.({ behavior: "smooth", block: "center" });
  setTimeout(() => node.focus?.({ preventScroll: true }), 250);
}

function button(pattern) {
  return Array.from(document.querySelectorAll("main.app-shell button")).find((node) =>
    pattern.test(String(node.textContent || ""))
  );
}

function selectedEventDate() {
  return document.querySelector(".java-calendar-days button.selected")?.dataset?.javaDate || "";
}

function pinReady() {
  try {
    const value = JSON.parse(sessionStorage.getItem("java-event-location-pin") || "null");
    return Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lng));
  } catch {
    return false;
  }
}

function quoteReady() {
  return Boolean(document.querySelector("main.app-shell .quote-money"));
}

function termsCheckbox() {
  return Array.from(document.querySelectorAll("main.app-shell .check-card input[type='checkbox']")).find(
    (input) =>
      /acepto las condiciones|entiendo qué estoy contratando/i.test(
        input.closest(".check-card")?.textContent || ""
      )
  );
}

function validate(step) {
  if (step === 1) {
    const city = control("Ciudad del evento");
    if (!hasValue(city)) return ["Selecciona la ciudad del evento.", city];

    const selectedButton = document.querySelector(".java-calendar-days button.selected");
    const date = selectedEventDate();
    if (!date || !selectedButton) {
      return ["Selecciona la fecha del evento.", document.querySelector(".java-calendar-card")];
    }
    if (selectedButton.classList.contains("java-date-unavailable")) {
      return ["Esa fecha ya no está disponible. Selecciona otra fecha.", document.querySelector(".java-calendar-card")];
    }
    if (document.body.dataset.javaStartChosen !== "1") {
      return [
        "Selecciona primero la hora de inicio.",
        document.querySelector(".java-time-tabs button:first-child"),
      ];
    }
    if (document.body.dataset.javaEndChosen !== "1") {
      return [
        "Ahora selecciona la hora de término.",
        document.querySelector(".java-time-tabs button:nth-child(2)"),
      ];
    }
  }

  if (step === 2) {
    for (const [label, message] of [
      ["Nombre del lugar", "Escribe el nombre del lugar."],
      ["Calle y número", "Completa la calle y número."],
      ["Colonia", "Completa la colonia."],
      ["Código postal", "Completa el código postal."],
    ]) {
      const node = control(label);
      if (!hasValue(node)) return [message, node];
    }
    if (!pinReady()) {
      return [
        "Coloca el pin en la ubicación exacta del evento.",
        document.querySelector(".java-location-picker"),
      ];
    }
  }

  if (step === 3) {
    for (const [label, message] of [
      ["¿El Coffee Cart estará en interior o exterior?", "Selecciona Interior o Exterior."],
      ["¿En qué nivel o piso se instalará?", "Indica el nivel o piso."],
      ["¿Hay elevador disponible", "Indica si hay elevador."],
      ["¿Cómo es el acceso para descargar", "Describe el acceso de descarga."],
      ["Conexión eléctrica disponible", "Describe la conexión eléctrica."],
    ]) {
      const node = control(label);
      if (!hasValue(node)) return [message, node];
    }
    const setup = document.querySelector("[data-java-setup-select]");
    if (!hasValue(setup)) return ["Selecciona el horario de montaje.", setup];
    const measures = document.querySelectorAll(".java-event-measurements input[type='number']");
    if (!hasValue(measures?.[0])) {
      return ["Indica el punto más angosto del recorrido.", measures?.[0]];
    }
    if (!hasValue(measures?.[1])) {
      return ["Indica la distancia a la conexión eléctrica.", measures?.[1]];
    }
    const accepted = document.querySelector(".java-event-access-check input[type='checkbox']");
    if (!accepted?.checked) {
      return ["Confirma que el lugar cumple con el espacio y acceso mínimos.", accepted];
    }
  }

  if (step === 4 && !quoteReady()) {
    return [
      "Calcula el precio del evento antes de continuar.",
      button(/ver precio de mi evento|calcular precio del evento/i),
    ];
  }

  if (step === 5) {
    for (const [label, message] of [
      ["Nombre completo", "Escribe el nombre completo."],
      ["Teléfono / WhatsApp", "Escribe el teléfono / WhatsApp."],
      ["Correo electrónico", "Escribe el correo electrónico."],
    ]) {
      const node = control(label);
      if (!hasValue(node)) return [message, node];
    }
    const terms = termsCheckbox();
    if (terms && !terms.checked) {
      return ["Acepta las condiciones del servicio para continuar.", terms];
    }
  }

  return null;
}

function applyStepVisibility(formSection, activeStep) {
  let current = 0;
  for (const child of Array.from(formSection?.children || [])) {
    if (child.classList.contains("divider")) {
      child.style.display = "none";
      continue;
    }
    const kicker = child.querySelector?.(".section-kicker")?.textContent?.trim() || "";
    const match = kicker.match(/^(\d)\s*·/);
    if (match) current = Number(match[1]);
    if (child.classList.contains("status")) {
      child.style.display = "";
      continue;
    }
    child.style.display = current === activeStep ? "" : "none";
  }
}

function fixServiceCopy() {
  for (const item of Array.from(document.querySelectorAll(".java-terms-detail li"))) {
    if (!/garrafones/i.test(item.textContent || "")) continue;
    const strong = document.createElement("strong");
    strong.textContent = "Agua.";
    item.replaceChildren(
      strong,
      document.createTextNode(
        " Java lleva su agua potable; no es obligatorio que el venue proporcione una toma de agua potable para el Coffee Cart."
      )
    );
  }
}

function targetForError(text) {
  if (/nombre completo/i.test(text)) return control("Nombre completo");
  if (/correo/i.test(text)) return control("Correo electrónico");
  if (/teléfono|telefono|whatsapp/i.test(text)) return control("Teléfono / WhatsApp");
  if (/calle|número|numero/i.test(text)) return control("Calle y número");
  if (/colonia/i.test(text)) return control("Colonia");
  if (/código postal|codigo postal/i.test(text)) return control("Código postal");
  if (/elevador/i.test(text)) return control("¿Hay elevador disponible");
  if (/electricidad/i.test(text)) return control("Conexión eléctrica disponible");
  if (/montaje/i.test(text)) return document.querySelector("[data-java-setup-select]");
  if (/condiciones/i.test(text)) return termsCheckbox();
  if (/fecha|disponib/i.test(text)) return document.querySelector(".java-calendar-card");
  if (/pin|ubicación exacta|ubicacion exacta/i.test(text)) {
    return document.querySelector(".java-location-picker");
  }
  return null;
}

function syncLegacyAvailabilityState() {
  const verifyButton = button(/verificar disponibilidad|revisando fecha/i);
  if (!verifyButton || verifyButton.disabled) return;
  try {
    verifyButton.click();
  } catch {}
}

export default function QuoteFlowWizard() {
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(false);
  const [headerMount, setHeaderMount] = useState(null);
  const [footerMount, setFooterMount] = useState(null);
  const [message, setMessage] = useState("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const timerRef = useRef(null);
  const lastErrorRef = useRef("");

  function alertUser(result) {
    if (!result) return false;
    const [text, target] = result;
    setMessage(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), 4200);
    focusNode(target);
    return true;
  }

  async function verifyAvailabilityAndContinue() {
    const city = control("Ciudad del evento");
    const eventDate = selectedEventDate();
    if (!city?.value || !eventDate) {
      alertUser(["Selecciona ciudad y fecha antes de continuar.", document.querySelector(".java-calendar-card")]);
      return;
    }

    setCheckingAvailability(true);
    setMessage("Confirmando disponibilidad en tiempo real…");
    lastErrorRef.current = "";

    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAreaId: city.value, eventDate }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "No fue posible verificar la disponibilidad.");
      }

      if (!data.available) {
        window.dispatchEvent(
          new CustomEvent("java:calendar-mark-unavailable", {
            detail: { date: eventDate, state: data.dateState || "SOLD_OUT" },
          })
        );
        setMessage(data.message || "Esa fecha no está disponible. Selecciona otra fecha.");
        focusNode(document.querySelector(".java-calendar-card"));
        return;
      }

      document.body.dataset.javaAvailabilityDate = eventDate;
      syncLegacyAvailabilityState();
      window.dispatchEvent(
        new CustomEvent("java:toast", {
          detail: { text: data.message || "Java Coffee Cart disponible para esta fecha.", tone: "success" },
        })
      );
      setMessage("");
      setStep(2);
    } catch (error) {
      const text = error?.message || "No fue posible verificar la disponibilidad.";
      setMessage(text);
      focusNode(targetForError(text) || document.querySelector(".java-calendar-card"));
    } finally {
      setCheckingAvailability(false);
    }
  }

  function handleContinue() {
    const result = validate(step);
    if (alertUser(result)) return;

    if (step === 1) {
      verifyAvailabilityAndContinue();
      return;
    }

    setStep((value) => Math.min(5, value + 1));
  }

  useEffect(() => {
    if (pathname !== "/") return;
    const panel = document.querySelector(".java-quote-wizard-panel");
    if (!panel || !open) return;
    const timer = setTimeout(() => panel.scrollTo({ top: 0, behavior: "smooth" }), 40);
    return () => clearTimeout(timer);
  }, [pathname, step, open]);

  useEffect(() => {
    if (pathname !== "/") return;
    let panel = null;
    let pageGrid = null;
    let formSection = null;
    let progressMount = null;
    let navMount = null;
    let backdrop = null;

    function sync() {
      pageGrid = document.querySelector("main.app-shell .page-grid");
      panel = pageGrid?.querySelector("section.panel");
      formSection = panel?.querySelector(".form-section");
      if (!pageGrid || !panel || !formSection) return;

      panel.classList.add("java-quote-wizard-panel");
      document.body.classList.toggle("java-quote-wizard-open", open);
      fixServiceCopy();

      const city = control("Ciudad del evento");
      const other = city
        ? Array.from(city.options || []).find((option) => option.value === "OTHER")
        : null;
      other?.remove();

      if (!progressMount?.isConnected) {
        progressMount = document.createElement("div");
        progressMount.className = "java-quote-wizard-progress-mount";
        panel.insertBefore(progressMount, panel.firstChild);
        setHeaderMount(progressMount);
      }

      if (!navMount?.isConnected) {
        navMount = document.createElement("div");
        navMount.className = "java-quote-wizard-footer-mount";
        panel.appendChild(navMount);
        setFooterMount(navMount);
      }

      if (!backdrop?.isConnected) {
        backdrop = document.createElement("div");
        backdrop.className = "java-quote-wizard-backdrop";
        document.body.appendChild(backdrop);
      }

      pageGrid.style.display = open ? "" : "none";
      panel.style.display = open ? "" : "none";
      backdrop.style.display = open ? "" : "none";
      applyStepVisibility(formSection, step);
    }

    const start = setTimeout(sync, 60);
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".java-quote-wizard-progress-mount")) sync();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(start);
      clearTimeout(timerRef.current);
      observer.disconnect();
      pageGrid?.style.removeProperty("display");
      panel?.classList.remove("java-quote-wizard-panel");
      panel?.style.removeProperty("display");
      progressMount?.remove();
      navMount?.remove();
      backdrop?.remove();
      document.body.classList.remove("java-quote-wizard-open");
    };
  }, [pathname, step, open]);

  useEffect(() => {
    if (pathname !== "/") return;

    function onValidation(event) {
      const text = event.detail?.message;
      if (!text) return;
      setMessage(text);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(""), 4200);
      focusNode(targetForError(text));
    }

    const interval = setInterval(() => {
      const error = document.querySelector("main.app-shell .status.error");
      const text = String(error?.textContent || "").trim();
      if (!text || text === lastErrorRef.current) return;
      lastErrorRef.current = text;
      setMessage(text);
      focusNode(targetForError(text));
    }, 650);

    window.addEventListener("java:validation", onValidation);
    return () => {
      clearInterval(interval);
      window.removeEventListener("java:validation", onValidation);
    };
  }, [pathname]);

  if (pathname !== "/") return null;
  const current = STEPS[step - 1];
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <>
      {headerMount &&
        createPortal(
          <div className="java-quote-wizard-chrome">
            <div className="java-quote-wizard-topline">
              <div>
                <small>COTIZACIÓN JAVA EVENTS</small>
                <strong>{current.title}</strong>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="java-quote-wizard-progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="java-quote-wizard-steps">
              {STEPS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`${item.id === step ? "active" : ""} ${
                    item.id < step ? "done" : ""
                  }`}
                  onClick={() => item.id < step && setStep(item.id)}
                >
                  <span>{item.id}</span>
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
            {message && <div className="java-quote-wizard-alert">{message}</div>}
          </div>,
          headerMount
        )}

      {footerMount &&
        createPortal(
          <div className="java-quote-wizard-footer">
            <button
              type="button"
              className="secondary"
              disabled={step === 1 || checkingAvailability}
              onClick={() => setStep((value) => Math.max(1, value - 1))}
            >
              ← Atrás
            </button>

            <div className="java-quote-wizard-footer-copy">
              <strong>Paso {step} de {STEPS.length}</strong>
              <span>
                {step === 1
                  ? "Continuar confirma la disponibilidad de la fecha en tiempo real."
                  : step === 5
                  ? "Revisa tus datos, acepta las condiciones y aparta la fecha con el anticipo."
                  : "Puedes volver a cualquier paso anterior antes de pagar."}
              </span>
            </div>

            {step < 5 && (
              <button
                type="button"
                className="primary"
                disabled={checkingAvailability}
                onClick={handleContinue}
              >
                {checkingAvailability ? "Confirmando fecha…" : "Continuar →"}
              </button>
            )}
          </div>,
          footerMount
        )}

      {!open &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            className="java-quote-wizard-launch"
            onClick={() => setOpen(true)}
          >
            Cotizar mi evento →
          </button>,
          document.body
        )}
    </>
  );
}
