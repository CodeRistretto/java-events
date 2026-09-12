"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  if (twentyFour) {
    return `${pad(Number(twentyFour[1]))}:${pad(Number(twentyFour[2]))}`;
  }

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
  if (tabs.length < 2) return;

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
    const looksLikeExtraHour =
      (text.includes("additional") && text.includes("hour")) ||
      (text.includes("hora") && text.includes("adicional"));

    if (looksLikeExtraHour) {
      const card = title.closest(".check-card");
      if (card) card.style.display = "none";
    }
  }
}

export default function EventDurationGuard() {
  const pathname = usePathname();
  const [config, setConfig] = useState({
    includedHours: 2,
    extraHourCents: 0,
    vatBps: 1600,
  });
  const [pending, setPending] = useState(null);

  const bypassRef = useRef(false);
  const startRef = useRef("16:00");
  const endRef = useRef("18:00");
  const lastQuotedSignatureRef = useRef(null);

  useEffect(() => {
    if (pathname !== "/") return;

    let cancelled = false;

    fetch("/api/event-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.success) return;

        const extra = (data.addOns || []).find(
          (item) => item.code === "ADDITIONAL_HOUR"
        );

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
    }, 120);

    const observer = new MutationObserver(() => {
      hideManualExtraHourCard();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    function openExtraHoursModal({ event, button, target, selectedTime, startTime, endTime }) {
      const startMinutes = minutesFromTime(startTime);
      const endMinutes = minutesFromTime(endTime);

      if (
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        return false;
      }

      const duration = (endMinutes - startMinutes) / 60;
      const extraHours = Math.max(
        0,
        Math.ceil(duration - config.includedHours - 0.000001)
      );

      if (extraHours <= 0) return false;

      event.preventDefault();
      event.stopPropagation();

      if (!config.extraHourCents) {
        setPending({
          unavailable: true,
          button,
          target,
          duration,
          extraHours,
          selectedTime,
          startTime,
          endTime,
        });
        return true;
      }

      const subtotalCents = extraHours * config.extraHourCents;
      const vatCents = Math.round((subtotalCents * config.vatBps) / 10000);

      setPending({
        unavailable: false,
        button,
        target,
        duration,
        extraHours,
        selectedTime,
        startTime,
        endTime,
        subtotalCents,
        vatCents,
        totalCents: subtotalCents + vatCents,
      });

      return true;
    }

    function handleScheduleClick(event) {
      const button = event.target.closest?.(".java-time-slots button");
      if (!button) return;

      if (bypassRef.current) {
        bypassRef.current = false;
        setTimeout(() => syncTimesFromDom(startRef, endRef), 0);
        return;
      }

      const tabs = Array.from(document.querySelectorAll(".java-time-tabs button"));
      const activeIndex = tabs.findIndex((tab) => tab.classList.contains("active"));
      const buttons = Array.from(button.parentElement?.querySelectorAll("button") || []);
      const slotIndex = buttons.indexOf(button);
      if (slotIndex < 0) return;

      syncTimesFromDom(startRef, endRef);

      const selectedMinutes = SLOT_START_MINUTES + slotIndex * SLOT_STEP_MINUTES;
      const selectedTime = timeFromMinutes(selectedMinutes);

      if (activeIndex === 0) {
        const currentEndMinutes = minutesFromTime(endRef.current);

        // If the selected start is after the old end, the React picker will
        // automatically move the end to +2h. That path never needs an extra fee.
        if (currentEndMinutes === null || currentEndMinutes <= selectedMinutes) {
          startRef.current = selectedTime;
          lastQuotedSignatureRef.current = null;
          setTimeout(() => syncTimesFromDom(startRef, endRef), 0);
          return;
        }

        const blocked = openExtraHoursModal({
          event,
          button,
          target: "start",
          selectedTime,
          startTime: selectedTime,
          endTime: endRef.current,
        });

        if (!blocked) {
          startRef.current = selectedTime;
          lastQuotedSignatureRef.current = null;
        }
        return;
      }

      if (activeIndex !== 1) return;

      const startMinutes = minutesFromTime(startRef.current);
      if (startMinutes === null || selectedMinutes <= startMinutes) return;

      const blocked = openExtraHoursModal({
        event,
        button,
        target: "end",
        selectedTime,
        startTime: startRef.current,
        endTime: selectedTime,
      });

      if (!blocked) {
        endRef.current = selectedTime;
        lastQuotedSignatureRef.current = null;
      }
    }

    document.addEventListener("click", handleScheduleClick, true);
    return () => document.removeEventListener("click", handleScheduleClick, true);
  }, [pathname, config]);

  useEffect(() => {
    if (pathname !== "/") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = init?.method?.toUpperCase() || "GET";

      if (url.includes("/api/quote") && method === "POST") {
        syncTimesFromDom(startRef, endRef);

        const start = minutesFromTime(startRef.current);
        const end = minutesFromTime(endRef.current);
        let quoteSignature = null;

        if (start !== null && end !== null && end > start) {
          quoteSignature = scheduleSignature(startRef.current, endRef.current);

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
        if (response.ok && quoteSignature) {
          lastQuotedSignatureRef.current = quoteSignature;
        }
        return response;
      }

      if (url.includes("/api/hold") && method === "POST") {
        syncTimesFromDom(startRef, endRef);
        const currentSignature = scheduleSignature(startRef.current, endRef.current);

        if (
          !currentSignature ||
          !lastQuotedSignatureRef.current ||
          currentSignature !== lastQuotedSignatureRef.current
        ) {
          return new Response(
            JSON.stringify({
              success: false,
              error:
                "El horario cambió después de la última cotización. Vuelve a presionar ‘Ver precio de mi evento’ para actualizar el total antes de apartar la fecha.",
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname]);

  if (!pending || typeof document === "undefined") return null;

  function close() {
    setPending(null);
  }

  function accept() {
    if (pending.unavailable || !pending.button) return;

    if (pending.target === "start") startRef.current = pending.selectedTime;
    else endRef.current = pending.selectedTime;

    lastQuotedSignatureRef.current = null;
    const button = pending.button;
    setPending(null);
    bypassRef.current = true;
    setTimeout(() => button.click(), 0);
  }

  return createPortal(
    <div className="java-hours-modal-backdrop" role="presentation" onMouseDown={close}>
      <div
        className="java-hours-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="java-hours-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="java-hours-icon">＋</div>
        <div className="java-hours-kicker">TIEMPO ADICIONAL</div>
        <h2 id="java-hours-title">
          {pending.unavailable
            ? "Este horario necesita una tarifa adicional"
            : `${pending.duration} horas de servicio`}
        </h2>

        {pending.unavailable ? (
          <p>
            El servicio base incluye {config.includedHours} horas. No hay una tarifa
            activa para horas adicionales, por lo que no podemos confirmar este
            horario todavía.
          </p>
        ) : (
          <>
            <p>
              Tu servicio incluye <strong>{config.includedHours} horas</strong>. El
              horario que elegiste requiere <strong>{pending.extraHours} hora(s)
              adicional(es)</strong>. Cada hora adicional o fracción se cobra aparte.
            </p>

            <div className="java-hours-price-card">
              <div>
                <span>Hora adicional</span>
                <strong>{moneyFromCents(config.extraHourCents)} + IVA</strong>
              </div>
              <div>
                <span>{pending.extraHours} hora(s) adicional(es)</span>
                <strong>{moneyFromCents(pending.subtotalCents)} + IVA</strong>
              </div>
              <div className="total">
                <span>Total adicional con IVA</span>
                <strong>{moneyFromCents(pending.totalCents)}</strong>
              </div>
            </div>

            <div className="java-hours-notice">
              Al aceptar cambia el horario. Antes de apartar la fecha tendrás que
              recalcular la cotización para que el total muestre correctamente las
              horas adicionales.
            </div>
          </>
        )}

        <div className="java-hours-actions">
          <button type="button" className="secondary" onClick={close}>
            {pending.unavailable ? "Cerrar" : `No, máximo ${config.includedHours} horas`}
          </button>

          {!pending.unavailable && (
            <button type="button" className="primary" onClick={accept}>
              Sí, quiero más horas · {moneyFromCents(pending.totalCents)}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
