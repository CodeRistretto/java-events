"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const EMPTY = {
  ready: false,
  city: "",
  guests: "",
  date: "",
  time: "",
  duration: "",
  addOns: [],
  total: "",
  deposit: "",
  balance: "",
  balanceDueDays: 3,
};

function fieldByLabel(text) {
  return Array.from(document.querySelectorAll("main.app-shell .field")).find((field) =>
    field.querySelector("label")?.textContent?.trim().toLowerCase() === text.toLowerCase()
  );
}

function selectedText(label) {
  const select = fieldByLabel(label)?.querySelector("select");
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function summaryValue(label) {
  const rows = Array.from(document.querySelectorAll("main.app-shell .summary-row"));
  const row = rows.find(
    (item) => item.querySelector("span")?.textContent?.trim().toLowerCase() === label.toLowerCase()
  );
  return row?.querySelector("strong")?.textContent?.trim() || "";
}

function removeOtherCityOption() {
  const select = fieldByLabel("Ciudad del evento")?.querySelector("select");
  if (!select) return;

  const other = Array.from(select.options).find((option) => option.value === "OTHER");
  if (!other) return;

  if (select.value === "OTHER") {
    const firstAvailable = Array.from(select.options).find((option) => option.value !== "OTHER");
    if (firstAvailable) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value"
      )?.set;
      if (setter) setter.call(select, firstAvailable.value);
      else select.value = firstAvailable.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  other.remove();
}

function readBalanceDueDays() {
  const cards = Array.from(document.querySelectorAll(".java-visible-terms-grid > div"));
  const card = cards.find((item) =>
    String(item.querySelector("span")?.textContent || "").toLowerCase().includes("saldo completo")
  );
  const text = card?.querySelector("strong")?.textContent || "";
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 3;
}

function readAddOns() {
  const checked = Array.from(
    document.querySelectorAll("main.app-shell .check-card input[type='checkbox']:checked")
  );

  const names = checked
    .map((input) => input.closest(".check-card"))
    .filter(Boolean)
    .filter((card) => String(card.textContent || "").includes("$"))
    .map((card) => card.querySelector(".check-title")?.textContent?.trim())
    .filter(Boolean);

  const durationText =
    document.querySelector(".java-datetime-summary small")?.textContent?.trim() || "";
  const durationMatch = durationText.match(/([\d.]+)\s*horas?/i);
  const duration = durationMatch ? Number(durationMatch[1]) : 0;

  if (duration > 2 && !names.some((name) => name.toLowerCase().includes("hora"))) {
    names.push(`${Math.ceil(duration - 2)} hora(s) adicional(es)`);
  }

  return [...new Set(names)];
}

function readSnapshot() {
  removeOtherCityOption();

  const shell = document.querySelector("main.app-shell");
  if (!shell) return EMPTY;

  const dateSummary = document.querySelector(".java-datetime-summary");
  const depositBlock = Array.from(document.querySelectorAll(".summary-block")).find((block) =>
    String(block.textContent || "").includes("Pago de hoy")
  );

  return {
    ready: true,
    city: selectedText("Ciudad del evento"),
    guests: selectedText("Invitados"),
    date: dateSummary?.querySelector("span")?.textContent?.trim() || "",
    time: dateSummary?.querySelector("strong")?.textContent?.trim() || "",
    duration: dateSummary?.querySelector("small")?.textContent?.trim() || "",
    addOns: readAddOns(),
    total: summaryValue("Total del evento"),
    deposit: depositBlock?.querySelector(".summary-big")?.textContent?.trim() || "",
    balance: summaryValue("Saldo después del anticipo"),
    balanceDueDays: readBalanceDueDays(),
  };
}

function scrollToNext(snapshot) {
  const buttons = Array.from(document.querySelectorAll("main.app-shell button"));

  if (!snapshot.total) {
    const quoteButton = buttons.find((button) =>
      /ver precio de mi evento|calcular precio del evento/i.test(button.textContent || "")
    );
    quoteButton?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const reserveButton = buttons.find((button) =>
    /apartar fecha con anticipo/i.test(button.textContent || "")
  );
  reserveButton?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function FloatingEventCart() {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [open, setOpen] = useState(true);
  const lastRef = useRef("");

  useEffect(() => {
    if (pathname !== "/") return;

    const mobile = window.matchMedia("(max-width: 760px)").matches;
    setOpen(!mobile);

    function sync() {
      const next = readSnapshot();
      const signature = JSON.stringify(next);
      if (signature === lastRef.current) return;
      lastRef.current = signature;
      setSnapshot(next);
    }

    sync();
    const interval = window.setInterval(sync, 700);
    return () => window.clearInterval(interval);
  }, [pathname]);

  if (pathname !== "/" || !snapshot.ready) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="java-floating-cart-collapsed"
        onClick={() => setOpen(true)}
        aria-label="Abrir resumen del evento"
      >
        <span className="java-floating-cart-dot">☕</span>
        <span>
          <small>Tu evento</small>
          <strong>{snapshot.deposit ? `Hoy ${snapshot.deposit}` : "Ver resumen"}</strong>
        </span>
        <span className="java-floating-cart-arrow">↑</span>
      </button>
    );
  }

  const visibleAddOns = snapshot.addOns.slice(0, 3);
  const extraAddOnCount = Math.max(0, snapshot.addOns.length - visibleAddOns.length);

  return (
    <aside className="java-floating-cart" aria-label="Resumen flotante de tu evento">
      <div className="java-floating-cart-head">
        <div>
          <small>TU EVENTO JAVA</small>
          <strong>Resumen en vivo</strong>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Minimizar resumen">
          —
        </button>
      </div>

      <div className="java-floating-cart-meta">
        {snapshot.city && <span>{snapshot.city}</span>}
        {snapshot.guests && <span>{snapshot.guests}</span>}
        {snapshot.date && snapshot.date !== "Selecciona una fecha" && <span>{snapshot.date}</span>}
        {snapshot.time && <span>{snapshot.time}</span>}
      </div>

      {snapshot.addOns.length > 0 && (
        <div className="java-floating-cart-addons">
          {visibleAddOns.map((name) => (
            <span key={name}>{name}</span>
          ))}
          {extraAddOnCount > 0 && <span>+{extraAddOnCount} más</span>}
        </div>
      )}

      {snapshot.total ? (
        <>
          <div className="java-floating-cart-money">
            <div>
              <span>Total del evento</span>
              <strong>{snapshot.total}</strong>
            </div>
            <div className="today">
              <span>Hoy sólo pagas el anticipo</span>
              <strong>{snapshot.deposit || "—"}</strong>
            </div>
          </div>

          <div className="java-floating-cart-balance">
            <span>Saldo restante</span>
            <strong>{snapshot.balance || "—"}</strong>
            <small>
              Puedes liquidarlo hasta {snapshot.balanceDueDays} días antes del evento.
            </small>
          </div>
        </>
      ) : (
        <div className="java-floating-cart-prompt">
          <strong>Arma tu evento con calma.</strong>
          <span>El total, anticipo y saldo aparecerán aquí cuando calcules el precio.</span>
        </div>
      )}

      <button
        type="button"
        className="java-floating-cart-cta"
        onClick={() => scrollToNext(snapshot)}
      >
        {snapshot.total ? "Continuar con mi reserva →" : "Ver mi precio →"}
      </button>

      <div className="java-floating-cart-security">
        No pagas el total hoy. La fecha se confirma con el anticipo.
      </div>
    </aside>
  );
}
