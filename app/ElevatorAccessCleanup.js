"use client";

import { useEffect } from "react";

const ELEVATOR_LABEL = "¿Hay elevador disponible para mover equipo?";

function setSelectValue(select, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  )?.set;

  if (setter) setter.call(select, value);
  else select.value = value;

  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function removeElevatorQuestion() {
  const labels = Array.from(document.querySelectorAll("label.label"));
  const label = labels.find(
    (node) => node.textContent?.trim() === ELEVATOR_LABEL
  );

  if (!label) return;

  const field = label.closest(".field");
  const select = field?.querySelector("select");

  if (select && select.value !== "no") {
    setSelectValue(select, "no");
  }

  if (field) {
    field.style.display = "none";
    field.setAttribute("aria-hidden", "true");
  }
}

export default function ElevatorAccessCleanup() {
  useEffect(() => {
    const run = () => removeElevatorQuestion();

    run();

    const timers = [
      window.setTimeout(run, 50),
      window.setTimeout(run, 250),
      window.setTimeout(run, 800),
    ];

    window.addEventListener("java:wizard-step", run);
    window.addEventListener("java:quote-open", run);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("java:wizard-step", run);
      window.removeEventListener("java:quote-open", run);
    };
  }, []);

  return null;
}
