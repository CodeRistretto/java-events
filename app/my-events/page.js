"use client";

import {
  useState,
} from "react";

import Link from "next/link";

function money(value) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }
  ).format(
    Number(value || 0)
  );
}

function dateLabel(value) {
  if (!value) {
    return "—";
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(
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
  if (!value) {
    return "—";
  }

  const [
    hour,
    minute,
  ] = String(value)
    .slice(0, 5)
    .split(":")
    .map(Number);

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(
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
      label:
        "Fecha apartada",
      color:
        "#f59e0b",
      background:
        "rgba(245,158,11,.10)",
      border:
        "rgba(245,158,11,.25)",
    },

    PAYMENT_PENDING: {
      label:
        "Pago pendiente",
      color:
        "#f59e0b",
      background:
        "rgba(245,158,11,.10)",
      border:
        "rgba(245,158,11,.25)",
    },

    CONFIRMED: {
      label:
        "Confirmado",
      color:
        "#22c55e",
      background:
        "rgba(34,197,94,.10)",
      border:
        "rgba(34,197,94,.25)",
    },

    PAID: {
      label:
        "Pagado",
      color:
        "#22c55e",
      background:
        "rgba(34,197,94,.10)",
      border:
        "rgba(34,197,94,.25)",
    },

    DEPOSIT_PAID: {
      label:
        "Anticipo recibido",
      color:
        "#22c55e",
      background:
        "rgba(34,197,94,.10)",
      border:
        "rgba(34,197,94,.25)",
    },

    PREPARATION: {
      label:
        "En preparación",
      color:
        "#60a5fa",
      background:
        "rgba(96,165,250,.10)",
      border:
        "rgba(96,165,250,.25)",
    },

    COMPLETED: {
      label:
        "Evento realizado",
      color:
        "#a78bfa",
      background:
        "rgba(167,139,250,.10)",
      border:
        "rgba(167,139,250,.25)",
    },

    CANCELLED: {
      label:
        "Cancelado",
      color:
        "#ef4444",
      background:
        "rgba(239,68,68,.10)",
      border:
        "rgba(239,68,68,.25)",
    },

    REFUNDED: {
      label:
        "Reembolsado",
      color:
        "#ef4444",
      background:
        "rgba(239,68,68,.10)",
      border:
        "rgba(239,68,68,.25)",
    },
  };

  return (
    map[status] || {
      label:
        status || "Evento",
      color:
        "#f05a22",
      background:
        "rgba(240,90,34,.10)",
      border:
        "rgba(240,90,34,.25)",
    }
  );
}

export default function MyEventsPage() {
  const [
    form,
    setForm,
  ] = useState({
    email: "",
    phone: "",
  });

  const [
    events,
    setEvents,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function searchEvents(
    event
  ) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setEvents(null);

      const response =
        await fetch(
          "/api/my-events",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email:
                  form.email,
                phone:
                  form.phone,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "No fue posible consultar tus eventos."
        );
      }

      setEvents(
        data.events || []
      );
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setEvents(null);
    setError("");
  }

  return (
    <main className="my-events-page">
      <div className="my-events-shell">

        <header className="topbar">
          <div>
            <div className="eyebrow">
              JAVA TIMES CAFFÉ · EVENTS
            </div>

            <div className="topbar-copy">
              Consulta tus reservas y eventos
            </div>
          </div>

          <Link
            href="/"
            className="secondary-button"
          >
            Nueva cotización
          </Link>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow">
              MY EVENTS
            </div>

            <h1>
              Tus eventos Java
            </h1>

            <p>
              Consulta los eventos que has
              reservado con Java Coffee Cart,
              revisa su estatus y abre el
              comprobante de cada uno.
            </p>
          </div>

          <div className="explanation-card">
            <strong>
              ¿Qué necesito?
            </strong>

            <p>
              Utiliza exactamente el mismo
              correo electrónico y teléfono
              que proporcionaste cuando
              realizaste la reserva.
            </p>

            <div className="privacy-note">
              Tus eventos no aparecen
              públicamente. Debes proporcionar
              ambos datos para consultarlos.
            </div>
          </div>
        </section>

        {events === null ? (
          <section className="lookup-card">
            <div className="lookup-heading">
              <div>
                <div className="eyebrow">
                  IDENTIFÍCATE
                </div>

                <h2>
                  Encuentra tus eventos
                </h2>

                <p>
                  Ingresa los datos con los
                  que hiciste tu reservación.
                </p>
              </div>
            </div>

            <form
              onSubmit={
                searchEvents
              }
            >
              <div className="form-grid">

                <div className="field">
                  <label>
                    Correo electrónico
                  </label>

                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="correo@ejemplo.com"
                    value={
                      form.email
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email:
                          e.target
                            .value,
                      })
                    }
                  />

                  <small>
                    Usa el correo con el que
                    reservaste.
                  </small>
                </div>

                <div className="field">
                  <label>
                    Teléfono / WhatsApp
                  </label>

                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="8711234567"
                    value={
                      form.phone
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone:
                          e.target
                            .value,
                      })
                    }
                  />

                  <small>
                    Ingresa tus 10 dígitos.
                  </small>
                </div>

              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="primary-button search-button"
                disabled={
                  loading
                }
              >
                {loading
                  ? "Buscando..."
                  : "Ver mis eventos"}
              </button>
            </form>
          </section>
        ) : (
          <section>
            <div className="results-header">
              <div>
                <div className="eyebrow">
                  TUS RESERVAS
                </div>

                <h2>
                  {events.length ===
                  1
                    ? "Encontramos 1 evento"
                    : `Encontramos ${events.length} eventos`}
                </h2>
              </div>

              <button
                className="secondary-button"
                onClick={
                  clearSearch
                }
              >
                Buscar con otros datos
              </button>
            </div>

            {events.length ===
            0 ? (
              <div className="empty-card">
                <div className="empty-icon">
                  ☕
                </div>

                <h3>
                  No encontramos eventos
                </h3>

                <p>
                  No existe una reserva activa
                  que coincida con ese correo
                  y teléfono.
                </p>

                <p className="empty-help">
                  Revisa que estés usando
                  exactamente los mismos datos
                  que escribiste al reservar.
                </p>

                <button
                  className="primary-button"
                  onClick={
                    clearSearch
                  }
                >
                  Intentar de nuevo
                </button>
              </div>
            ) : (
              <div className="events-grid">
                {events.map(
                  (event) => (
                    <EventCard
                      key={
                        event.id
                      }
                      event={
                        event
                      }
                    />
                  )
                )}
              </div>
            )}
          </section>
        )}

        <footer>
          Java Times Caffé · Java Events
          <br />
          Tus reservas y pagos permanecen
          ligados a los datos utilizados al
          realizar tu evento.
        </footer>
      </div>

      <Styles />
    </main>
  );
}

function EventCard({
  event,
}) {
  const status =
    statusInfo(
      event.status
    );

  return (
    <article className="event-card">

      <div className="event-card-header">
        <div>
          <div className="event-number-label">
            NÚMERO DE EVENTO
          </div>

          <div className="event-number">
            {event.number}
          </div>
        </div>

        <div
          className="status-badge"
          style={{
            color:
              status.color,
            background:
              status.background,
            borderColor:
              status.border,
          }}
        >
          <span
            className="status-dot"
            style={{
              background:
                status.color,
            }}
          />

          {status.label}
        </div>
      </div>

      <div className="event-title">
        {event.eventType ||
          "Evento Java Coffee Cart"}
      </div>

      <div className="event-location">
        {event.venueName
          ? `${event.venueName} · `
          : ""}

        {event.city},{" "}
        {event.state}
      </div>

      <div className="event-info-grid">
        <EventInfo
          label="Fecha"
          value={dateLabel(
            event.eventDate
          )}
        />

        <EventInfo
          label="Hora"
          value={timeLabel(
            event.startTime
          )}
        />

        <EventInfo
          label="Invitados"
          value={String(
            event.guests
          )}
        />

        <EventInfo
          label="Duración"
          value={`${event.durationHours} horas`}
        />
      </div>

      <div className="financial-box">

        <MoneyRow
          label="Total del evento"
          value={
            event.total
          }
        />

        <MoneyRow
          label={
            event.paid
              ? "Anticipo pagado"
              : "Anticipo"
          }
          value={
            event.deposit
          }
        />

        <MoneyRow
          label="Saldo pendiente"
          value={
            event.balance
          }
          bold
        />

      </div>

      <Link
        href={`/confirmation/${event.id}`}
        className="primary-button open-event-button"
      >
        Ver evento completo
      </Link>
    </article>
  );
}

function EventInfo({
  label,
  value,
}) {
  return (
    <div className="event-info">
      <div className="event-info-label">
        {label}
      </div>

      <div className="event-info-value">
        {value}
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
        bold
          ? "money-row-bold"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <span>
        {money(value)}
      </span>
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

      .my-events-page {
        min-height: 100vh;
        background:
          radial-gradient(
            circle at top left,
            rgba(240, 90, 34, .12),
            transparent 30%
          ),
          #090909;
        color: white;
        padding: 28px 20px 70px;
      }

      .my-events-shell {
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        margin-bottom: 28px;
      }

      .topbar-copy {
        margin-top: 5px;
        color: #888;
        font-size: 13px;
      }

      .eyebrow {
        color: #ff7541;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 1.7px;
      }

      .hero {
        display: grid;
        grid-template-columns:
          minmax(0, 1.4fr)
          minmax(320px, .6fr);
        gap: 22px;
        margin-bottom: 22px;
      }

      .hero > div:first-child,
      .explanation-card,
      .lookup-card,
      .event-card,
      .empty-card {
        background: #141414;
        border: 1px solid #2b2b2b;
        border-radius: 24px;
      }

      .hero > div:first-child {
        padding: 34px;
      }

      .hero h1 {
        margin: 10px 0 14px;
        font-size: clamp(
          42px,
          7vw,
          72px
        );
        line-height: .95;
        letter-spacing: -2px;
      }

      .hero p {
        margin: 0;
        max-width: 650px;
        color: #aaa;
        font-size: 17px;
        line-height: 1.7;
      }

      .explanation-card {
        padding: 26px;
      }

      .explanation-card strong {
        font-size: 20px;
      }

      .explanation-card p {
        margin-top: 12px;
        font-size: 14px;
      }

      .privacy-note {
        margin-top: 20px;
        padding: 14px;
        background: rgba(
          240,
          90,
          34,
          .08
        );
        border: 1px solid rgba(
          240,
          90,
          34,
          .22
        );
        border-radius: 14px;
        color: #d1b7ad;
        line-height: 1.55;
        font-size: 13px;
      }

      .lookup-card {
        padding: 30px;
      }

      .lookup-heading h2,
      .results-header h2 {
        font-size: 30px;
        margin: 7px 0;
      }

      .lookup-heading p {
        color: #999;
        margin: 0 0 24px;
      }

      .form-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .field {
        display: grid;
        gap: 8px;
      }

      .field label {
        font-size: 14px;
        font-weight: 800;
      }

      .field input {
        width: 100%;
        border-radius: 14px;
        border: 1px solid #383838;
        background: #1b1b1b;
        color: white;
        padding: 15px 16px;
        font-size: 16px;
        outline: none;
      }

      .field input:focus {
        border-color: #f05a22;
        box-shadow:
          0 0 0 3px
          rgba(240, 90, 34, .12);
      }

      .field small {
        color: #777;
        line-height: 1.4;
      }

      .primary-button,
      .secondary-button {
        appearance: none;
        border-radius: 12px;
        padding: 13px 18px;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
        border: 1px solid transparent;
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .primary-button {
        background: #f05a22;
        color: white;
      }

      .primary-button:hover {
        background: #ff6931;
      }

      .secondary-button {
        background: #1b1b1b;
        color: white;
        border-color: #363636;
      }

      .search-button {
        margin-top: 22px;
        min-width: 190px;
      }

      button:disabled {
        opacity: .55;
        cursor: wait;
      }

      .error-message {
        margin-top: 18px;
        padding: 14px 16px;
        background: rgba(
          239,
          68,
          68,
          .10
        );
        color: #fca5a5;
        border: 1px solid rgba(
          239,
          68,
          68,
          .30
        );
        border-radius: 14px;
      }

      .results-header {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-end;
        margin: 30px 0 18px;
      }

      .events-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .event-card {
        padding: 24px;
        min-width: 0;
      }

      .event-card-header {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
      }

      .event-number-label {
        color: #777;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.3px;
      }

      .event-number {
        margin-top: 5px;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .status-badge {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        border: 1px solid;
        border-radius: 99px;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 99px;
      }

      .event-title {
        font-size: 25px;
        font-weight: 900;
        margin-top: 24px;
      }

      .event-location {
        color: #999;
        margin-top: 7px;
        line-height: 1.5;
      }

      .event-info-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 20px;
      }

      .event-info {
        padding: 13px;
        border-radius: 13px;
        background: #1b1b1b;
        border: 1px solid #292929;
      }

      .event-info-label {
        color: #777;
        font-size: 11px;
      }

      .event-info-value {
        font-weight: 750;
        margin-top: 5px;
        line-height: 1.4;
      }

      .financial-box {
        margin-top: 18px;
        background: #1a1a1a;
        border: 1px solid #292929;
        border-radius: 15px;
        padding: 8px 15px;
      }

      .money-row {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        padding: 11px 0;
        border-bottom: 1px solid #292929;
        color: #aaa;
      }

      .money-row:last-child {
        border-bottom: 0;
      }

      .money-row span:last-child {
        color: white;
        font-weight: 800;
        white-space: nowrap;
      }

      .money-row-bold {
        color: white;
        font-weight: 800;
      }

      .open-event-button {
        width: 100%;
        margin-top: 18px;
      }

      .empty-card {
        text-align: center;
        padding: 50px 25px;
      }

      .empty-icon {
        font-size: 40px;
      }

      .empty-card h3 {
        font-size: 26px;
        margin-bottom: 7px;
      }

      .empty-card p {
        color: #aaa;
        line-height: 1.6;
      }

      .empty-help {
        font-size: 13px;
      }

      footer {
        text-align: center;
        color: #555;
        font-size: 12px;
        line-height: 1.7;
        margin-top: 38px;
      }

      @media (
        max-width: 900px
      ) {
        .hero,
        .events-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (
        max-width: 650px
      ) {
        .my-events-page {
          padding: 16px 12px 50px;
        }

        .topbar,
        .results-header {
          flex-direction: column;
          align-items: stretch;
        }

        .hero > div:first-child,
        .explanation-card,
        .lookup-card,
        .event-card {
          padding: 20px;
          border-radius: 18px;
        }

        .hero h1 {
          font-size: 43px;
        }

        .form-grid,
        .event-info-grid {
          grid-template-columns: 1fr;
        }

        .event-card-header {
          flex-direction: column;
        }

        .status-badge {
          align-self: flex-start;
        }

        .search-button {
          width: 100%;
        }
      }
    `}</style>
  );
}