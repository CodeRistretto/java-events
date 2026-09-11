"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

function money(value) {
  return new Intl.NumberFormat(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
    }
  ).format(Number(value || 0));
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

function statusLabel(status) {
  switch (status) {
    case "CONFIRMED":
      return {
        title:
          "Evento confirmado",
        text:
          "Recibimos tu pago. Tu evento está confirmado.",
        color:
          "#22c55e",
      };

    case "PAYMENT_PENDING":
      return {
        title:
          "Esperando tu pago",
        text:
          "Completa el pago del anticipo en Shopify. Esta página se actualizará automáticamente.",
        color:
          "#f59e0b",
      };

    case "HOLD":
      return {
        title:
          "Fecha apartada temporalmente",
        text:
          "La fecha está apartada, pero todavía no has iniciado el pago.",
        color:
          "#f59e0b",
      };

    case "EXPIRED":
      return {
        title:
          "Apartado vencido",
        text:
          "El tiempo para completar el pago terminó.",
        color:
          "#ef4444",
      };

    default:
      return {
        title:
          status || "Evento",
        text:
          "Consulta el estado de tu evento.",
        color:
          "#f05a22",
      };
  }
}

function itemLabel(item) {
  if (
    item.code ===
    "HOT_COFFEE_SERVICE"
  ) {
    return `Servicio base Java Coffee Cart para ${item.quantity} invitados`;
  }

  if (
    item.code ===
    "COLD_BEVERAGES"
  ) {
    return `Bebidas frías para ${item.quantity} invitados`;
  }

  if (
    item.code ===
    "ADDITIONAL_HOUR"
  ) {
    return `${item.quantity} hora(s) adicional(es)`;
  }

  return item.name;
}

function itemCalculation(item) {
  if (
    item.pricingType ===
    "PER_GUEST"
  ) {
    return `${item.quantity} invitados × ${money(
      item.unitPrice
    )}`;
  }

  if (
    item.pricingType ===
    "PER_HOUR"
  ) {
    return `${item.quantity} hora(s) × ${money(
      item.unitPrice
    )}`;
  }

  if (
    item.pricingType ===
    "PER_UNIT"
  ) {
    return `${item.quantity} unidad(es) × ${money(
      item.unitPrice
    )}`;
  }

  if (
    item.pricingType ===
    "PER_EVENT"
  ) {
    return "Precio fijo por evento";
  }

  return "";
}

export default function ConfirmationPage() {
  const params =
    useParams();

  const bookingId =
    params?.bookingId;

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function loadEvent() {
    if (!bookingId) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/confirmation/${bookingId}`,
          {
            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "No fue posible cargar el evento."
        );
      }

      setData(result);
      setError("");
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvent();
  }, [bookingId]);

  useEffect(() => {
    const status =
      data?.event?.status;

    if (
      ![
        "HOLD",
        "PAYMENT_PENDING",
        "PAID",
        "DEPOSIT_PAID",
      ].includes(status)
    ) {
      return;
    }

    const interval =
      setInterval(
        () => {
          loadEvent();
        },
        3000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [
    bookingId,
    data?.event?.status,
  ]);

  if (loading) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          background:
            "#090909",
          color:
            "white",
          padding:
            "50px 20px",
        }}
      >
        <div
          style={{
            maxWidth:
              1000,
            margin:
              "0 auto",
          }}
        >
          Cargando tu evento...
        </div>
      </main>
    );
  }

  if (
    error ||
    !data?.event
  ) {
    return (
      <main
        style={{
          minHeight:
            "100vh",
          background:
            "#090909",
          color:
            "white",
          padding:
            "50px 20px",
        }}
      >
        <div
          style={{
            maxWidth:
              900,
            margin:
              "0 auto",
            background:
              "#141414",
            border:
              "1px solid #333",
            borderRadius:
              24,
            padding:
              30,
          }}
        >
          <h1>
            No pudimos cargar tu evento
          </h1>

          <p>
            {error}
          </p>

          <button
            onClick={
              loadEvent
            }
            style={{
              marginTop:
                20,
              background:
                "#f05a22",
              color:
                "white",
              border:
                0,
              borderRadius:
                12,
              padding:
                "14px 20px",
              cursor:
                "pointer",
              fontWeight:
                700,
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </main>
    );
  }

  const event =
    data.event;

  const status =
    statusLabel(
      event.status
    );

  const confirmed =
    event.status ===
    "CONFIRMED";

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "#090909",
        color:
          "white",
        padding:
          "40px 20px 80px",
      }}
    >
      <div
        style={{
          maxWidth:
            1100,
          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            color:
              "#ff7a45",
            fontSize:
              13,
            fontWeight:
              700,
            letterSpacing:
              2,
            marginBottom:
              14,
          }}
        >
          JAVA TIMES CAFFÉ · EVENTS
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(280px, .7fr)",
            gap:
              24,
            marginBottom:
              24,
          }}
        >
          <section
            style={{
              background:
                "#141414",
              border:
                "1px solid #2d2d2d",
              borderRadius:
                24,
              padding:
                30,
            }}
          >
            <h1
              style={{
                fontSize:
                  44,
                margin:
                  0,
                lineHeight:
                  1.05,
              }}
            >
              {confirmed
                ? "Tu evento está confirmado"
                : "Estamos esperando tu pago"}
            </h1>

            <p
              style={{
                color:
                  "#bbb",
                fontSize:
                  18,
                lineHeight:
                  1.6,
                maxWidth:
                  700,
              }}
            >
              Aquí puedes revisar
              exactamente qué
              contrataste, cuánto
              cuesta tu evento,
              cuánto pagas hoy y
              cuánto quedará
              pendiente.
            </p>
          </section>

          <section
            style={{
              background:
                "#141414",
              border:
                "1px solid #2d2d2d",
              borderRadius:
                24,
              padding:
                24,
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap:
                  10,
              }}
            >
              <div
                style={{
                  width:
                    12,
                  height:
                    12,
                  borderRadius:
                    99,
                  background:
                    status.color,
                }}
              />

              <strong
                style={{
                  fontSize:
                    22,
                }}
              >
                {status.title}
              </strong>
            </div>

            <p
              style={{
                color:
                  "#aaa",
                lineHeight:
                  1.6,
              }}
            >
              {status.text}
            </p>

            <div
              style={{
                marginTop:
                  20,
                padding:
                  16,
                borderRadius:
                  14,
                background:
                  "#1d1d1d",
              }}
            >
              <div
                style={{
                  color:
                    "#999",
                  fontSize:
                    12,
                }}
              >
                NÚMERO DE EVENTO
              </div>

              <div
                style={{
                  marginTop:
                    6,
                  fontSize:
                    18,
                  fontWeight:
                    800,
                }}
              >
                {event.number}
              </div>
            </div>
          </section>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(300px, .7fr)",
            gap:
              24,
          }}
        >
          <section
            style={{
              background:
                "#141414",
              border:
                "1px solid #2d2d2d",
              borderRadius:
                24,
              padding:
                28,
            }}
          >
            <h2>
              Lo que contrataste
            </h2>

            <div
              style={{
                background:
                  "#1a1a1a",
                borderRadius:
                  16,
                padding:
                  18,
                marginBottom:
                  20,
              }}
            >
              <strong>
                Servicio base
              </strong>

              <p
                style={{
                  color:
                    "#aaa",
                  lineHeight:
                    1.6,
                  marginBottom:
                    0,
                }}
              >
                Coffee Cart,
                equipo, montaje,
                personal asignado
                y servicio de
                espresso,
                americano,
                cappuccino, latte,
                mocha y té caliente
                para el número de
                invitados
                contratado.
              </p>
            </div>

            {data.items.map(
              (item) => (
                <div
                  key={
                    item.id
                  }
                  style={{
                    padding:
                      "14px 0",
                    borderBottom:
                      "1px solid #2a2a2a",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap:
                        20,
                    }}
                  >
                    <strong>
                      {itemLabel(
                        item
                      )}
                    </strong>

                    <strong>
                      {money(
                        item.lineTotal
                      )}
                    </strong>
                  </div>

                  <div
                    style={{
                      color:
                        "#999",
                      fontSize:
                        13,
                      marginTop:
                        4,
                    }}
                  >
                    {itemCalculation(
                      item
                    )}
                  </div>
                </div>
              )
            )}

            <h2
              style={{
                marginTop:
                  32,
              }}
            >
              Datos del evento
            </h2>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap:
                  12,
              }}
            >
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
                label="Hora"
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
              />
            </div>
          </section>

          <aside
            style={{
              background:
                "#141414",
              border:
                "1px solid #2d2d2d",
              borderRadius:
                24,
              padding:
                28,
              height:
                "fit-content",
            }}
          >
            <h2>
              Resumen de pago
            </h2>

            {event.subtotal !==
              null && (
              <MoneyRow
                label="Subtotal del evento"
                value={
                  event.subtotal
                }
              />
            )}

            {event.vat !==
              null && (
              <MoneyRow
                label={`IVA ${
                  event.vatPercent !==
                  null
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
              value={event.total}
              bold
            />

            <div
              style={{
                marginTop:
                  22,
                background:
                  "#1d1d1d",
                borderRadius:
                  18,
                padding:
                  20,
              }}
            >
              <div
                style={{
                  color:
                    "#ff7a45",
                  fontSize:
                    12,
                  fontWeight:
                    800,
                  letterSpacing:
                    1.3,
                }}
              >
                PAGO DE HOY
              </div>

              <div
                style={{
                  fontSize:
                    36,
                  fontWeight:
                    800,
                  marginTop:
                    6,
                }}
              >
                {money(
                  event.deposit
                )}
              </div>

              <p
                style={{
                  color:
                    "#aaa",
                  lineHeight:
                    1.5,
                }}
              >
                Anticipo para
                apartar la fecha.
              </p>

              {event.depositSubtotal !==
                null && (
                <>
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
                </>
              )}
            </div>

            <div
              style={{
                marginTop:
                  18,
              }}
            >
              <MoneyRow
                label="Saldo pendiente"
                value={
                  event.balance
                }
                bold
              />
            </div>

            <div
              style={{
                marginTop:
                  22,
                color:
                  "#ccc",
                lineHeight:
                  1.6,
                background:
                  "#23150f",
                border:
                  "1px solid #66301b",
                borderRadius:
                  16,
                padding:
                  16,
              }}
            >
              <strong>
                Importante:
              </strong>{" "}
              hoy no estás
              pagando todo el
              evento. Estás
              pagando únicamente
              el anticipo para
              apartar la fecha.
            </div>

            {event.status ===
              "PAYMENT_PENDING" && (
              <div
                style={{
                  marginTop:
                    18,
                  color:
                    "#fde68a",
                  lineHeight:
                    1.5,
                }}
              >
                Esta página se
                actualiza
                automáticamente
                mientras esperamos
                el pago.
              </div>
            )}

            {confirmed && (
              <div
                style={{
                  marginTop:
                    18,
                  color:
                    "#86efac",
                  lineHeight:
                    1.5,
                }}
              >
                ✓ Pago recibido.
                Tu evento está
                confirmado.
              </div>
            )}

            <button
              onClick={
                loadEvent
              }
              style={{
                width:
                  "100%",
                marginTop:
                  22,
                background:
                  "#f05a22",
                color:
                  "white",
                border:
                  0,
                borderRadius:
                  12,
                padding:
                  "14px 18px",
                fontWeight:
                  800,
                cursor:
                  "pointer",
              }}
            >
              Actualizar estado
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <div
      style={{
        background:
          "#1a1a1a",
        border:
          "1px solid #292929",
        borderRadius:
          14,
        padding:
          14,
      }}
    >
      <div
        style={{
          color:
            "#999",
          fontSize:
            12,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            6,
          fontWeight:
            700,
          lineHeight:
            1.45,
        }}
      >
        {value ||
          "—"}
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
      style={{
        display:
          "flex",
        justifyContent:
          "space-between",
        gap:
          14,
        padding:
          "10px 0",
        borderBottom:
          "1px solid #292929",
        fontWeight:
          bold ? 800 : 400,
      }}
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