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

function hideManualExtraHourCard() {
  const titles = Array.from(document.querySelectorAll(".check-title"));

  for (const title of titles) {
    const text = String(title.textContent || "").trim().toLowerCase();
    if (
      text === "additional hour" ||
      text === "hora adicional" ||
      text === "horas adicionales"
    ) {
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

      const selectedMinutes = SLOT_START_MINUTES + slotIndex * SLOT_STEP_MINUTES;
      const selectedTime = timeFromMinutes(selectedMinutes);

      if (activeIndex === 0) {
        startRef.current = selectedTime;
        setTimeout(() => syncTimesFromDom(startRef, endRef), 0);
        return;
      }

      if (activeIndex !== 1) return;

      syncTimesFromDom(startRef, endRef);
      const startMinutes = minutesFromTime(startRef.current);
      if (startMinutes === null || selectedMinutes <= startMinutes) return;

      const duration = (selectedMinutes - startMinutes) / 60;
      const extraHours = Math.max(
        0,
        Math.ceil(duration - config.includedHours - 0.000001)
      );

      if (extraHours <= 0) {
        endRef.current = selectedTime;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!config.extraHourCents) {
        setPending({
          unavailable: true,
          button,
          duration,
          extraHours,
          selectedTime,
        });
        return;
      }

      const subtotalCents = extraHours * config.extraHourCents;
      const vatCents = Math.round((subtotalCents * config.vatBps) / 10000);

      setPending({
        unavailable: false,
        button,
        duration,
        extraHours,
        selectedTime,
        subtotalCents,
        vatCents,
        totalCents: subtotalCents + vatCents,
      });
    }

    document.addEventListener("click", handleScheduleClick, true);
    return () => document.removeEventListener("click", handleScheduleClick, true);
  }, [pathname, config]);

  useEffect(() => {
    if (pathname !== "/") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";

      if (url.includes("/api/quote") && init?.method?.toUpperCase() === "POST") {
        syncTimesFromDom(startRef, endRef);

        if (typeof init.body === "string") {
          try {
            const body = JSON.parse(init.body);
            const start = minutesFromTime(startRef.current);
            const end = minutesFromTime(endRef.current);

            if (start !== null && end !== null && end > start) {
              body.startTime = startRef.current;
              body.endTime = endRef.current;
              body.durationHours = (end - start) / 60;
              init = { ...init, body: JSON.stringify(body) };
            }
          } catch {}
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
    endRef.current = pending.selectedTime;
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
              Si continúas, este cargo se agregará automáticamente a la cotización
              y también será validado nuevamente antes de crear la reserva.
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
