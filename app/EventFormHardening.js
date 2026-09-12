"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function fieldByLabel(text) {
  const wanted = text.toLowerCase();
  return Array.from(document.querySelectorAll("main.app-shell .field")).find((field) => {
    const label = field.querySelector("label")?.textContent?.trim().toLowerCase() || "";
    return label === wanted || label.includes(wanted);
  });
}

function setControlledValue(element, value) {
  if (!element || String(element.value) === String(value)) return;
  const prototype =
    element.tagName === "SELECT"
      ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setupIso(eventDate, startTime, hoursBefore) {
  if (!eventDate || !startTime) return null;
  const local = new Date(`${eventDate}T${startTime}:00`);
  if (Number.isNaN(local.getTime())) return null;
  local.setHours(local.getHours() - Number(hoursBefore));
  return local.toISOString();
}

export default function EventFormHardening() {
  const pathname = usePathname();
  const [mount, setMount] = useState(null);
  const [setupMount, setSetupMount] = useState(null);
  const [setupChoice, setSetupChoice] = useState("");
  const [settings, setSettings] = useState({
    length: 320,
    width: 150,
    passage: 100,
    version: "2026-09-11",
  });
  const [passage, setPassage] = useState("");
  const [electricityDistance, setElectricityDistance] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const setupNativeRef = useRef(null);
  const values = useRef({
    passage: "",
    electricityDistance: "",
    confirmed: false,
    setupChoice: "",
  });

  useEffect(() => {
    values.current = { passage, electricityDistance, confirmed, setupChoice };
  }, [passage, electricityDistance, confirmed, setupChoice]);

  useEffect(() => {
    if (!setupNativeRef.current) return;
    setControlledValue(
      setupNativeRef.current,
      setupChoice ? "2000-01-01T00:00" : ""
    );
  }, [setupChoice, setupMount]);

  useEffect(() => {
    if (pathname !== "/") return;
    fetch("/api/event-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.success) return;
        setSettings({
          length: Number(data.settings?.cart_operating_length_cm ?? 320),
          width: Number(data.settings?.cart_operating_width_cm ?? 150),
          passage: Number(data.settings?.minimum_passage_width_cm ?? 100),
          version: String(data.settings?.service_terms_version || "2026-09-11"),
        });
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    let requirementsNode = null;
    let setupNode = null;

    function apply() {
      const indoor = fieldByLabel("¿El Coffee Cart estará en interior o exterior?");
      const water = fieldByLabel("¿Hay agua potable disponible?");
      const waterDistance = fieldByLabel("Distancia aproximada al punto de agua");
      const electricity =
        fieldByLabel("Electricidad disponible") ||
        fieldByLabel("Conexión eléctrica disponible");
      const setupField =
        fieldByLabel("¿Desde qué hora podemos entrar a montar?") ||
        fieldByLabel("Horario de montaje");

      if (water) {
        water.style.display = "none";
        setControlledValue(water.querySelector("select"), "yes");
      }
      if (waterDistance) {
        waterDistance.style.display = "none";
        setControlledValue(waterDistance.querySelector("input"), "0");
      }

      const indoorSelect = indoor?.querySelector("select");
      if (indoorSelect) {
        const both = Array.from(indoorSelect.options).find((option) => option.value === "BOTH");
        if (both) both.remove();
        if (indoorSelect.value === "BOTH") setControlledValue(indoorSelect, "");
      }

      if (electricity) {
        const label = electricity.querySelector("label");
        const input = electricity.querySelector("input");
        if (label && label.textContent !== "Conexión eléctrica disponible") {
          label.textContent = "Conexión eléctrica disponible";
        }
        if (input && input.placeholder !== "Ej. contacto 127 V cercano al Coffee Cart") {
          input.placeholder = "Ej. contacto 127 V cercano al Coffee Cart";
        }
      }

      if (setupField) {
        const label = setupField.querySelector("label");
        const native = setupField.querySelector("input[type='datetime-local']");
        if (label && label.textContent !== "Horario de montaje") label.textContent = "Horario de montaje";
        if (native) {
          setupNativeRef.current = native;
          native.style.display = "none";
        }
        let existingSetup = setupField.querySelector(".java-setup-select-mount");
        if (!existingSetup) {
          existingSetup = document.createElement("div");
          existingSetup.className = "java-setup-select-mount";
          setupField.appendChild(existingSetup);
          setupNode = existingSetup;
        }
        setSetupMount((current) => current || existingSetup);
      }

      const grid = indoor?.parentElement;
      if (!grid) return;
      let existing = document.querySelector(".java-event-requirements-mount");
      if (!existing) {
        existing = document.createElement("div");
        existing.className = "java-event-requirements-mount";
        grid.insertBefore(existing, grid.firstChild);
        requirementsNode = existing;
      }
      setMount((current) => current || existing);
    }

    const timer = setTimeout(apply, 100);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      requirementsNode?.remove();
      setupNode?.remove();
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/api/hold") && init?.method?.toUpperCase() === "POST") {
        const p = Number(values.current.passage);
        const d = Number(values.current.electricityDistance);
        const setup = values.current.setupChoice;

        if (!values.current.confirmed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Confirma que el lugar cumple con el espacio y acceso mínimo requerido.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (!Number.isFinite(p) || p < settings.passage) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `El recorrido necesita al menos ${settings.passage} cm libres en puertas, pasillos y elevador.`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (!Number.isFinite(d) || d < 0) {
          return new Response(
            JSON.stringify({ success: false, error: "Indica la distancia a la conexión eléctrica." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (!setup) {
          return new Response(
            JSON.stringify({ success: false, error: "Selecciona el horario de montaje." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (typeof init.body === "string") {
          try {
            const body = JSON.parse(init.body);
            const flexible = setup === "FLEXIBLE";
            const hoursBefore = flexible ? 3 : Number(setup);
            const computedSetup = setupIso(body.eventDate, body.startTime, hoursBefore);

            if (!computedSetup) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "No pudimos calcular el horario de montaje. Revisa fecha y hora del evento.",
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }

            body.setupAccessTime = computedSetup;
            body.setupAccessFlexible = flexible;
            body.minimumPassageWidthCm = p;
            body.electricityDistanceM = d;
            body.accessRequirementsAccepted = true;
            body.serviceTermsVersion = settings.version;
            body.potableWater = true;
            body.waterDistanceM = 0;
            body.marketingConsent =
              sessionStorage.getItem("java-events-followup-consent") === "1";

            if (flexible) {
              const note =
                "Montaje flexible: Java confirmará con previo aviso la hora exacta dentro de las 3 horas anteriores al evento.";
              body.notes = [String(body.notes || "").trim(), note].filter(Boolean).join("\n");
            }

            init = { ...init, body: JSON.stringify(body) };
          } catch {}
        }
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname, settings.passage, settings.version]);

  return (
    <>
      {setupMount &&
        createPortal(
          <div className="java-setup-select-wrap">
            <select
              className="select"
              data-java-setup-select
              value={setupChoice}
              onChange={(event) => setSetupChoice(event.target.value)}
            >
              <option value="">Selecciona una opción</option>
              <option value="3">3 horas antes del evento</option>
              <option value="2">2 horas antes del evento</option>
              <option value="1">1 hora antes del evento</option>
              <option value="FLEXIBLE">A disponibilidad de Java, con previo aviso</option>
            </select>
            <small className="caption">
              El montaje sólo puede programarse dentro de las 3 horas anteriores al inicio
              del evento. Si eliges disponibilidad de Java, confirmaremos la hora exacta con
              previo aviso.
            </small>
          </div>,
          setupMount
        )}

      {mount &&
        createPortal(
          <div className="java-event-requirements">
            <div className="java-event-requirements-head">
              <div>
                <div className="java-event-requirements-kicker">ESPACIO Y ACCESO DEL EQUIPO</div>
                <h4>Confirma que el Coffee Cart puede entrar y operar.</h4>
              </div>
              <div className="java-event-size-badge">
                <strong>{settings.length} × {settings.width} cm</strong>
                <span>área mínima</span>
              </div>
            </div>

            <div className="java-event-requirements-grid">
              <div>
                <span>Operación</span>
                <strong>{settings.length} × {settings.width} cm libres</strong>
                <p>Superficie firme y estable durante todo el servicio.</p>
              </div>
              <div>
                <span>Acceso</span>
                <strong>Mínimo {settings.passage} cm libres</strong>
                <p>Puertas, pasillos y entrada del elevador.</p>
              </div>
              <div>
                <span>Agua</span>
                <strong>Java lleva su agua potable</strong>
                <p>No necesitas proporcionar una toma de agua potable.</p>
              </div>
              <div>
                <span>Electricidad</span>
                <strong>Indica la distancia</strong>
                <p>Necesitamos conocer qué tan lejos está el contacto disponible.</p>
              </div>
            </div>

            <div className="java-event-measurements">
              <label>
                <span>Punto más angosto del recorrido (cm)</span>
                <input
                  type="number"
                  min={settings.passage}
                  value={passage}
                  onChange={(e) => setPassage(e.target.value)}
                  placeholder={`Mínimo ${settings.passage}`}
                />
                <small>Considera puertas, pasillos y elevador.</small>
              </label>
              <label>
                <span>Distancia a la conexión eléctrica (m)</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={electricityDistance}
                  onChange={(e) => setElectricityDistance(e.target.value)}
                  placeholder="Ej. 4"
                />
                <small>Desde el área del Coffee Cart hasta el contacto.</small>
              </label>
            </div>

            <label className="java-event-access-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                Confirmo que el lugar cuenta con un área de al menos {settings.length} × {settings.width} cm
                y un recorrido mínimo de {settings.passage} cm libres para introducir el equipo.
              </span>
            </label>
          </div>,
          mount
        )}
    </>
  );
}
