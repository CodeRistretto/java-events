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

function availabilityReady() {
  return Array.from(document.querySelectorAll("main.app-shell .status.success")).some((node) =>
    /disponible/i.test(node.textContent || "")
  );
}

function validate(step) {
  if (step === 1) {
    const city = control("Ciudad del evento");
    if (!hasValue(city)) return ["Selecciona la ciudad del evento.", city];

    const date = document.querySelector(".java-datetime-summary > span")?.textContent || "";
    if (!date || /selecciona una fecha/i.test(date)) {
      return ["Selecciona la fecha del evento.", document.querySelector(".java-calendar-card")];
    }
    if (document.body.dataset.javaStartChosen !== "1") {
      return ["Selecciona primero la hora de inicio.", document.querySelector(".java-time-tabs button:first-child")];
    }
    if (document.body.dataset.javaEndChosen !== "1") {
      return ["Ahora selecciona la hora de término.", document.querySelector(".java-time-tabs button:nth-child(2)")];
    }
    if (!availabilityReady()) {
      return ["Verifica la disponibilidad de la fecha antes de continuar.", button(/verificar disponibilidad/i)];
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
    if (!pinReady()) return ["Coloca el pin en la ubicación exacta del evento.", document.querySelector(".java-location-picker")];
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
    if (!hasValue(measures?.[0])) return ["Indica el punto más angosto del recorrido.", measures?.[0]];
    if (!hasValue(measures?.[1])) return ["Indica la distancia a la conexión eléctrica.", measures?.[1]];
    const accepted = document.querySelector(".java-event-access-check input[type='checkbox']");
    if (!accepted?.checked) return ["Confirma que el lugar cumple con el espacio y acceso mínimos.", accepted];
  }

  if (step === 4 && !quoteReady()) {
    return ["Calcula el precio del evento antes de continuar.", button(/ver precio de mi evento|calcular precio del evento/i)];
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

export default function QuoteFlowWizard() {
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(true);
  const [mount, setMount] = useState(null);
  const [message, setMessage] = useState("");
  const timerRef = useRef(null);

  function alertUser(result) {
    if (!result) return false;
    const [text, target] = result;
    setMessage(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(""), 4200);
    focusNode(target);
    return true;
  }

  useEffect(() => {
    if (pathname !== "/") return;
    let panel = null;
    let formSection = null;
    let progressMount = null;
    let backdrop = null;

    function sync() {
      panel = document.querySelector("main.app-shell .page-grid > section.panel");
      formSection = panel?.querySelector(".form-section");
      if (!panel || !formSection) return;

      panel.classList.add("java-quote-wizard-panel");
      document.body.classList.toggle("java-quote-wizard-open", open);

      const city = control("Ciudad del evento");
      const other = city ? Array.from(city.options || []).find((option) => option.value === "OTHER") : null;
      other?.remove();

      if (!progressMount?.isConnected) {
        progressMount = document.createElement("div");
        progressMount.className = "java-quote-wizard-progress-mount";
        panel.insertBefore(progressMount, panel.firstChild);
        setMount(progressMount);
      }
      if (!backdrop?.isConnected) {
        backdrop = document.createElement("div");
        backdrop.className = "java-quote-wizard-backdrop";
        document.body.appendChild(backdrop);
      }

      panel.style.display = open ? "" : "none";
      backdrop.style.display = open ? "" : "none";
      applyStepVisibility(formSection, step);
    }

    const start = setTimeout(sync, 80);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(start);
      clearTimeout(timerRef.current);
      observer.disconnect();
      panel?.classList.remove("java-quote-wizard-panel");
      panel?.style.removeProperty("display");
      progressMount?.remove();
      backdrop?.remove();
      document.body.classList.remove("java-quote-wizard-open");
    };
  }, [pathname, step, open]);

  useEffect(() => {
    if (pathname !== "/") return;
    const interval = setInterval(() => {
      const error = document.querySelector("main.app-shell .status.error");
      if (!error || !String(error.textContent || "").trim()) return;
      const text = String(error.textContent || "").trim();
      if (text === message) return;
      setMessage(text);
    }, 650);
    return () => clearInterval(interval);
  }, [pathname, message]);

  if (pathname !== "/") return null;
  const current = STEPS[step - 1];
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <>
      {mount && createPortal(
        <div className="java-quote-wizard-chrome">
          <div className="java-quote-wizard-topline">
            <div><small>COTIZACIÓN JAVA EVENTS</small><strong>{current.title}</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
          </div>
          <div className="java-quote-wizard-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="java-quote-wizard-steps">
            {STEPS.map((item) => (
              <button type="button" key={item.id} className={`${item.id === step ? "active" : ""} ${item.id < step ? "done" : ""}`} onClick={() => item.id < step && setStep(item.id)}>
                <span>{item.id}</span><small>{item.label}</small>
              </button>
            ))}
          </div>
          {message && <div className="java-quote-wizard-alert">{message}</div>}
          <div className="java-quote-wizard-nav">
            <button type="button" className="secondary" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}>← Atrás</button>
            {step < 5 && <button type="button" className="primary" onClick={() => { if (alertUser(validate(step))) return; setStep((value) => Math.min(5, value + 1)); }}>Continuar →</button>}
          </div>
        </div>,
        mount
      )}
      {!open && typeof document !== "undefined" && createPortal(
        <button type="button" className="java-quote-wizard-launch" onClick={() => setOpen(true)}>Cotizar mi evento →</button>,
        document.body
      )}
    </>
  );
}
