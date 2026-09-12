"use client";

import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function money(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  const now = new Date();
  target.setHours(12, 0, 0, 0);
  now.setHours(12, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

export default function EventOpsBanner() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/admin\/events\/([^/]+)$/);
  const bookingId = match?.[1] || null;
  const [mount, setMount] = useState(null);
  const [detail, setDetail] = useState(null);
  const [payments, setPayments] = useState(null);

  useEffect(() => {
    if (!bookingId) {
      setDetail(null);
      setPayments(null);
      return;
    }

    Promise.all([
      fetch(`/api/admin/events?view=detail&bookingId=${encodeURIComponent(bookingId)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/admin/events/payments?bookingId=${encodeURIComponent(bookingId)}`, { cache: "no-store" }).then((r) => r.json()),
    ]).then(([eventData, paymentData]) => {
      if (eventData?.success) setDetail(eventData);
      if (paymentData?.success) setPayments(paymentData);
    }).catch(() => {});
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    let node = null;

    function attach() {
      const head = document.querySelector(".detailCard .detailHead");
      if (!head || document.querySelector(".java-ops-banner-mount")) return;
      node = document.createElement("div");
      node.className = "java-ops-banner-mount";
      head.insertAdjacentElement("afterend", node);
      setMount(node);
    }

    const timer = setTimeout(attach, 120);
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      node?.remove();
    };
  }, [bookingId]);

  const model = useMemo(() => {
    if (!detail?.booking) return null;
    const booking = detail.booking;
    const eventDays = daysUntil(`${booking.event_date}T12:00:00`);
    const deadlineDays = daysUntil(booking.payment_deadline_at);
    const remaining = Number(payments?.summary?.remaining || 0);
    const cartReady = Boolean(booking.coffee_cart_id);
    const staffCount = detail.staff?.length || 0;
    const readyCount = [cartReady, staffCount > 0, remaining <= 0].filter(Boolean).length;
    return { booking, eventDays, deadlineDays, remaining, cartReady, staffCount, readyCount };
  }, [detail, payments]);

  if (!mount || !model) return null;

  const deadlineText = model.deadlineDays === null
    ? "Sin fecha"
    : model.deadlineDays < 0
    ? `Venció hace ${Math.abs(model.deadlineDays)} día(s)`
    : model.deadlineDays === 0
    ? "Vence hoy"
    : `Faltan ${model.deadlineDays} día(s)`;

  return createPortal(
    <div style={{ margin: "18px 0 4px", padding: 18, borderRadius: 22, background: "#fbfbfd", border: "1px solid rgba(29,29,31,.08)" }}>
      <div style={{ color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", marginBottom: 12 }}>CONTROL OPERATIVO</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        <Card label="Evento" value={model.eventDays === null ? "—" : model.eventDays <= 0 ? "Hoy" : `En ${model.eventDays} día(s)`} />
        <Card label="Saldo pendiente" value={money(model.remaining)} alert={model.remaining > 0 && model.deadlineDays !== null && model.deadlineDays <= 3} />
        <Card label="Fecha límite de saldo" value={deadlineText} alert={model.remaining > 0 && model.deadlineDays !== null && model.deadlineDays <= 3} />
        <Card label="Coffee Cart" value={model.cartReady ? "Asignado" : "Pendiente"} alert={!model.cartReady} />
        <Card label="Personal" value={model.staffCount ? `${model.staffCount} asignado(s)` : "Pendiente"} alert={!model.staffCount} />
        <Card label="Preparación" value={`${model.readyCount}/3 puntos listos`} />
      </div>
    </div>,
    mount
  );
}

function Card({ label, value, alert = false }) {
  return (
    <div style={{ minHeight: 88, padding: "14px 15px", borderRadius: 17, background: alert ? "#fff5f2" : "#fff", border: alert ? "1px solid rgba(240,90,34,.22)" : "1px solid rgba(29,29,31,.08)" }}>
      <div style={{ color: "#8e8e93", fontSize: 10, marginBottom: 7 }}>{label}</div>
      <div style={{ color: alert ? "#b54718" : "#1d1d1f", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize: 18, fontWeight: 500, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}
