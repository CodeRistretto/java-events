"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function citySelect() {
  return Array.from(document.querySelectorAll("main.app-shell .field")).find((field) =>
    /ciudad del evento/i.test(field.querySelector("label")?.textContent || "")
  )?.querySelector("select") || null;
}

function visibleMonth() {
  const text = normalize(document.querySelector(".java-calendar-toolbar strong")?.textContent);
  const year = Number(text.match(/20\d{2}/)?.[0]);
  const monthIndex = MONTHS.findIndex((month) => text.includes(normalize(month)));
  if (!year || monthIndex < 0) return null;
  return new Date(year, monthIndex, 1, 12, 0, 0);
}

function gridDates(month) {
  if (!month) return [];
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function hideLegacyAvailabilityButton() {
  const verify = Array.from(document.querySelectorAll("main.app-shell button")).find((button) =>
    /verificar disponibilidad|revisando fecha/i.test(button.textContent || "")
  );
  if (!verify) return;
  const row = verify.closest(".action-row");
  if (row) row.style.display = "none";
  verify.tabIndex = -1;
  verify.setAttribute("aria-hidden", "true");
}

function ensureLegend(card) {
  if (!card || card.querySelector(".java-calendar-availability-legend")) return;
  const legend = document.createElement("div");
  legend.className = "java-calendar-availability-legend";
  legend.innerHTML = `
    <span><i class="available"></i>Disponible</span>
    <span><i class="busy"></i>Ocupado</span>
    <span><i class="restricted"></i>No reservable</span>
  `;
  const weekdays = card.querySelector(".java-calendar-weekdays");
  weekdays?.insertAdjacentElement("beforebegin", legend);
}

function applyDates(dateStates) {
  const month = visibleMonth();
  const buttons = Array.from(document.querySelectorAll(".java-calendar-days button"));
  if (!month || !buttons.length) return;

  const dates = gridDates(month);
  buttons.forEach((button, index) => {
    const date = dates[index];
    if (!date) return;
    const value = isoDate(date);
    button.dataset.javaDate = value;

    const state = dateStates.get(value);
    const unavailable = state && state.available === false;

    if (unavailable) {
      button.dataset.javaAvailabilityDisabled = "1";
      button.dataset.javaAvailabilityState = state.state || "SOLD_OUT";
      button.classList.add("java-date-unavailable");
      button.disabled = true;
      button.title = state.state === "TEMPORARILY_HELD"
        ? "Fecha temporalmente apartada"
        : "Fecha ocupada";
    } else if (button.dataset.javaAvailabilityDisabled === "1") {
      delete button.dataset.javaAvailabilityDisabled;
      delete button.dataset.javaAvailabilityState;
      button.classList.remove("java-date-unavailable");
      if (button.dataset.javaLeadDisabled !== "1") {
        button.disabled = false;
        button.removeAttribute("title");
      }
    }
  });
}

export default function CalendarAvailabilityEnhancer() {
  const pathname = usePathname();
  const statesRef = useRef(new Map());
  const requestRef = useRef(0);
  const signatureRef = useRef("");

  useEffect(() => {
    if (pathname !== "/") return;

    let stopped = false;

    async function refresh(force = false) {
      if (stopped) return;
      hideLegacyAvailabilityButton();

      const select = citySelect();
      const month = visibleMonth();
      const card = document.querySelector(".java-calendar-card");
      ensureLegend(card);
      if (!select?.value || !month || !card) return;

      const dates = gridDates(month);
      const from = isoDate(dates[0]);
      const to = isoDate(dates[dates.length - 1]);
      const signature = `${select.value}|${from}|${to}`;

      if (!force && signature === signatureRef.current) {
        applyDates(statesRef.current);
        return;
      }

      signatureRef.current = signature;
      const requestId = ++requestRef.current;
      card.classList.add("java-calendar-loading");

      try {
        const params = new URLSearchParams({ serviceAreaId: select.value, from, to });
        const response = await fetch(`/api/availability/calendar?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (stopped || requestId !== requestRef.current) return;
        if (!response.ok || !data?.success) throw new Error(data?.error || "No fue posible cargar las fechas.");

        statesRef.current = new Map((data.dates || []).map((item) => [item.date, item]));
        applyDates(statesRef.current);
        card.classList.remove("java-calendar-availability-error");
      } catch {
        if (stopped || requestId !== requestRef.current) return;
        card.classList.add("java-calendar-availability-error");
        window.dispatchEvent(
          new CustomEvent("java:toast", {
            detail: {
              text: "No pudimos precargar todas las fechas ocupadas. La disponibilidad se confirmará al continuar.",
              tone: "warning",
            },
          })
        );
      } finally {
        if (!stopped && requestId === requestRef.current) {
          card.classList.remove("java-calendar-loading");
        }
      }
    }

    function markUnavailable(event) {
      const date = event.detail?.date;
      if (!date) return;
      statesRef.current.set(date, {
        date,
        available: false,
        availableCount: 0,
        state: event.detail?.state || "SOLD_OUT",
      });
      applyDates(statesRef.current);
    }

    function refreshCalendar() {
      signatureRef.current = "";
      refresh(true);
    }

    const initial = window.setTimeout(() => refresh(true), 120);
    const interval = window.setInterval(() => refresh(false), 450);
    window.addEventListener("java:calendar-mark-unavailable", markUnavailable);
    window.addEventListener("java:calendar-refresh", refreshCalendar);

    return () => {
      stopped = true;
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("java:calendar-mark-unavailable", markUnavailable);
      window.removeEventListener("java:calendar-refresh", refreshCalendar);
      document.querySelectorAll(".java-date-unavailable").forEach((button) => {
        button.classList.remove("java-date-unavailable");
        delete button.dataset.javaAvailabilityDisabled;
        delete button.dataset.javaAvailabilityState;
        if (button.dataset.javaLeadDisabled !== "1") button.disabled = false;
      });
    };
  }, [pathname]);

  return null;
}
