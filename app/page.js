"use client";

import {
  useEffect,
  useState,
} from "react";

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
        setError("");

        const response =
          await fetch(
            "/api/service-areas",
            {
              cache: "no-store",
            }
          );

        const text =
          await response.text();

        if (!text) {
          throw new Error(
            "El servidor no devolvió ciudades."
          );
        }

        const data =
          JSON.parse(text);

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
          data.serviceAreas || [];

        setServiceAreas(
          areas
        );

        if (
          areas.length > 0
        ) {
          setServiceAreaId(
            areas[0].id
          );
        }
      } catch (err) {
        console.error(
          "Service areas:",
          err
        );

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
  // CUENTA REGRESIVA HOLD
  // ============================================

  useEffect(() => {
    if (
      !hold?.expiresAt
    ) {
      return;
    }

    function updateTimer() {
      const expiration =
        new Date(
          hold.expiresAt
        ).getTime();

      const now =
        Date.now();

      const seconds =
        Math.max(
          0,
          Math.floor(
            (expiration -
              now) /
              1000
          )
        );

      setSecondsRemaining(
        seconds
      );
    }

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
  }, [hold]);

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
    amount
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
      amount
    );
  }

  function formatDate(
    date
  ) {
    if (!date) {
      return "";
    }

    const [
      year,
      month,
      day,
    ] =
      date
        .split("-")
        .map(Number);

    const localDate =
      new Date(
        year,
        month - 1,
        day
      );

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
      localDate
    );
  }

  function formatTime(
    time
  ) {
    if (!time) {
      return "";
    }

    const [
      hour,
      minute,
    ] =
      time
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

    const remainingSeconds =
      seconds % 60;

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      remainingSeconds
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

      const selectedServiceAreaId =
        getServiceAreaId();

      if (
        !selectedServiceAreaId
      ) {
        throw new Error(
          "Selecciona una ciudad."
        );
      }

      if (
        !eventDate
      ) {
        throw new Error(
          "Selecciona la fecha."
        );
      }

      if (
        !startTime
      ) {
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
              JSON.stringify(
                {
                  serviceAreaId:
                    selectedServiceAreaId,

                  eventDate,

                  startTime,

                  hours:
                    Number(
                      hours
                    ),
                }
              ),
          }
        );

      const text =
        await response.text();

      if (!text) {
        throw new Error(
          "No se recibió respuesta de disponibilidad."
        );
      }

      const data =
        JSON.parse(text);

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
      console.error(
        "Availability:",
        err
      );

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

      setQuote(
        null
      );

      const selectedServiceAreaId =
        getServiceAreaId();

      if (
        !selectedServiceAreaId
      ) {
        throw new Error(
          "Selecciona una ciudad."
        );
      }

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
              JSON.stringify(
                {
                  serviceAreaId:
                    selectedServiceAreaId,

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
                }
              ),
          }
        );

      const text =
        await response.text();

      if (!text) {
        throw new Error(
          "No se recibió cotización."
        );
      }

      const data =
        JSON.parse(text);

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
      console.error(
        "Quote:",
        err
      );

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
  // CREAR HOLD
  // ============================================

  async function createHold() {
    try {
      setCreatingHold(
        true
      );

      setError(
        ""
      );

      if (
        !availability?.available
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
          "Escribe tu correo electrónico."
        );
      }

      if (
        !phone.trim()
      ) {
        throw new Error(
          "Escribe tu número de WhatsApp."
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
              JSON.stringify(
                {
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
                }
              ),
          }
        );

      const text =
        await response.text();

      if (!text) {
        throw new Error(
          "No se recibió respuesta al apartar la fecha."
        );
      }

      const data =
        JSON.parse(text);

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

      setQuote(
        {
          serviceArea:
            data.serviceArea,

          quote:
            data.quote,
        }
      );
    } catch (err) {
      console.error(
        "Hold:",
        err
      );

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
  // UI
  // ============================================

  return (
    <main
      style={
        mainStyle
      }
    >
      <div
        style={
          containerStyle
        }
      >
        <div
          style={
            headerStyle
          }
        >
          <div
            style={
              brandStyle
            }
          >
            JAVA TIMES CAFFÉ
          </div>

          <h1
            style={
              titleStyle
            }
          >
            Java Coffee Cart
          </h1>

          <p
            style={
              subtitleStyle
            }
          >
            Cotiza, consulta disponibilidad
            y aparta tu evento.
          </p>
        </div>

        <div
          style={
            cardStyle
          }
        >
          {/* CIUDAD */}

          <label
            style={
              labelStyle
            }
          >
            Ciudad del evento
          </label>

          <select
            value={
              serviceAreaId
            }

            disabled={
              loadingCities ||
              Boolean(hold)
            }

            onChange={(
              e
            ) => {
              setServiceAreaId(
                e.target.value
              );

              resetResults();
            }}

            style={
              inputStyle
            }
          >
            {loadingCities && (
              <option value="">
                Cargando...
              </option>
            )}

            {serviceAreas.map(
              (area) => (
                <option
                  key={
                    area.id
                  }

                  value={
                    area.id
                  }
                >
                  {
                    area.city
                  }
                  ,{" "}
                  {
                    area.state
                  }
                </option>
              )
            )}
          </select>

          {/* FECHA */}

          <label
            style={
              labelStyle
            }
          >
            Fecha del evento
          </label>

          <input
            type="date"

            value={
              eventDate
            }

            disabled={
              Boolean(hold)
            }

            onChange={(
              e
            ) => {
              setEventDate(
                e.target.value
              );

              resetResults();
            }}

            style={
              inputStyle
            }
          />

          {/* HORA */}

          <label
            style={
              labelStyle
            }
          >
            Hora de inicio
          </label>

          <select
            value={
              startTime
            }

            disabled={
              Boolean(hold)
            }

            onChange={(
              e
            ) => {
              setStartTime(
                e.target.value
              );

              resetResults();
            }}

            style={
              inputStyle
            }
          >
            <option value="">
              Selecciona una hora
            </option>

            <option value="08:00">
              8:00 AM
            </option>

            <option value="09:00">
              9:00 AM
            </option>

            <option value="10:00">
              10:00 AM
            </option>

            <option value="11:00">
              11:00 AM
            </option>

            <option value="12:00">
              12:00 PM
            </option>

            <option value="13:00">
              1:00 PM
            </option>

            <option value="14:00">
              2:00 PM
            </option>

            <option value="15:00">
              3:00 PM
            </option>

            <option value="16:00">
              4:00 PM
            </option>

            <option value="17:00">
              5:00 PM
            </option>

            <option value="18:00">
              6:00 PM
            </option>

            <option value="19:00">
              7:00 PM
            </option>

            <option value="20:00">
              8:00 PM
            </option>
          </select>

          {/* INVITADOS */}

          <label
            style={
              labelStyle
            }
          >
            Número de invitados
          </label>

          <input
            type="number"

            min="1"

            value={
              guests
            }

            disabled={
              Boolean(hold)
            }

            onChange={(
              e
            ) => {
              setGuests(
                e.target.value
              );

              setQuote(
                null
              );
            }}

            style={
              inputStyle
            }
          />

          {/* DURACIÓN */}

          <label
            style={
              labelStyle
            }
          >
            Duración
          </label>

          <select
            value={
              hours
            }

            disabled={
              Boolean(hold)
            }

            onChange={(
              e
            ) => {
              setHours(
                e.target.value
              );

              resetResults();
            }}

            style={
              inputStyle
            }
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

          {/* EXTRAS */}

          <div
            style={
              extrasStyle
            }
          >
            <label
              style={
                checkboxStyle
              }
            >
              <input
                type="checkbox"

                checked={
                  matchaBar
                }

                disabled={
                  Boolean(hold)
                }

                onChange={(
                  e
                ) => {
                  setMatchaBar(
                    e.target.checked
                  );

                  setQuote(
                    null
                  );
                }}
              />

              Matcha Bar
            </label>

            <label
              style={
                checkboxStyle
              }
            >
              <input
                type="checkbox"

                checked={
                  extraBarista
                }

                disabled={
                  Boolean(hold)
                }

                onChange={(
                  e
                ) => {
                  setExtraBarista(
                    e.target.checked
                  );

                  setQuote(
                    null
                  );
                }}
              />

              Barista adicional
            </label>
          </div>

          {/* DISPONIBILIDAD */}

          {!hold && (
            <button
              onClick={
                checkAvailability
              }

              disabled={
                checkingAvailability
              }

              style={
                secondaryButtonStyle
              }
            >
              {checkingAvailability
                ? "Verificando..."
                : "Verificar disponibilidad"}
            </button>
          )}

          {availability?.available &&
            !hold && (
              <div
                style={
                  successBoxStyle
                }
              >
                <strong>
                  ✓ Java Coffee Cart disponible
                </strong>

                <div>
                  {formatDate(
                    availability
                      .event
                      .date
                  )}
                </div>

                <div>
                  {formatTime(
                    availability
                      .event
                      .startTime
                  )}
                </div>
              </div>
            )}

          {/* COTIZACIÓN */}

          {!hold && (
            <button
              onClick={
                calculateQuote
              }

              disabled={
                loadingQuote
              }

              style={
                primaryButtonStyle
              }
            >
              {loadingQuote
                ? "Calculando..."
                : "Cotizar evento"}
            </button>
          )}

          {quote && (
            <div
              style={
                quoteStyle
              }
            >
              <div
                style={
                  smallLabelStyle
                }
              >
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

              <div
                style={{
                  marginTop:
                    "15px",
                }}
              >
                {guests} invitados
                {" · "}
                {hours} horas
              </div>

              <div
                style={
                  totalLabelStyle
                }
              >
                Total estimado
              </div>

              <div
                style={
                  totalStyle
                }
              >
                {formatMoney(
                  quote
                    .quote
                    .total
                )}
              </div>

              <div
                style={{
                  marginTop:
                    "15px",
                }}
              >
                Anticipo:{" "}
                <strong>
                  {formatMoney(
                    quote
                      .quote
                      .deposit
                  )}
                </strong>
              </div>

              <div
                style={
                  mutedStyle
                }
              >
                Saldo:{" "}
                {formatMoney(
                  quote
                    .quote
                    .balance
                )}
              </div>
            </div>
          )}

          {/* DATOS CLIENTE */}

          {availability?.available &&
            quote &&
            !hold && (
              <div
                style={
                  customerSectionStyle
                }
              >
                <h2>
                  Aparta tu fecha
                </h2>

                <p
                  style={
                    mutedStyle
                  }
                >
                  Completa tus datos.
                  Apartaremos este horario
                  durante 15 minutos.
                </p>

                <label
                  style={
                    labelStyle
                  }
                >
                  Nombre completo
                </label>

                <input
                  value={
                    customerName
                  }

                  onChange={(
                    e
                  ) =>
                    setCustomerName(
                      e.target.value
                    )
                  }

                  style={
                    inputStyle
                  }
                />

                <label
                  style={
                    labelStyle
                  }
                >
                  Correo electrónico
                </label>

                <input
                  type="email"

                  value={
                    email
                  }

                  onChange={(
                    e
                  ) =>
                    setEmail(
                      e.target.value
                    )
                  }

                  style={
                    inputStyle
                  }
                />

                <label
                  style={
                    labelStyle
                  }
                >
                  WhatsApp
                </label>

                <input
                  type="tel"

                  value={
                    phone
                  }

                  onChange={(
                    e
                  ) =>
                    setPhone(
                      e.target.value
                    )
                  }

                  style={
                    inputStyle
                  }
                />

                <label
                  style={
                    labelStyle
                  }
                >
                  Tipo de evento
                </label>

                <select
                  value={
                    eventType
                  }

                  onChange={(
                    e
                  ) =>
                    setEventType(
                      e.target.value
                    )
                  }

                  style={
                    inputStyle
                  }
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

                <label
                  style={
                    labelStyle
                  }
                >
                  Dirección del evento
                </label>

                <input
                  value={
                    eventAddress
                  }

                  onChange={(
                    e
                  ) =>
                    setEventAddress(
                      e.target.value
                    )
                  }

                  placeholder="Calle, número, colonia..."
                  style={
                    inputStyle
                  }
                />

                <button
                  onClick={
                    createHold
                  }

                  disabled={
                    creatingHold
                  }

                  style={
                    reserveButtonStyle
                  }
                >
                  {creatingHold
                    ? "Apartando..."
                    : "Apartar fecha 15 minutos"}
                </button>
              </div>
            )}

          {/* HOLD ACTIVO */}

          {hold && (
            <div
              style={
                holdBoxStyle
              }
            >
              <div
                style={
                  holdTitleStyle
                }
              >
                ✓ Fecha apartada
              </div>

              {secondsRemaining >
              0 ? (
                <>
                  <p>
                    Tu Coffee Cart está
                    reservado temporalmente.
                  </p>

                  <div
                    style={
                      timerStyle
                    }
                  >
                    {formatCountdown(
                      secondsRemaining
                    )}
                  </div>

                  <div
                    style={
                      mutedStyle
                    }
                  >
                    Tiempo restante para
                    completar el pago.
                  </div>

                  <button
                    style={
                      paymentButtonStyle
                    }
                  >
                    Continuar al pago
                  </button>

                  <div
                    style={
                      paymentNoticeStyle
                    }
                  >
                    El botón de pago será
                    conectado a Shopify en
                    el siguiente paso.
                  </div>
                </>
              ) : (
                <div
                  style={
                    errorBoxStyle
                  }
                >
                  El tiempo de apartado
                  terminó. Actualiza la
                  página para consultar
                  disponibilidad nuevamente.
                </div>
              )}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div
              style={
                errorBoxStyle
              }
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================
// ESTILOS
// ============================================

const mainStyle = {
  minHeight:
    "100vh",

  background:
    "#111111",

  color:
    "white",

  padding:
    "50px 20px",

  fontFamily:
    "Arial, Helvetica, sans-serif",
};

const containerStyle = {
  maxWidth:
    "700px",

  margin:
    "0 auto",
};

const headerStyle = {
  marginBottom:
    "40px",
};

const brandStyle = {
  fontSize:
    "14px",

  letterSpacing:
    "2px",

  marginBottom:
    "12px",
};

const titleStyle = {
  fontSize:
    "42px",

  margin:
    0,
};

const subtitleStyle = {
  color:
    "#bbbbbb",

  fontSize:
    "18px",

  lineHeight:
    1.5,
};

const cardStyle = {
  background:
    "#1c1c1c",

  padding:
    "30px",

  borderRadius:
    "16px",
};

const labelStyle = {
  display:
    "block",

  fontWeight:
    "500",
};

const inputStyle = {
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
    "white",

  border:
    "1px solid #444",

  borderRadius:
    "8px",

  fontSize:
    "16px",
};

const extrasStyle = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    "14px",

  marginBottom:
    "28px",
};

const checkboxStyle = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "10px",
};

const primaryButtonStyle = {
  width:
    "100%",

  padding:
    "17px",

  marginTop:
    "10px",

  background:
    "#808080",

  color:
    "white",

  border:
    "none",

  borderRadius:
    "9px",

  fontSize:
    "17px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const secondaryButtonStyle = {
  width:
    "100%",

  padding:
    "16px",

  background:
    "#252525",

  color:
    "white",

  border:
    "1px solid #666",

  borderRadius:
    "9px",

  fontSize:
    "16px",

  fontWeight:
    "bold",

  cursor:
    "pointer",

  marginBottom:
    "16px",
};

const reserveButtonStyle = {
  width:
    "100%",

  padding:
    "18px",

  background:
    "#ffffff",

  color:
    "#111111",

  border:
    "none",

  borderRadius:
    "9px",

  fontSize:
    "17px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const paymentButtonStyle = {
  width:
    "100%",

  padding:
    "18px",

  marginTop:
    "25px",

  background:
    "#ffffff",

  color:
    "#111111",

  border:
    "none",

  borderRadius:
    "9px",

  fontSize:
    "18px",

  fontWeight:
    "bold",

  cursor:
    "pointer",
};

const successBoxStyle = {
  padding:
    "16px",

  marginBottom:
    "20px",

  background:
    "#123f23",

  border:
    "1px solid #24743c",

  borderRadius:
    "8px",

  lineHeight:
    1.6,
};

const quoteStyle = {
  marginTop:
    "30px",

  paddingTop:
    "30px",

  borderTop:
    "1px solid #444",
};

const smallLabelStyle = {
  color:
    "#aaaaaa",

  fontSize:
    "13px",

  letterSpacing:
    "1.5px",
};

const totalLabelStyle = {
  marginTop:
    "30px",

  color:
    "#bbbbbb",
};

const totalStyle = {
  fontSize:
    "38px",

  fontWeight:
    "bold",

  marginTop:
    "5px",
};

const mutedStyle = {
  color:
    "#aaaaaa",

  marginTop:
    "7px",

  lineHeight:
    1.5,
};

const customerSectionStyle = {
  marginTop:
    "35px",

  paddingTop:
    "30px",

  borderTop:
    "1px solid #444",
};

const holdBoxStyle = {
  marginTop:
    "30px",

  padding:
    "25px",

  background:
    "#172a1c",

  border:
    "1px solid #296b3a",

  borderRadius:
    "12px",

  textAlign:
    "center",
};

const holdTitleStyle = {
  fontSize:
    "22px",

  fontWeight:
    "bold",
};

const timerStyle = {
  fontSize:
    "48px",

  fontWeight:
    "bold",

  margin:
    "20px 0 5px",
};

const paymentNoticeStyle = {
  marginTop:
    "15px",

  color:
    "#aaaaaa",

  fontSize:
    "13px",
};

const errorBoxStyle = {
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

  lineHeight:
    1.5,
};