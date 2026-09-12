"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
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
  const [detail, setDetail] = useState(null);
  const [payments, setPayments] = useState(null);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;

    Promise.all([
      fetch(`/api/admin/events?view=detail&bookingId=${encodeURIComponent(bookingId)}`, {
        cache: "no-store",
      }).then((response) => response.json()),
      fetch(`/api/admin/events/payments?bookingId=${encodeURIComponent(bookingId)}`, {
        cache: "no-store",
      }).then((response) => response.json()),
    ])
      .then(([eventData, paymentData]) => {
        if (cancelled) return;
        if (eventData?.success) setDetail(eventData);
        if (paymentData?.success) setPayments(paymentData);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
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
    const filesCount = detail.uploads?.length || 0;
    const paidReady = remaining <= 0;
    const readyCount = [cartReady, staffCount > 0, paidReady].filter(Boolean).length;

    return {
      booking,
      eventDays,
      deadlineDays,
      remaining,
      cartReady,
      staffCount,
      filesCount,
      paidReady,
      readyCount,
    };
  }, [detail, payments]);

  if (!bookingId || !model) return null;

  const deadlineText =
    model.deadlineDays === null
      ? "Sin fecha"
      : model.deadlineDays < 0
      ? `Venció hace ${Math.abs(model.deadlineDays)} día(s)`
      : model.deadlineDays === 0
      ? "Vence hoy"
      : `Faltan ${model.deadlineDays} día(s)`;

  const urgentBalance =
    model.remaining > 0 &&
    model.deadlineDays !== null &&
    model.deadlineDays <= 3;

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "24px 20px 0",
      }}
    >
      <section
        style={{
          padding: 20,
          borderRadius: 24,
          background: "#ffffff",
          border: "1px solid rgba(29,29,31,.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,.035)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 15,
          }}
        >
          <div>
            <div
              style={{
                color: "#f05a22",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".14em",
                marginBottom: 5,
              }}
            >
              CONTROL OPERATIVO
            </div>
            <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-.035em" }}>
              {model.booking.event_order_number || "Evento Java"}
            </div>
          </div>

          {urgentBalance && (
            <div
              style={{
                padding: "9px 13px",
                borderRadius: 999,
                background: "#fff1ed",
                color: "#b54718",
                fontSize: 12,
                fontWeight: 650,
              }}
            >
              Saldo requiere atención
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))",
            gap: 10,
          }}
        >
          <Card
            label="Evento"
            value={
              model.eventDays === null
                ? "—"
                : model.eventDays < 0
                ? "Evento pasado"
                : model.eventDays === 0
                ? "Hoy"
                : `En ${model.eventDays} día(s)`
            }
          />
          <Card
            label="Saldo pendiente"
            value={money(model.remaining)}
            alert={urgentBalance}
          />
          <Card
            label="Fecha límite de saldo"
            value={deadlineText}
            alert={urgentBalance}
          />
          <Card
            label="Coffee Cart"
            value={model.cartReady ? "Asignado" : "Pendiente"}
            alert={!model.cartReady}
          />
          <Card
            label="Personal"
            value={model.staffCount ? `${model.staffCount} asignado(s)` : "Pendiente"}
            alert={!model.staffCount}
          />
          <Card
            label="Archivos del venue"
            value={model.filesCount ? `${model.filesCount} archivo(s)` : "Sin archivos"}
          />
          <Card
            label="Preparación mínima"
            value={`${model.readyCount}/3 puntos listos`}
            alert={model.readyCount < 3 && model.eventDays !== null && model.eventDays <= 7}
          />
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, alert = false }) {
  return (
    <div
      style={{
        minHeight: 88,
        padding: "14px 15px",
        borderRadius: 17,
        background: alert ? "#fff5f2" : "#fbfbfd",
        border: alert
          ? "1px solid rgba(240,90,34,.22)"
          : "1px solid rgba(29,29,31,.07)",
      }}
    >
      <div style={{ color: "#8e8e93", fontSize: 10, marginBottom: 7 }}>
        {label}
      </div>
      <div
        style={{
          color: alert ? "#b54718" : "#1d1d1f",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          fontSize: 18,
          fontWeight: 500,
          lineHeight: 1.18,
        }}
      >
        {value}
      </div>
    </div>
  );
}
