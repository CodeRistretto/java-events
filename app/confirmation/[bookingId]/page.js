"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value) {
  if (!value) return "—";

  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );
}

function timeLabel(value) {
  if (!value) return "—";

  const [hour, minute] = String(value)
    .slice(0, 5)
    .split(":")
    .map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  }).format(
    new Date(
      2000,
      0,
      1,
      hour,
      minute
    )
  );
}

function statusInfo(status) {
  const map = {
    HOLD: {
      title: "Fecha apartada temporalmente",
      text:
        "Tu fecha está apartada, pero todavía falta completar el pago del anticipo.",
      color: "#f59e0b",
      background: "rgba(245,158,11,.10)",
      border: "rgba(245,158,11,.28)",
    },

    PAYMENT_PENDING: {
      title: "Esperando tu pago",
      text:
        "Completa el pago del anticipo en Shopify. Esta página se actualizará automáticamente.",
      color: "#f59e0b",
      background: "rgba(245,158,11,.10)",
      border: "rgba(245,158,11,.28)",
    },

    CONFIRMED: {
      title: "Evento confirmado",
      text:
        "Recibimos tu pago. Tu fecha quedó confirmada con Java Times Caffé.",
      color: "#22c55e",
      background: "rgba(34,197,94,.10)",
      border: "rgba(34,197,94,.28)",
    },

    PAID: {
      title: "Pago recibido",
      text:
        "Recibimos el pago y estamos terminando de confirmar tu evento.",
      color: "#22c55e",
      background: "rgba(34,197,94,.10)",
      border: "rgba(34,197,94,.28)",
    },

    DEPOSIT_PAID: {
      title: "Anticipo recibido",
      text:
        "El anticipo fue recibido correctamente.",
      color: "#22c55e",
      background: "rgba(34,197,94,.10)",
      border: "rgba(34,197,94,.28)",
    },

    EXPIRED: {
      title: "El apartado venció",
      text:
        "El tiempo para completar el pago terminó. Vuelve al cotizador para consultar disponibilidad.",
      color: "#ef4444",
      background: "rgba(239,68,68,.10)",
      border: "rgba(239,68,68,.28)",
    },

    CANCELLED: {
      title: "Evento cancelado",
      text:
        "Este evento se encuentra cancelado.",
      color: "#ef4444",
      background: "rgba(239,68,68,.10)",
      border: "rgba(239,68,68,.28)",
    },

    REFUNDED: {
      title: "Pago reembolsado",
      text:
        "Este evento registra un reembolso.",
      color: "#ef4444",
      background: "rgba(239,68,68,.10)",
      border: "rgba(239,68,68,.28)",
    },
  };

  return (
    map[status] || {
      title: status || "Evento",
      text: "Consulta el estado actual de tu evento.",
      color: "#f05a22",
      background: "rgba(240,90,34,.10)",
      border: "rgba(240,90,34,.28)",
    }
  );
}

function itemLabel(item) {
  if (item.code === "HOT_COFFEE_SERVICE") {
    return `Servicio base Java Coffee Cart para ${item.quantity} invitados`;
  }

  if (item.code === "COLD_BEVERAGES") {
    return `Bebidas frías para ${item.quantity} invitados`;
  }

  if (item.code === "ADDITIONAL_HOUR") {
    return `${item.quantity} hora(s) adicional(es) de servicio`;
  }

  return item.name;
}

function priceExplanation(item) {
  if (item.pricingType === "PER_GUEST") {
    return `${item.quantity} invitados × ${money(
      item.unitPrice
    )}`;
  }

  if (item.pricingType === "PER_HOUR") {
    return `${item.quantity} hora(s) × ${money(
      item.unitPrice
    )}`;
  }

  if (item.pricingType === "PER_UNIT") {
    return `${item.quantity} unidad(es) × ${money(
      item.unitPrice
    )}`;
  }

  if (item.pricingType === "PER_EVENT") {
    return "Precio fijo por evento";
  }

  return "";
}

export default function ConfirmationPage() {
  const params = useParams();
  const bookingId = params?.bookingId;

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadEvent() {
    if (!bookingId) return;

    try {
      const response = await fetch(
        `/api/confirmation/${bookingId}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "No fue posible cargar el evento."
        );
      }

      setData(result);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvent();
  }, [bookingId]);

  useEffect(() => {
    const currentStatus =
      data?.event?.status;

    if (
      ![
        "HOLD",
        "PAYMENT_PENDING",
        "PAID",
        "DEPOSIT_PAID",
      ].includes(currentStatus)
    ) {
      return;
    }

    const interval = setInterval(
      loadEvent,
      3000
    );

    return () =>
      clearInterval(interval);
  }, [
    bookingId,
    data?.event?.status,
  ]);

  const status = useMemo(
    () =>
      statusInfo(
        data?.event?.status
      ),
    [data?.event?.status]
  );

  if (loading) {
    return (
      <main className="confirmation-page">
        <div className="confirmation-shell">
          <div className="loading-card">
            Cargando tu evento...
          </div>
        </div>

        <Styles />
      </main>
    );
  }

  if (
    error ||
    !data?.event
  ) {
    return (
      <main className="confirmation-page">
        <div className="confirmation-shell">
          <div className="error-card">
            <div className="eyebrow">
              JAVA TIMES CAFFÉ · EVENTS
            </div>

            <h1>
              No pudimos cargar tu evento
            </h1>

            <p>
              {error}
            </p>

            <button
              className="primary-button"
              onClick={
                loadEvent
              }
            >
              Intentar de nuevo
            </button>
          </div>
        </div>

        <Styles />
      </main>
    );
  }

  const event = data.event;

  const confirmed = [
    "CONFIRMED",
    "PAID",
    "DEPOSIT_PAID",
  ].includes(event.status);

  return (
    <main className="confirmation-page">
      <div className="confirmation-shell">

        {/* HEADER */}
        <header className="topbar no-print">
          <div>
            <div className="eyebrow">
              JAVA TIMES CAFFÉ · EVENTS
            </div>

            <div className="topbar-subtitle">
              Comprobante y estado de tu evento
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button"
              onClick={() =>
                window.print()
              }
            >
              Imprimir / Guardar PDF
            </button>

            <Link
              className="primary-button link-button"
              href="/"
            >
              Volver a Java Events
            </Link>
          </div>
        </header>

        {/* HERO */}
        <section className="hero-grid">
          <div className="hero-card">
            <div className="eyebrow">
              TU RESERVA
            </div>

            <h1>
              {confirmed
                ? "Tu evento está confirmado"
                : "Estamos esperando tu pago"}
            </h1>

            <p className="hero-copy">
              Aquí puedes revisar qué contrataste,
              cuánto cuesta todo el evento,
              cuánto pagaste hoy y cuánto queda
              pendiente.
            </p>
          </div>

          <div
            className="status-card"
            style={{
              background:
                status.background,
              borderColor:
                status.border,
            }}
          >
            <div className="status-row">
              <span
                className="status-dot"
                style={{
                  background:
                    status.color,
                  boxShadow: `0 0 18px ${status.color}`,
                }}
              />

              <div>
                <div className="status-kicker">
                  ESTADO ACTUAL
                </div>

                <div className="status-title">
                  {status.title}
                </div>
              </div>
            </div>

            <p>
              {status.text}
            </p>

            <div className="event-number-box">
              <div className="event-number-label">
                NÚMERO DE EVENTO
              </div>

              <div className="event-number">
                {event.number}
              </div>
            </div>
          </div>
        </section>

        {/* MAIN */}
        <div className="main-grid">

          {/* LEFT */}
          <section className="main-card">

            <div className="section-heading">
              <div>
                <div className="eyebrow">
                  TU SERVICIO
                </div>

                <h2>
                  Lo que contrataste
                </h2>
              </div>
            </div>

            <div className="base-service-card">
              <div className="base-service-title">
                Servicio base Java Coffee Cart
              </div>

              <p>
                Coffee Cart, equipo, montaje,
                personal asignado y servicio de
                espresso, americano, cappuccino,
                latte, mocha y té caliente para
                el número de invitados contratado.
              </p>
            </div>

            <div className="items-list">
              {data.items.map(
                (item) => (
                  <div
                    className="item-row"
                    key={
                      item.id
                    }
                  >
                    <div>
                      <div className="item-name">
                        {itemLabel(
                          item
                        )}
                      </div>

                      <div className="item-detail">
                        {priceExplanation(
                          item
                        )}
                      </div>
                    </div>

                    <div className="item-price">
                      {money(
                        item.lineTotal
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="section-divider" />

            <div className="section-heading">
              <div>
                <div className="eyebrow">
                  INFORMACIÓN
                </div>

                <h2>
                  Datos del evento
                </h2>
              </div>
            </div>

            <div className="info-grid">
              <Info
                label="Cliente"
                value={
                  event.customerName
                }
              />

              <Info
                label="Tipo de evento"
                value={
                  event.eventType ||
                  "—"
                }
              />

              <Info
                label="Fecha"
                value={dateLabel(
                  event.eventDate
                )}
              />

              <Info
                label="Hora de inicio"
                value={timeLabel(
                  event.startTime
                )}
              />

              <Info
                label="Duración"
                value={`${event.durationHours} horas`}
              />

              <Info
                label="Invitados"
                value={String(
                  event.guests
                )}
              />

              <Info
                label="Ciudad"
                value={`${event.city}, ${event.state}`}
              />

              <Info
                label="Lugar"
                value={
                  event.venueName ||
                  "—"
                }
              />

              <Info
                label="Dirección"
                value={[
                  event.address,
                  event.neighborhood,
                  event.postalCode,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ", "
                  )}
                full
              />
            </div>

            <div className="section-divider" />

            <div className="section-heading">
              <div>
                <div className="eyebrow">
                  SIGUIENTE PASO
                </div>

                <h2>
                  ¿Qué sigue?
                </h2>
              </div>
            </div>

            <div className="steps-grid">
              <NextStep
                number="1"
                title={
                  confirmed
                    ? "Anticipo recibido"
                    : "Completa el anticipo"
                }
                text={
                  confirmed
                    ? "Tu pago ya fue recibido y registrado."
                    : "Completa el pago del anticipo en Shopify para confirmar la fecha."
                }
              />

              <NextStep
                number="2"
                title="Java revisa tu evento"
                text="Nuestro equipo tendrá los datos del lugar, horario, invitados y servicios contratados."
              />

              <NextStep
                number="3"
                title="Coordinación previa"
                text="Podremos contactarte antes del evento si necesitamos confirmar accesos, montaje o detalles operativos."
              />

              <NextStep
                number="4"
                title="Saldo pendiente"
                text={`Después del anticipo queda un saldo de ${money(
                  event.balance
                )}. Ese saldo no se está cobrando hoy.`}
              />
            </div>
          </section>

          {/* RIGHT */}
          <aside className="payment-card">

            <div className="eyebrow">
              RESUMEN DE PAGO
            </div>

            <h2>
              Tu evento
            </h2>

            {event.subtotal !== null && (
              <MoneyRow
                label="Subtotal del evento"
                value={
                  event.subtotal
                }
              />
            )}

            {event.vat !== null && (
              <MoneyRow
                label={`IVA ${
                  event.vatPercent !== null
                    ? event.vatPercent.toFixed(
                        0
                      )
                    : ""
                }%`}
                value={
                  event.vat
                }
              />
            )}

            <MoneyRow
              label="Total del evento"
              value={
                event.total
              }
              bold
            />

            <div className="paid-today-card">
              <div className="paid-today-kicker">
                PAGASTE HOY
              </div>

              <div className="paid-today-value">
                {money(
                  event.deposit
                )}
              </div>

              <div className="paid-today-description">
                Anticipo para apartar tu fecha.
              </div>

              {event.depositSubtotal !==
                null && (
                <div className="deposit-breakdown">
                  <MoneyRow
                    label="Subtotal anticipo"
                    value={
                      event.depositSubtotal
                    }
                  />

                  <MoneyRow
                    label="IVA anticipo"
                    value={
                      event.depositVat
                    }
                  />
                </div>
              )}
            </div>

            <div className="balance-card">
              <div>
                <div className="balance-label">
                  SALDO PENDIENTE
                </div>

                <div className="balance-value">
                  {money(
                    event.balance
                  )}
                </div>
              </div>
            </div>

            <div className="important-card">
              <strong>
                Importante
              </strong>

              <p>
                El monto pagado hoy corresponde
                únicamente al anticipo para
                reservar la fecha. No estás
                pagando todavía el saldo completo
                del evento.
              </p>
            </div>

            {event.status ===
              "PAYMENT_PENDING" && (
              <div className="pending-card">
                Esta página se actualiza
                automáticamente mientras
                esperamos el pago.
              </div>
            )}

            {confirmed && (
              <div className="confirmed-card">
                ✓ Pago recibido.
                <br />
                Tu evento está confirmado.
              </div>
            )}

            {!confirmed && (
              <button
                className="secondary-button full-button no-print"
                onClick={
                  loadEvent
                }
              >
                Actualizar estado
              </button>
            )}

            {confirmed && (
              <button
                className="secondary-button full-button no-print"
                onClick={() =>
                  window.print()
                }
              >
                Imprimir comprobante
              </button>
            )}
          </aside>
        </div>

        <footer className="footer">
          Java Times Caffé · Java Events
          <br />
          Guarda este comprobante para consultar
          los datos de tu evento.
        </footer>
      </div>

      <Styles />
    </main>
  );
}

function Info({
  label,
  value,
  full = false,
}) {
  return (
    <div
      className={`info-card ${
        full ? "info-full" : ""
      }`}
    >
      <div className="info-label">
        {label}
      </div>

      <div className="info-value">
        {value || "—"}
      </div>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  bold = false,
}) {
  return (
    <div
      className={`money-row ${
        bold ? "money-bold" : ""
      }`}
    >
      <span>
        {label}
      </span>

      <span className="money-value">
        {money(value)}
      </span>
    </div>
  );
}

function NextStep({
  number,
  title,
  text,
}) {
  return (
    <div className="next-step">
      <div className="step-number">
        {number}
      </div>

      <div>
        <div className="step-title">
          {title}
        </div>

        <div className="step-text">
          {text}
        </div>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
      }

      .confirmation-page {
        min-height: 100vh;
        background:
          radial-gradient(
            circle at top left,
            rgba(240, 90, 34, 0.11),
            transparent 32%
          ),
          #090909;
        color: white;
        padding: 32px 20px 70px;
      }

      .confirmation-shell {
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
      }

      .topbar-subtitle {
        color: #8f8f8f;
        margin-top: 5px;
        font-size: 13px;
      }

      .topbar-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .eyebrow {
        color: #ff7541;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1.7px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1.55fr)
          minmax(360px, 0.65fr);
        gap: 22px;
        margin-bottom: 22px;
      }

      .hero-card,
      .status-card,
      .main-card,
      .payment-card,
      .loading-card,
      .error-card {
        border: 1px solid #2c2c2c;
        background: #141414;
        border-radius: 24px;
      }

      .hero-card {
        padding: 32px;
      }

      .hero-card h1 {
        font-size: clamp(
          34px,
          5vw,
          58px
        );
        margin: 10px 0 14px;
        line-height: 0.98;
        max-width: 780px;
      }

      .hero-copy {
        max-width: 740px;
        color: #b7b7b7;
        font-size: 17px;
        line-height: 1.65;
        margin: 0;
      }

      .status-card {
        padding: 26px;
        border-width: 1px;
      }

      .status-row {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .status-dot {
        flex: 0 0 auto;
        width: 13px;
        height: 13px;
        border-radius: 999px;
      }

      .status-kicker {
        color: #9a9a9a;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.3px;
      }

      .status-title {
        font-size: 23px;
        font-weight: 800;
        margin-top: 3px;
      }

      .status-card p {
        color: #c2c2c2;
        line-height: 1.6;
      }

      .event-number-box {
        background: rgba(
          255,
          255,
          255,
          0.045
        );
        border: 1px solid rgba(
          255,
          255,
          255,
          0.07
        );
        padding: 16px;
        border-radius: 16px;
        margin-top: 18px;
      }

      .event-number-label {
        color: #999;
        font-size: 11px;
        letter-spacing: 1.2px;
      }

      .event-number {
        font-size: 19px;
        font-weight: 800;
        margin-top: 5px;
        overflow-wrap: anywhere;
      }

      .main-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1.45fr)
          minmax(400px, 0.75fr);
        gap: 22px;
        align-items: start;
      }

      .main-card {
        padding: 30px;
        min-width: 0;
      }

      .payment-card {
        padding: 28px;
        min-width: 0;
        position: sticky;
        top: 20px;
        overflow: hidden;
      }

      .main-card h2,
      .payment-card h2 {
        margin: 6px 0 18px;
        font-size: 28px;
      }

      .section-heading {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-end;
      }

      .base-service-card {
        padding: 20px;
        background: #1b1b1b;
        border: 1px solid #292929;
        border-radius: 16px;
        margin-bottom: 8px;
      }

      .base-service-title {
        font-weight: 800;
        font-size: 17px;
      }

      .base-service-card p {
        color: #a9a9a9;
        line-height: 1.6;
        margin-bottom: 0;
      }

      .item-row {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 17px 0;
        border-bottom: 1px solid #292929;
      }

      .item-name {
        font-weight: 800;
        line-height: 1.4;
      }

      .item-detail {
        color: #999;
        font-size: 13px;
        margin-top: 4px;
      }

      .item-price {
        flex: 0 0 auto;
        font-weight: 800;
        font-size: 17px;
        white-space: nowrap;
      }

      .section-divider {
        height: 1px;
        background: #2a2a2a;
        margin: 32px 0;
      }

      .info-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .info-card {
        padding: 16px;
        background: #1b1b1b;
        border: 1px solid #2b2b2b;
        border-radius: 15px;
        min-width: 0;
      }

      .info-full {
        grid-column: 1 / -1;
      }

      .info-label {
        color: #909090;
        font-size: 12px;
        margin-bottom: 7px;
      }

      .info-value {
        font-size: 16px;
        font-weight: 750;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .steps-grid {
        display: grid;
        gap: 12px;
      }

      .next-step {
        display: grid;
        grid-template-columns:
          38px 1fr;
        gap: 12px;
        padding: 14px;
        border-radius: 14px;
        background: #1a1a1a;
        border: 1px solid #292929;
      }

      .step-number {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: rgba(
          240,
          90,
          34,
          0.15
        );
        border: 1px solid rgba(
          240,
          90,
          34,
          0.35
        );
        color: #ff7541;
        font-weight: 900;
      }

      .step-title {
        font-weight: 800;
      }

      .step-text {
        color: #9f9f9f;
        line-height: 1.55;
        font-size: 14px;
        margin-top: 3px;
      }

      .money-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        padding: 12px 0;
        border-bottom: 1px solid #292929;
        color: #c9c9c9;
      }

      .money-row > span:first-child {
        min-width: 0;
      }

      .money-value {
        flex: 0 0 auto;
        white-space: nowrap;
        color: white;
        text-align: right;
      }

      .money-bold {
        font-size: 20px;
        font-weight: 900;
        color: white;
        padding-top: 16px;
        padding-bottom: 16px;
      }

      .paid-today-card {
        background: #1c1c1c;
        border: 1px solid #292929;
        border-radius: 20px;
        padding: 22px;
        margin-top: 22px;
        overflow: hidden;
      }

      .paid-today-kicker {
        color: #ff7541;
        font-size: 12px;
        letter-spacing: 1.5px;
        font-weight: 900;
      }

      .paid-today-value {
        font-size: clamp(
          38px,
          5vw,
          54px
        );
        line-height: 1;
        margin-top: 10px;
        font-weight: 900;
        letter-spacing: -2px;
        white-space: nowrap;
      }

      .paid-today-description {
        color: #b2b2b2;
        margin-top: 12px;
        line-height: 1.5;
      }

      .deposit-breakdown {
        margin-top: 18px;
      }

      .balance-card {
        padding: 22px 0 8px;
      }

      .balance-label {
        color: #a7a7a7;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1.3px;
      }

      .balance-value {
        font-size: clamp(
          30px,
          4vw,
          40px
        );
        font-weight: 900;
        line-height: 1;
        margin-top: 8px;
        white-space: nowrap;
      }

      .important-card {
        margin-top: 18px;
        padding: 18px;
        background: #23150f;
        border: 1px solid #6d3118;
        border-radius: 16px;
        color: #e7d2c9;
      }

      .important-card p {
        margin: 7px 0 0;
        line-height: 1.65;
      }

      .pending-card,
      .confirmed-card {
        margin-top: 18px;
        padding: 15px;
        border-radius: 14px;
        line-height: 1.55;
      }

      .pending-card {
        color: #fde68a;
        background: rgba(
          245,
          158,
          11,
          0.08
        );
        border: 1px solid rgba(
          245,
          158,
          11,
          0.25
        );
      }

      .confirmed-card {
        color: #86efac;
        background: rgba(
          34,
          197,
          94,
          0.08
        );
        border: 1px solid rgba(
          34,
          197,
          94,
          0.25
        );
      }

      .primary-button,
      .secondary-button {
        border-radius: 12px;
        padding: 13px 17px;
        font-weight: 800;
        cursor: pointer;
        text-decoration: none;
        border: 1px solid transparent;
        font-size: 14px;
      }

      .primary-button {
        background: #f05a22;
        color: white;
      }

      .secondary-button {
        background: #1c1c1c;
        color: white;
        border-color: #393939;
      }

      .link-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .full-button {
        width: 100%;
        margin-top: 18px;
      }

      .footer {
        text-align: center;
        color: #666;
        line-height: 1.7;
        font-size: 12px;
        padding-top: 34px;
      }

      .loading-card,
      .error-card {
        max-width: 820px;
        margin: 80px auto 0;
        padding: 30px;
      }

      .error-card p {
        color: #aaa;
        line-height: 1.6;
      }

      @media (
        max-width: 1050px
      ) {
        .hero-grid,
        .main-grid {
          grid-template-columns: 1fr;
        }

        .payment-card {
          position: static;
        }

        .paid-today-value,
        .balance-value {
          white-space: normal;
        }
      }

      @media (
        max-width: 700px
      ) {
        .confirmation-page {
          padding: 18px 12px 50px;
        }

        .topbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .topbar-actions {
          width: 100%;
        }

        .topbar-actions a,
        .topbar-actions button {
          flex: 1;
          text-align: center;
        }

        .hero-card,
        .status-card,
        .main-card,
        .payment-card {
          border-radius: 18px;
          padding: 20px;
        }

        .hero-card h1 {
          font-size: 38px;
        }

        .info-grid {
          grid-template-columns: 1fr;
        }

        .info-full {
          grid-column: auto;
        }

        .item-row {
          flex-direction: column;
          gap: 7px;
        }

        .item-price {
          font-size: 18px;
        }

        .paid-today-value {
          font-size: 40px;
          letter-spacing: -1px;
        }

        .balance-value {
          font-size: 34px;
        }

        .money-row {
          gap: 12px;
        }
      }

      @media print {
        body {
          background: white !important;
        }

        .confirmation-page {
          background: white !important;
          color: black !important;
          padding: 0;
        }

        .confirmation-shell {
          max-width: none;
        }

        .no-print {
          display: none !important;
        }

        .hero-card,
        .status-card,
        .main-card,
        .payment-card,
        .info-card,
        .base-service-card,
        .paid-today-card,
        .next-step,
        .important-card {
          background: white !important;
          color: black !important;
          border-color: #ccc !important;
          box-shadow: none !important;
        }

        .hero-grid,
        .main-grid {
          display: block;
        }

        .status-card,
        .payment-card {
          margin-top: 16px;
        }

        .payment-card {
          position: static;
        }

        p,
        .hero-copy,
        .item-detail,
        .step-text,
        .info-label,
        .paid-today-description {
          color: #444 !important;
        }

        .money-value,
        .info-value,
        .item-price,
        .event-number,
        .paid-today-value,
        .balance-value {
          color: black !important;
        }

        .footer {
          color: #555;
        }
      }
    `}</style>
  );
}