"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  formatMexicoPhoneInput,
  isValidMexicoPhone,
} from "@/lib/phone";

export default function Home() {
  // ============================================
  // EVENTO
  // ============================================

  const [
    serviceAreas,
    setServiceAreas,
  ] = useState([]);

  const [
    serviceAreaId,
    setServiceAreaId,
  ] = useState("");

  const [
    eventDate,
    setEventDate,
  ] = useState("");

  const [
    startTime,
    setStartTime,
  ] = useState("");

  const [
    guests,
    setGuests,
  ] = useState(50);

  const [
    hours,
    setHours,
  ] = useState(2);

  const [
    matchaBar,
    setMatchaBar,
  ] = useState(false);

  const [
    extraBarista,
    setExtraBarista,
  ] = useState(false);

  // ============================================
  // CLIENTE
  // ============================================

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    phoneError,
    setPhoneError,
  ] = useState("");

  const [
    eventType,
    setEventType,
  ] = useState("");

  const [
    eventAddress,
    setEventAddress,
  ] = useState("");

  // ============================================
  // RESULTADOS
  // ============================================

  const [
    quote,
    setQuote,
  ] = useState(null);

  const [
    availability,
    setAvailability,
  ] = useState(null);

  const [
    hold,
    setHold,
  ] = useState(null);

  const [
    secondsRemaining,
    setSecondsRemaining,
  ] = useState(0);

  // ============================================
  // LOADING
  // ============================================

  const [
    loadingCities,
    setLoadingCities,
  ] = useState(true);

  const [
    loadingQuote,
    setLoadingQuote,
  ] = useState(false);

  const [
    checkingAvailability,
    setCheckingAvailability,
  ] = useState(false);

  const [
    creatingHold,
    setCreatingHold,
  ] = useState(false);

  const [
    creatingCheckout,
    setCreatingCheckout,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  // ============================================
  // CARGAR CIUDADES
  // ============================================

  useEffect(() => {
    async function loadServiceAreas() {
      try {
        setLoadingCities(true);

        const response =
          await fetch(
            "/api/service-areas",
            {
              cache:
                "no-store",
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
              "No fue posible cargar las ciudades."
          );
        }

        const areas =
          data.serviceAreas ||
          [];

        setServiceAreas(
          areas
        );

        if (
          areas.length >
          0
        ) {
          setServiceAreaId(
            areas[0].id
          );
        }
      } catch (err) {
        setError(
          err.message
        );
      } finally {
        setLoadingCities(
          false
        );
      }
    }

    loadServiceAreas();
  }, []);

  // ============================================
  // TIMER
  // ============================================

  useEffect(() => {
    if (
      !hold?.expiresAt
    ) {
      return;
    }

    const updateTimer =
      () => {
        const seconds =
          Math.max(
            0,

            Math.floor(
              (
                new Date(
                  hold.expiresAt
                ).getTime() -
                Date.now()
              ) /
                1000
            )
          );

        setSecondsRemaining(
          seconds
        );
      };

    updateTimer();

    const interval =
      setInterval(
        updateTimer,
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [
    hold?.expiresAt,
  ]);

  // ============================================
  // HELPERS
  // ============================================

  function getServiceAreaId() {
    return (
      serviceAreaId ||
      serviceAreas[0]?.id ||
      ""
    );
  }

  function resetResults() {
    if (hold) {
      return;
    }

    setAvailability(
      null
    );

    setQuote(
      null
    );

    setError(
      ""
    );
  }

  function formatMoney(
    value
  ) {
    return new Intl.NumberFormat(
      "es-MX",
      {
        style:
          "currency",

        currency:
          "MXN",
      }
    ).format(
      value
    );
  }

  function formatDate(
    value
  ) {
    if (!value) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] =
      value
        .split("-")
        .map(Number);

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        day:
          "numeric",

        month:
          "long",

        year:
          "numeric",
      }
    ).format(
      new Date(
        year,
        month - 1,
        day
      )
    );
  }

  function formatTime(
    value
  ) {
    if (!value) {
      return "";
    }

    const [
      hour,
      minute,
    ] =
      value
        .slice(0, 5)
        .split(":")
        .map(Number);

    const date =
      new Date();

    date.setHours(
      hour,
      minute,
      0,
      0
    );

    return new Intl.DateTimeFormat(
      "es-MX",
      {
        hour:
          "numeric",

        minute:
          "2-digit",

        hour12:
          true,
      }
    ).format(
      date
    );
  }

  function formatCountdown(
    seconds
  ) {
    const minutes =
      Math.floor(
        seconds / 60
      );

    const remaining =
      seconds % 60;

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      remaining
    ).padStart(
      2,
      "0"
    )}`;
  }

  // ============================================
  // DISPONIBILIDAD
  // ============================================

  async function checkAvailability() {
    try {
      setCheckingAvailability(
        true
      );

      setError(
        ""
      );

      setAvailability(
        null
      );

      if (!eventDate) {
        throw new Error(
          "Selecciona la fecha."
        );
      }

      if (!startTime) {
        throw new Error(
          "Selecciona la hora."
        );
      }

      const response =
        await fetch(
          "/api/availability",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                serviceAreaId:
                  getServiceAreaId(),

                eventDate,

                startTime,

                hours:
                  Number(
                    hours
                  ),
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
            "No fue posible verificar disponibilidad."
        );
      }

      setAvailability(
        data
      );

      if (
        !data.available
      ) {
        setError(
          data.message ||
            "No hay disponibilidad."
        );
      }
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setCheckingAvailability(
        false
      );
    }
  }

  // ============================================
  // COTIZAR
  // ============================================

  async function calculateQuote() {
    try {
      setLoadingQuote(
        true
      );

      setError(
        ""
      );

      const response =
        await fetch(
          "/api/quote",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                serviceAreaId:
                  getServiceAreaId(),

                guests:
                  Number(
                    guests
                  ),

                hours:
                  Number(
                    hours
                  ),

                matchaBar,

                extraBarista,
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
            "No fue posible cotizar."
        );
      }

      setQuote(
        data
      );
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setLoadingQuote(
        false
      );
    }
  }

  // ============================================
  // HOLD
  // ============================================

  async function createHold() {
    try {
      setCreatingHold(
        true
      );

      setError(
        ""
      );

      setPhoneError(
        ""
      );

      if (
        !availability
          ?.available
      ) {
        throw new Error(
          "Primero verifica la disponibilidad."
        );
      }

      if (!quote) {
        throw new Error(
          "Primero genera la cotización."
        );
      }

      if (
        !customerName.trim()
      ) {
        throw new Error(
          "Escribe tu nombre."
        );
      }

      if (
        !email.trim()
      ) {
        throw new Error(
          "Escribe tu correo."
        );
      }

      if (
        !isValidMexicoPhone(
          phone
        )
      ) {
        setPhoneError(
          "Ingresa 10 dígitos. Ejemplo: 871 123 4567."
        );

        throw new Error(
          "Revisa tu número de WhatsApp."
        );
      }

      const response =
        await fetch(
          "/api/hold",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                serviceAreaId:
                  getServiceAreaId(),

                eventDate,

                startTime,

                guests:
                  Number(
                    guests
                  ),

                hours:
                  Number(
                    hours
                  ),

                matchaBar,

                extraBarista,

                customerName,

                email,

                phone,

                eventType,

                eventAddress,
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
            "No fue posible apartar la fecha."
        );
      }

      setHold(
        data.hold
      );

      setQuote({
        serviceArea:
          data.serviceArea,

        quote:
          data.quote,
      });
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setCreatingHold(
        false
      );
    }
  }

  // ============================================
  // CHECKOUT
  // ============================================

  async function continueToPayment() {
    try {
      setCreatingCheckout(
        true
      );

      setError(
        ""
      );

      if (
        !hold?.bookingId
      ) {
        throw new Error(
          "No encontramos la reservación."
        );
      }

      const response =
        await fetch(
          "/api/checkout",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                bookingId:
                  hold.bookingId,
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
            "No fue posible iniciar el pago."
        );
      }

      if (
        data.holdExpiresAt
      ) {
        setHold(
          (current) => ({
            ...current,

            expiresAt:
              data.holdExpiresAt,
          })
        );
      }

      if (
        data.alreadyPaid
      ) {
        throw new Error(
          data.message ||
            "Este evento ya está pagado."
        );
      }

      if (
        !data.checkoutUrl
      ) {
        throw new Error(
          "Shopify no devolvió un enlace de pago."
        );
      }

      window.location.assign(
        data.checkoutUrl
      );
    } catch (err) {
      setError(
        err.message
      );

      console.error(
        err
      );
    } finally {
      setCreatingCheckout(
        false
      );
    }
  }

  // ============================================
  // UI
  // ============================================

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.brand}>
            JAVA TIMES CAFFÉ
          </div>

          <h1 style={styles.title}>
            Java Coffee Cart
          </h1>

          <p style={styles.subtitle}>
            Cotiza, consulta disponibilidad y reserva tu evento.
          </p>
        </div>

        <div style={styles.card}>
          <FieldLabel>
            Ciudad del evento
          </FieldLabel>

          <select
            value={
              serviceAreaId
            }
            disabled={
              loadingCities ||
              Boolean(hold)
            }
            onChange={(e) => {
              setServiceAreaId(
                e.target.value
              );

              resetResults();
            }}
            style={styles.input}
          >
            {serviceAreas.map(
              (area) => (
                <option
                  key={area.id}
                  value={area.id}
                >
                  {area.city},{" "}
                  {area.state}
                </option>
              )
            )}
          </select>

          <FieldLabel>
            Fecha del evento
          </FieldLabel>

          <input
            type="date"
            value={eventDate}
            disabled={
              Boolean(hold)
            }
            onChange={(e) => {
              setEventDate(
                e.target.value
              );

              resetResults();
            }}
            style={styles.input}
          />

          <FieldLabel>
            Hora de inicio
          </FieldLabel>

          <select
            value={startTime}
            disabled={
              Boolean(hold)
            }
            onChange={(e) => {
              setStartTime(
                e.target.value
              );

              resetResults();
            }}
            style={styles.input}
          >
            <option value="">
              Selecciona una hora
            </option>

            {[
              ["08:00", "8:00 AM"],
              ["09:00", "9:00 AM"],
              ["10:00", "10:00 AM"],
              ["11:00", "11:00 AM"],
              ["12:00", "12:00 PM"],
              ["13:00", "1:00 PM"],
              ["14:00", "2:00 PM"],
              ["15:00", "3:00 PM"],
              ["16:00", "4:00 PM"],
              ["17:00", "5:00 PM"],
              ["18:00", "6:00 PM"],
              ["19:00", "7:00 PM"],
              ["20:00", "8:00 PM"],
            ].map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>

          <FieldLabel>
            Número de invitados
          </FieldLabel>

          <input
            type="number"
            min="1"
            value={guests}
            disabled={
              Boolean(hold)
            }
            onChange={(e) => {
              setGuests(
                e.target.value
              );

              setQuote(null);
            }}
            style={styles.input}
          />

          <FieldLabel>
            Duración
          </FieldLabel>

          <select
            value={hours}
            disabled={
              Boolean(hold)
            }
            onChange={(e) => {
              setHours(
                e.target.value
              );

              resetResults();
            }}
            style={styles.input}
          >
            <option value="2">
              2 horas
            </option>

            <option value="3">
              3 horas
            </option>

            <option value="4">
              4 horas
            </option>

            <option value="5">
              5 horas
            </option>
          </select>

          <div style={styles.extras}>
            <label>
              <input
                type="checkbox"
                checked={
                  matchaBar
                }
                disabled={
                  Boolean(hold)
                }
                onChange={(e) => {
                  setMatchaBar(
                    e.target.checked
                  );

                  setQuote(null);
                }}
              />{" "}
              Matcha Bar
            </label>

            <label>
              <input
                type="checkbox"
                checked={
                  extraBarista
                }
                disabled={
                  Boolean(hold)
                }
                onChange={(e) => {
                  setExtraBarista(
                    e.target.checked
                  );

                  setQuote(null);
                }}
              />{" "}
              Barista adicional
            </label>
          </div>

          {!hold && (
            <>
              <button
                onClick={
                  checkAvailability
                }
                disabled={
                  checkingAvailability
                }
                style={
                  styles.secondaryButton
                }
              >
                {checkingAvailability
                  ? "Verificando..."
                  : "Verificar disponibilidad"}
              </button>

              {availability?.available && (
                <div
                  style={
                    styles.success
                  }
                >
                  <strong>
                    ✓ Java Coffee Cart disponible
                  </strong>

                  <div>
                    {formatDate(
                      eventDate
                    )}
                  </div>

                  <div>
                    {formatTime(
                      startTime
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={
                  calculateQuote
                }
                disabled={
                  loadingQuote
                }
                style={
                  styles.primaryButton
                }
              >
                {loadingQuote
                  ? "Calculando..."
                  : "Cotizar evento"}
              </button>
            </>
          )}

          {quote && (
            <div style={styles.quote}>
              <div style={styles.small}>
                TU EVENTO JAVA
              </div>

              <h2>
                {
                  quote
                    .serviceArea
                    .city
                }
              </h2>

              <div>
                {formatDate(
                  eventDate
                )}
              </div>

              <div>
                {formatTime(
                  startTime
                )}
              </div>

              <p>
                {guests} invitados ·{" "}
                {hours} horas
              </p>

              <div style={styles.muted}>
                Total estimado
              </div>

              <div style={styles.total}>
                {formatMoney(
                  quote.quote.total
                )}
              </div>

              <p>
                Anticipo:{" "}
                <strong>
                  {formatMoney(
                    quote.quote.deposit
                  )}
                </strong>
              </p>

              <div style={styles.muted}>
                Saldo:{" "}
                {formatMoney(
                  quote.quote.balance
                )}
              </div>
            </div>
          )}

          {availability?.available &&
            quote &&
            !hold && (
              <div
                style={
                  styles.customer
                }
              >
                <h2>
                  Aparta tu fecha
                </h2>

                <FieldLabel>
                  Nombre completo
                </FieldLabel>

                <input
                  value={
                    customerName
                  }
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <FieldLabel>
                  Correo electrónico
                </FieldLabel>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <FieldLabel>
                  WhatsApp
                </FieldLabel>

                <div
                  style={
                    styles.phoneRow
                  }
                >
                  <div
                    style={
                      styles.countryCode
                    }
                  >
                    🇲🇽 +52
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="871 123 4567"
                    value={phone}
                    onChange={(e) => {
                      const formatted =
                        formatMexicoPhoneInput(
                          e.target.value
                        );

                      setPhone(
                        formatted
                      );

                      if (
                        !formatted ||
                        isValidMexicoPhone(
                          formatted
                        )
                      ) {
                        setPhoneError(
                          ""
                        );
                      }
                    }}
                    onBlur={() => {
                      if (
                        phone &&
                        !isValidMexicoPhone(
                          phone
                        )
                      ) {
                        setPhoneError(
                          "Ingresa los 10 dígitos de tu celular."
                        );
                      }
                    }}
                    style={
                      styles.phoneInput
                    }
                  />
                </div>

                {phoneError && (
                  <div
                    style={
                      styles.fieldError
                    }
                  >
                    {phoneError}
                  </div>
                )}

                <div
                  style={
                    styles.help
                  }
                >
                  Lo guardaremos como
                  +52 y tu número de 10 dígitos.
                </div>

                <FieldLabel>
                  Tipo de evento
                </FieldLabel>

                <select
                  value={eventType}
                  onChange={(e) =>
                    setEventType(
                      e.target.value
                    )
                  }
                  style={styles.input}
                >
                  <option value="">
                    Selecciona
                  </option>

                  <option value="Corporativo">
                    Corporativo
                  </option>

                  <option value="Boda">
                    Boda
                  </option>

                  <option value="Cumpleaños">
                    Cumpleaños
                  </option>

                  <option value="Universidad">
                    Universidad
                  </option>

                  <option value="Expo">
                    Expo
                  </option>

                  <option value="Evento privado">
                    Evento privado
                  </option>

                  <option value="Otro">
                    Otro
                  </option>
                </select>

                <FieldLabel>
                  Dirección del evento
                </FieldLabel>

                <input
                  value={
                    eventAddress
                  }
                  placeholder="Calle, número, colonia..."
                  onChange={(e) =>
                    setEventAddress(
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <button
                  onClick={
                    createHold
                  }
                  disabled={
                    creatingHold ||
                    !isValidMexicoPhone(
                      phone
                    )
                  }
                  style={{
                    ...styles.reserveButton,

                    opacity:
                      isValidMexicoPhone(
                        phone
                      )
                        ? 1
                        : 0.55,
                  }}
                >
                  {creatingHold
                    ? "Apartando..."
                    : "Apartar fecha 15 minutos"}
                </button>
              </div>
            )}

          {hold && (
            <div style={styles.hold}>
              <h2>
                ✓ Fecha apartada
              </h2>

              {secondsRemaining >
              0 ? (
                <>
                  <div style={styles.timer}>
                    {formatCountdown(
                      secondsRemaining
                    )}
                  </div>

                  <p style={styles.muted}>
                    Tiempo restante para iniciar el pago.
                  </p>

                  <button
                    onClick={
                      continueToPayment
                    }
                    disabled={
                      creatingCheckout
                    }
                    style={
                      styles.paymentButton
                    }
                  >
                    {creatingCheckout
                      ? "Preparando Shopify..."
                      : "Continuar al pago"}
                  </button>

                  <div style={styles.help}>
                    El cliente y su teléfono quedarán asociados en Shopify.
                  </div>
                </>
              ) : (
                <div style={styles.error}>
                  El tiempo de apartado terminó.
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function FieldLabel({
  children,
}) {
  return (
    <label
      style={{
        display:
          "block",

        fontWeight:
          500,
      }}
    >
      {children}
    </label>
  );
}

const styles = {
  main: {
    minHeight:
      "100vh",

    background:
      "#111",

    color:
      "#fff",

    padding:
      "50px 20px",

    fontFamily:
      "Arial, sans-serif",
  },

  container: {
    maxWidth:
      "700px",

    margin:
      "0 auto",
  },

  header: {
    marginBottom:
      "40px",
  },

  brand: {
    fontSize:
      "14px",

    letterSpacing:
      "2px",
  },

  title: {
    fontSize:
      "42px",

    marginBottom:
      "8px",
  },

  subtitle: {
    color:
      "#bbb",

    fontSize:
      "18px",
  },

  card: {
    background:
      "#1c1c1c",

    padding:
      "30px",

    borderRadius:
      "16px",
  },

  input: {
    width:
      "100%",

    boxSizing:
      "border-box",

    padding:
      "14px",

    marginTop:
      "8px",

    marginBottom:
      "22px",

    background:
      "#292929",

    color:
      "#fff",

    border:
      "1px solid #444",

    borderRadius:
      "8px",

    fontSize:
      "16px",
  },

  extras: {
    display:
      "grid",

    gap:
      "14px",

    marginBottom:
      "25px",
  },

  secondaryButton: {
    width:
      "100%",

    padding:
      "16px",

    background:
      "#252525",

    color:
      "#fff",

    border:
      "1px solid #666",

    borderRadius:
      "9px",

    fontWeight:
      "bold",

    cursor:
      "pointer",

    marginBottom:
      "15px",
  },

  primaryButton: {
    width:
      "100%",

    padding:
      "17px",

    background:
      "#888",

    color:
      "#fff",

    border:
      0,

    borderRadius:
      "9px",

    fontSize:
      "17px",

    fontWeight:
      "bold",

    cursor:
      "pointer",
  },

  success: {
    padding:
      "16px",

    marginBottom:
      "18px",

    background:
      "#123f23",

    border:
      "1px solid #24743c",

    borderRadius:
      "8px",

    lineHeight:
      1.6,
  },

  quote: {
    marginTop:
      "30px",

    paddingTop:
      "30px",

    borderTop:
      "1px solid #444",
  },

  small: {
    color:
      "#aaa",

    fontSize:
      "13px",

    letterSpacing:
      "1.5px",
  },

  total: {
    fontSize:
      "38px",

    fontWeight:
      "bold",

    marginTop:
      "5px",
  },

  muted: {
    color:
      "#aaa",
  },

  customer: {
    marginTop:
      "35px",

    paddingTop:
      "30px",

    borderTop:
      "1px solid #444",
  },

  phoneRow: {
    display:
      "flex",

    marginTop:
      "8px",

    marginBottom:
      "6px",
  },

  countryCode: {
    display:
      "flex",

    alignItems:
      "center",

    padding:
      "0 14px",

    background:
      "#222",

    border:
      "1px solid #444",

    borderRight:
      0,

    borderRadius:
      "8px 0 0 8px",

    whiteSpace:
      "nowrap",
  },

  phoneInput: {
    flex:
      1,

    minWidth:
      0,

    padding:
      "14px",

    background:
      "#292929",

    color:
      "#fff",

    border:
      "1px solid #444",

    borderRadius:
      "0 8px 8px 0",

    fontSize:
      "16px",

    boxSizing:
      "border-box",
  },

  fieldError: {
    color:
      "#ff9999",

    fontSize:
      "14px",

    marginBottom:
      "6px",
  },

  help: {
    color:
      "#999",

    fontSize:
      "13px",

    lineHeight:
      1.5,

    marginBottom:
      "20px",
  },

  reserveButton: {
    width:
      "100%",

    padding:
      "18px",

    background:
      "#fff",

    color:
      "#111",

    border:
      0,

    borderRadius:
      "9px",

    fontSize:
      "17px",

    fontWeight:
      "bold",

    cursor:
      "pointer",
  },

  hold: {
    marginTop:
      "30px",

    padding:
      "25px",

    textAlign:
      "center",

    background:
      "#172a1c",

    border:
      "1px solid #296b3a",

    borderRadius:
      "12px",
  },

  timer: {
    fontSize:
      "48px",

    fontWeight:
      "bold",

    margin:
      "20px 0",
  },

  paymentButton: {
    width:
      "100%",

    padding:
      "18px",

    background:
      "#fff",

    color:
      "#111",

    border:
      0,

    borderRadius:
      "9px",

    fontSize:
      "18px",

    fontWeight:
      "bold",

    cursor:
      "pointer",

    marginTop:
      "20px",

    marginBottom:
      "15px",
  },

  error: {
    marginTop:
      "20px",

    padding:
      "15px",

    background:
      "#381818",

    border:
      "1px solid #682727",

    borderRadius:
      "8px",
  },
};