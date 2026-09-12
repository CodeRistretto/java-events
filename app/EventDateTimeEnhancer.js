"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIso(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function minutesFromTime(value) {
  if (!value) return 0;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(total) {
  const safe = Math.max(0, Math.min(23 * 60 + 30, total));
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
}

function timeLabel(value) {
  if (!value) return "—";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}

function dateLabel(value) {
  const date = parseIso(value);
  if (!date) return "Selecciona una fecha";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function setNativeValue(input, value) {
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

function buildCalendar(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

const TIME_SLOTS = Array.from({ length: 36 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return timeFromMinutes(minutes);
});

export default function EventDateTimeEnhancer() {
  const pathname = usePathname();
  const [target, setTarget] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("18:00");
  const [activeTime, setActiveTime] = useState("start");
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    if (pathname !== "/") {
      setTarget(null);
      return;
    }

    let cleanupCurrent = null;

    function mountIfNeeded() {
      if (cleanupCurrent) return;

      const main = document.querySelector("main.app-shell");
      if (!main) return;

      const timeInputs = Array.from(main.querySelectorAll('input[type="time"]'));
      const dateInput = main.querySelector('input[type="date"]');

      // The unsupported-city form has a date field but no event start/end time.
      if (!dateInput || timeInputs.length < 2) return;

      const [startInput, endInput] = timeInputs;
      const dateField = dateInput.closest(".field");
      const startField = startInput.closest(".field");
      const endField = endInput.closest(".field");
      const grid = dateField?.parentElement;

      if (!dateField || !startField || !endField || !grid) return;

      const mountNode = document.createElement("div");
      mountNode.className = "java-datetime-mount";
      grid.insertBefore(mountNode, dateField);

      const previousDateDisplay = dateField.style.display;
      const previousStartDisplay = startField.style.display;
      const previousEndDisplay = endField.style.display;

      dateField.style.display = "none";
      startField.style.display = "none";
      endField.style.display = "none";

      const initialDate = dateInput.value || "";
      const initialStart = startInput.value || "16:00";
      const initialEnd = endInput.value || "18:00";

      setSelectedDate(initialDate);
      setStartTime(initialStart);
      setEndTime(initialEnd);

      const initialDateObj = parseIso(initialDate);
      if (initialDateObj) {
        setMonth(new Date(initialDateObj.getFullYear(), initialDateObj.getMonth(), 1));
      }

      setTarget({ mountNode, dateInput, startInput, endInput });

      cleanupCurrent = () => {
        dateField.style.display = previousDateDisplay;
        startField.style.display = previousStartDisplay;
        endField.style.display = previousEndDisplay;
        mountNode.remove();
        cleanupCurrent = null;
        setTarget(null);
      };
    }

    const initialTimer = setTimeout(mountIfNeeded, 120);

    // Poll lightly so switching between an active city and "Otra ciudad"
    // can remove/recreate the form without coupling this component to form state.
    const interval = setInterval(() => {
      if (cleanupCurrent && target?.mountNode && !target.mountNode.isConnected) {
        cleanupCurrent();
      }
      mountIfNeeded();
    }, 700);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      cleanupCurrent?.();
    };
  }, [pathname]);

  const days = useMemo(() => buildCalendar(month), [month]);
  const today = isoDate(new Date());

  function chooseDate(value) {
    setSelectedDate(value);
    setNativeValue(target?.dateInput, value);
  }

  function chooseTime(value) {
    if (activeTime === "start") {
      setStartTime(value);
      setNativeValue(target?.startInput, value);

      if (minutesFromTime(endTime) <= minutesFromTime(value)) {
        const suggested = timeFromMinutes(minutesFromTime(value) + 120);
        setEndTime(suggested);
        setNativeValue(target?.endInput, suggested);
      }

      setActiveTime("end");
      return;
    }

    if (minutesFromTime(value) <= minutesFromTime(startTime)) return;
    setEndTime(value);
    setNativeValue(target?.endInput, value);
  }

  if (!target?.mountNode) return null;

  const duration = Math.max(
    0,
    (minutesFromTime(endTime) - minutesFromTime(startTime)) / 60
  );

  return createPortal(
    <section className="java-datetime-picker" aria-label="Fecha y horario del evento">
      <div className="java-datetime-head">
        <div>
          <div className="java-datetime-kicker">FECHA Y HORARIO</div>
          <h4>Elige el día y la hora de tu evento</h4>
          <p>
            Selecciona una fecha en el calendario y después define el horario del
            servicio. Podrás verificar la disponibilidad antes de cotizar.
          </p>
        </div>

        <div className="java-datetime-summary">
          <span>{dateLabel(selectedDate)}</span>
          <strong>
            {timeLabel(startTime)} – {timeLabel(endTime)}
          </strong>
          <small>
            {duration > 0
              ? `${duration} horas de servicio`
              : "Selecciona un horario válido"}
          </small>
        </div>
      </div>

      <div className="java-datetime-grid">
        <div className="java-calendar-card">
          <div className="java-calendar-toolbar">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() =>
                setMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1)
                )
              }
            >
              ←
            </button>

            <strong>
              {new Intl.DateTimeFormat("es-MX", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </strong>

            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() =>
                setMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1)
                )
              }
            >
              →
            </button>
          </div>

          <div className="java-calendar-weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="java-calendar-days">
            {days.map((date) => {
              const value = isoDate(date);
              const outside = date.getMonth() !== month.getMonth();
              const disabled = value < today;
              const selected = value === selectedDate;
              const isToday = value === today;

              return (
                <button
                  type="button"
                  key={value}
                  disabled={disabled}
                  className={`${outside ? "outside" : ""} ${
                    selected ? "selected" : ""
                  } ${isToday ? "today" : ""}`}
                  onClick={() => chooseDate(value)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="java-time-card">
          <div className="java-time-tabs">
            <button
              type="button"
              className={activeTime === "start" ? "active" : ""}
              onClick={() => setActiveTime("start")}
            >
              <span>Inicio</span>
              <strong>{timeLabel(startTime)}</strong>
            </button>

            <button
              type="button"
              className={activeTime === "end" ? "active" : ""}
              onClick={() => setActiveTime("end")}
            >
              <span>Término</span>
              <strong>{timeLabel(endTime)}</strong>
            </button>
          </div>

          <div className="java-time-help">
            {activeTime === "start"
              ? "Selecciona a qué hora comienza el servicio."
              : "Selecciona a qué hora termina. Debe ser posterior al inicio."}
          </div>

          <div className="java-time-slots">
            {TIME_SLOTS.map((slot) => {
              const selected =
                activeTime === "start" ? slot === startTime : slot === endTime;
              const disabled =
                activeTime === "end" &&
                minutesFromTime(slot) <= minutesFromTime(startTime);

              return (
                <button
                  type="button"
                  key={`${activeTime}-${slot}`}
                  className={selected ? "selected" : ""}
                  disabled={disabled}
                  onClick={() => chooseTime(slot)}
                >
                  {timeLabel(slot)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>,
    target.mountNode
  );
}
