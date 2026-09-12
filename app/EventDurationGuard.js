"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SLOT_START_MINUTES = 6 * 60;
const SLOT_STEP_MINUTES = 30;

function pad(value) {
  return String(value).padStart(2, "0");
}

function timeFromMinutes(total) {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function minutesFromTime(value) {
  if (!value) return null;
  const [hour, minute] = String(value).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseDisplayedTime(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  const normalized = text.replaceAll(".", "").replaceAll(" ", "");
  const match = normalized.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (match[3] === "pm" && hour !== 12) hour += 12;
    if (match[3] === "am" && hour === 12) hour = 0;
    return `${pad(hour)}:${pad(minute)}`;
  }
  const twentyFour = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) return `${pad(Number(twentyFour[1]))}:${pad(Number(twentyFour[2]))}`;
  return null;
}

function moneyFromCents(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(cents || 0) / 100);
}

function syncTimesFromDom(startRef, endRef) {
  const tabs = document.querySelectorAll(".java-time-tabs button strong");
  const start = parseDisplayedTime(tabs[0]?.textContent);
  const end = parseDisplayedTime(tabs[1]?.textContent);
  if (start) startRef.current = start;
  if (end) endRef.current = end;
}

function scheduleSignature(start, end) {
  return start && end ? `${start}|${end}` : null;
}

function hideManualExtraHourCard() {
  const titles = Array.from(document.querySelectorAll(".check-title"));
  for (const title of titles) {
    const text = String(title.textContent || "").trim().toLowerCase();
    const extra =
      (text.includes("additional") && text.includes("hour")) ||
      (text.includes("hora") && text.includes("adicional"));
    if (extra) {
      const card = title.closest(".check-card");
      if (card) card.style.display = "none";
    }
  }
}

function setSequenceState(startChosen, endChosen) {
  document.body.dataset.javaStartChosen = startChosen ? "1" : "0";
  document.body.dataset.javaEndChosen = endChosen ? "1" : "0";
  const tabs = document.querySelectorAll(".java-time-tabs button");
  const endTab = tabs[1];
  if (endTab) {
    endTab.disabled = !startChosen;
    endTab.classList.toggle("java-time-locked", !startChosen);
    endTab.setAttribute(
      "aria-label",
      startChosen ? "Seleccionar hora de término" : "Primero selecciona la hora de inicio"
    );
  }
}

function notify(message) {
  window.dispatchEvent(new CustomEvent("java:validation", { detail: { message } }));
}

export default function EventDurationGuard() {
  const pathname = usePathname();
  const [config, setConfig] = useState({ includedHours: 2, extraHourCents: 0, vatBps: 1600 });
  const [pending, setPending] = useState(null);

  const bypassRef = useRef(false);
  const startRef = useRef("16:00");
  const endRef = useRef("18:00");
  const startChosenRef = useRef(false);
  const endChosenRef = useRef(false);
  const lastQuotedSignatureRef = useRef(null);

  useEffect(() => {
    if (pathname !== "/") return;
    let cancelled = false;

    setSequenceState(false, false);

    fetch("/api/event-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        const extra = (data.addOns || []).find((item) => item.code === "ADDITIONAL_HOUR");
        setConfig({
          includedHours: Number(data.settings?.standard_duration_hours || 2),
          extraHourCents: Number(extra?.unit_price_cents || 0),
          vatBps: Number(data.settings?.vat_bps || 0),
        });
      })
      .catch(() => {});

    const timer = setTimeout(() => {
      syncTimesFromDom(startRef, endRef);
      hideManualExtraHourCard();
      setSequenceState(startChosenRef.current, endChosenRef.current);
    }, 120);

    const observer = new MutationObserver(() => {
      hideManualExtraHourCard();
      setSequenceState(startChosenRef.current, endChosenRef.current);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
      delete document.body.dataset.javaStartChosen;
      delete document.body.dataset.javaEndChosen;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    function handleCalendarClick(event) {
      const dateButton = event.target.closest?.(".java-calendar-days button");
      if (!dateButton || dateButton.disabled) return;
      startChosenRef.current = false;
      endChosenRef.current = false;
      lastQuotedSignatureRef.current = null;
      setSequenceState(false, false);
    }

    function handleTabClick(event) {
      const tab = event.target.closest?.(".java-time-tabs button");
      if (!tab) return;
      const tabs = Array.from(document.querySelectorAll(".java-time-tabs button"));
      if (tabs.indexOf(tab) === 1 && !startChosenRef.current) {
        event.preventDefault();
        event.stopPropagation();
        notify("Primero selecciona la hora de inicio; después podrás elegir el término.");
      }
    }

    function handleSlotClick(event) {
      const slotButton = event.target.closest?.(".java-time-slots button");
      if (!slotButton) return;

      if (bypassRef.current) {
        bypassRef.current = false;
        return;
      }

      const tabs = Array.from(document.querySelectorAll(".java-time-tabs button"));
      const activeIndex = tabs.findIndex((tab) => tab.classList.contains("active"));
      const slotButtons = Array.from(slotButton.parentElement?.querySelectorAll("button") || []);
      const slotIndex = slotButtons.indexOf(slotButton);
      if (slotIndex < 0) return;

      const selectedMinutes = SLOT_START_MINUTES + slotIndex * SLOT_STEP_MINUTES;
      const selectedTime = timeFromMinutes(selectedMinutes);

      if (activeIndex === 0) {
        if (selectedMinutes + config.includedHours * 60 > 23 * 60 + 30) {
          event.preventDefault();
          event.stopPropagation();
          notify(`La hora de inicio debe permitir al menos ${config.includedHours} horas de servicio antes de las 11:30 p.m.`);
          return;
        }

        startChosenRef.current = true;
        endChosenRef.current = false;
        startRef.current = selectedTime;
        lastQuotedSignatureRef.current = null;
        setSequenceState(true, false);

        setTimeout(() => {
          const targetMinutes = selectedMinutes + config.includedHours * 60;
          const index = Math.round((targetMinutes - SLOT_START_MINUTES) / SLOT_STEP_MINUTES);
          const buttons = Array.from(document.querySelectorAll(".java-time-slots button"));
          const target = buttons[index];
          if (target && !target.disabled) {
            bypassRef.current = true;
            target.click();
            endRef.current = timeFromMinutes(targetMinutes);
            endChosenRef.current = false;
            setSequenceState(true, false);
          }
        }, 30);
        return;
      }

      if (activeIndex !== 1) return;
      if (!startChosenRef.current) {
        event.preventDefault();
        event.stopPropagation();
        notify("Primero selecciona la hora de inicio.");
        return;
      }

      syncTimesFromDom(startRef, endRef);
      const startMinutes = minutesFromTime(startRef.current);
      if (startMinutes === null || selectedMinutes <= startMinutes) return;

      const duration = (selectedMinutes - startMinutes) / 60;
      const extraHours = Math.max(0, Math.ceil(duration - config.includedHours - 0.000001));

      if (extraHours <= 0) {
        endChosenRef.current = true;
        endRef.current = selectedTime;
        lastQuotedSignatureRef.current = null;
        setSequenceState(true, true);
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!config.extraHourCents) {
        setPending({ unavailable: true, button: slotButton, selectedTime, duration, extraHours });
        return;
      }

      const subtotalCents = extraHours * config.extraHourCents;
      const vatCents = Math.round((subtotalCents * config.vatBps) / 10000);
      setPending({
        unavailable: false,
        button: slotButton,
        selectedTime,
        duration,
        extraHours,
        subtotalCents,
        vatCents,
        totalCents: subtotalCents + vatCents,
      });
    }

    document.addEventListener("click", handleCalendarClick, true);
    document.addEventListener("click", handleTabClick, true);
    document.addEventListener("click", handleSlotClick, true);
    return () => {
      document.removeEventListener("click", handleCalendarClick, true);
      document.removeEventListener("click", handleTabClick, true);
      document.removeEventListener("click", handleSlotClick, true);
    };
  }, [pathname, config]);

  useEffect(() => {
    if (pathname !== "/") return;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = init?.method?.toUpperCase() || "GET";

      if (url.includes("/api/quote") && method === "POST") {
        if (!startChosenRef.current || !endChosenRef.current) {
          return new Response(
            JSON.stringify({ success: false, error: "Selecciona primero la hora de inicio y después la hora de término." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        syncTimesFromDom(startRef, endRef);
        const start = minutesFromTime(startRef.current);
        const end = minutesFromTime(endRef.current);
        let signature = null;
        if (start !== null && end !== null && end > start) {
          signature = scheduleSignature(startRef.current, endRef.current);
          if (typeof init.body === "string") {
            try {
              const body = JSON.parse(init.body);
              body.startTime = startRef.current;
              body.endTime = endRef.current;
              body.durationHours = (end - start) / 60;
              init = { ...init, body: JSON.stringify(body) };
            } catch {}
          }
        }

        const response = await originalFetch(input, init);
        if (response.ok && signature) lastQuotedSignatureRef.current = signature;
        return response;
      }

      if (url.includes("/api/hold") && method === "POST") {
        syncTimesFromDom(startRef, endRef);
        const current = scheduleSignature(startRef.current, endRef.current);
        if (!startChosenRef.current || !endChosenRef.current) {
          return new Response(
            JSON.stringify({ success: false, error: "Selecciona primero la hora de inicio y después la hora de término." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (!current || !lastQuotedSignatureRef.current || current !== lastQuotedSignatureRef.current) {
          return new Response(
            JSON.stringify({ success: false, error: "El horario cambió después de la cotización. Vuelve a calcular el precio antes de apartar la fecha." }),
            { status: 409, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  function close() {
    setPending(null);
  }

  function accept() {
    if (!pending || pending.unavailable || !pending.button) return;
    endChosenRef.current = true;
    endRef.current = pending.selectedTime;
    lastQuotedSignatureRef.current = null;
    setSequenceState(true, true);
    const target = pending.button;
    setPending(null);
    bypassRef.current = true;
    setTimeout(() => target.click(), 0);
  }

  if (!pending || typeof document === "undefined") return null;

  return createPortal(
    <div className="java-hours-modal-backdrop" role="presentation" onMouseDown={close}>
      <div className="java-hours-modal" role="dialog" aria-modal="true" aria-labelledby="java-hours-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="java-hours-icon">＋</div>
        <div className="java-hours-kicker">TIEMPO ADICIONAL</div>
        <h2 id="java-hours-title">{pending.unavailable ? "Este horario necesita una tarifa adicional" : `${pending.duration} horas de servicio`}</h2>

        {pending.unavailable ? (
          <p>El servicio base incluye {config.includedHours} horas. No hay una tarifa activa para horas adicionales, por lo que no podemos confirmar este horario todavía.</p>
        ) : (
          <>
            <p>Tu servicio incluye <strong>{config.includedHours} horas</strong>. El horario elegido requiere <strong>{pending.extraHours} hora(s) adicional(es)</strong>. Cada hora adicional o fracción se cobra aparte.</p>
            <div className="java-hours-price-card">
              <div><span>Hora adicional</span><strong>{moneyFromCents(config.extraHourCents)} + IVA</strong></div>
              <div><span>{pending.extraHours} hora(s) adicional(es)</span><strong>{moneyFromCents(pending.subtotalCents)} + IVA</strong></div>
              <div className="total"><span>Total adicional con IVA</span><strong>{moneyFromCents(pending.totalCents)}</strong></div>
            </div>
            <div className="java-hours-notice">Al aceptar, este horario quedará seleccionado. Antes de apartar la fecha el total será validado nuevamente.</div>
          </>
        )}

        <div className="java-hours-actions">
          <button type="button" className="secondary" onClick={close}>{pending.unavailable ? "Cerrar" : `No, máximo ${config.includedHours} horas`}</button>
          {!pending.unavailable && <button type="button" className="primary" onClick={accept}>Sí, quiero más horas · {moneyFromCents(pending.totalCents)}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
