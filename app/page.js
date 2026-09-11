"use client";

import { useEffect, useState } from "react";

export default function Home() {
  // ============================================
  // ESTADOS
  // ============================================

  const [serviceAreas, setServiceAreas] = useState([]);
  const [serviceAreaId, setServiceAreaId] = useState("");

  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");

  const [guests, setGuests] = useState(50);
  const [hours, setHours] = useState(2);

  const [matchaBar, setMatchaBar] = useState(false);
  const [extraBarista, setExtraBarista] = useState(false);

  const [quote, setQuote] = useState(null);
  const [availability, setAvailability] = useState(null);

  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [checkingAvailability, setCheckingAvailability] =
    useState(false);

  const [error, setError] = useState("");

  // ============================================
  // CARGAR CIUDADES DESDE SUPABASE
  // ============================================

  useEffect(() => {
    async function loadServiceAreas() {
      try {
        setLoadingCities(true);
        setError("");

        const response = await fetch("/api/service-areas", {
          cache: "no-store",
        });

        const text = await response.text();

        if (!text) {
          throw new Error(
            "El servidor no devolvió información de las ciudades."
          );
        }

        let data;

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            "La respuesta de ciudades no tiene un formato válido."
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "No fue posible cargar las ciudades disponibles."
          );
        }

        const areas = data.serviceAreas || [];

        setServiceAreas(areas);

        if (areas.length > 0) {
          setServiceAreaId(areas[0].id);
        } else {
          setServiceAreaId("");

          setError(
            "Actualmente no hay ciudades disponibles para Java Coffee Cart."
          );
        }
      } catch (err) {
        console.error("Service areas error:", err);

        setError(
          err.message ||
            "No fue posible cargar las ciudades."
        );
      } finally {
        setLoadingCities(false);
      }
    }

    loadServiceAreas();
  }, []);

  // ============================================
  // OBTENER ID DE CIUDAD
  // ============================================

  function getSelectedServiceAreaId() {
    return serviceAreaId || serviceAreas[0]?.id || "";
  }

  // ============================================
  // RESETEAR RESULTADOS CUANDO CAMBIA EL EVENTO
  // ============================================

  function resetEventResults() {
    setAvailability(null);
    setQuote(null);
    setError("");
  }

  // ============================================
  // VERIFICAR DISPONIBILIDAD
  // ============================================

  async function checkAvailability() {
    try {
      setCheckingAvailability(true);
      setError("");
      setAvailability(null);

      const selectedServiceAreaId =
        getSelectedServiceAreaId();

      if (!selectedServiceAreaId) {
        throw new Error(
          "Selecciona una ciudad para continuar."
        );
      }

      if (!eventDate) {
        throw new Error(
          "Selecciona la fecha del evento."
        );
      }

      if (!startTime) {
        throw new Error(
          "Selecciona la hora de inicio."
        );
      }

      const numberHours = Number(hours);

      if (!numberHours || numberHours < 1) {
        throw new Error(
          "Selecciona una duración válida."
        );
      }

      const response = await fetch(
        "/api/availability",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            serviceAreaId:
              selectedServiceAreaId,

            eventDate,
            startTime,

            hours: numberHours,
          }),
        }
      );

      const text = await response.text();

      if (!text) {
        throw new Error(
          "El servidor no devolvió información de disponibilidad."
        );
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.error(
          "Availability response:",
          text
        );

        throw new Error(
          "La respuesta de disponibilidad no es válida."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "No fue posible verificar la disponibilidad."
        );
      }

      setAvailability(data);

      if (!data.available) {
        setError(
          data.message ||
            "No hay Java Coffee Cart disponible en ese horario."
        );
      }
    } catch (err) {
      console.error("Availability error:", err);

      setError(
        err.message ||
          "No fue posible verificar la disponibilidad."
      );
    } finally {
      setCheckingAvailability(false);
    }
  }

  // ============================================
  // CALCULAR COTIZACIÓN
  // ============================================

  async function calculateQuote() {
    try {
      setLoadingQuote(true);
      setError("");
      setQuote(null);

      const selectedServiceAreaId =
        getSelectedServiceAreaId();

      if (!selectedServiceAreaId) {
        throw new Error(
          "Selecciona una ciudad para continuar."
        );
      }

      const numberGuests = Number(guests);
      const numberHours = Number(hours);

      if (!numberGuests || numberGuests < 1) {
        throw new Error(
          "Ingresa un número válido de invitados."
        );
      }

      if (!numberHours || numberHours < 1) {
        throw new Error(
          "Selecciona una duración válida."
        );
      }

      const response = await fetch("/api/quote", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          serviceAreaId:
            selectedServiceAreaId,

          guests: numberGuests,

          hours: numberHours,

          matchaBar,
          extraBarista,
        }),
      });

      const text = await response.text();

      if (!text) {
        throw new Error(
          "El servidor no devolvió una cotización."
        );
      }

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.error("Quote response:", text);

        throw new Error(
          "La respuesta de cotización no es válida."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "No fue posible calcular la cotización."
        );
      }

      setQuote(data);
    } catch (err) {
      console.error("Quote error:", err);

      setError(
        err.message ||
          "Ocurrió un error al calcular la cotización."
      );
    } finally {
      setLoadingQuote(false);
    }
  }

  // ============================================
  // FORMATO DE DINERO
  // ============================================

  function formatMoney(amount) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  }

  // ============================================
  // FORMATO DE FECHA
  // ============================================

  function formatDate(date) {
    if (!date) {
      return "";
    }

    const [year, month, day] =
      date.split("-").map(Number);

    const localDate = new Date(
      year,
      month - 1,
      day
    );

    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(localDate);
  }

  // ============================================
  // PANTALLA
  // ============================================

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        {/* ======================================
            HEADER
        ====================================== */}

        <div style={headerStyle}>
          <div style={brandStyle}>
            JAVA TIMES CAFFÉ
          </div>

          <h1 style={titleStyle}>
            Java Coffee Cart
          </h1>

          <p style={subtitleStyle}>
            Cotiza y consulta la disponibilidad
            de tu evento en segundos.
          </p>
        </div>

        {/* ======================================
            TARJETA
        ====================================== */}

        <div style={cardStyle}>
          {/* CIUDAD */}

          <label style={labelStyle}>
            Ciudad del evento
          </label>

          <select
            value={serviceAreaId}
            disabled={loadingCities}
            onChange={(e) => {
              setServiceAreaId(
                e.target.value
              );

              resetEventResults();
            }}
            style={inputStyle}
          >
            {loadingCities && (
              <option value="">
                Cargando ciudades...
              </option>
            )}

            {!loadingCities &&
              serviceAreas.length === 0 && (
                <option value="">
                  No hay ciudades disponibles
                </option>
              )}

            {!loadingCities &&
              serviceAreas.map((area) => (
                <option
                  key={area.id}
                  value={area.id}
                >
                  {area.city},{" "}
                  {area.state}
                </option>
              ))}
          </select>

          {/* FECHA */}

          <label style={labelStyle}>
            Fecha del evento
          </label>

          <input
            type="date"
            value={eventDate}
            onChange={(e) => {
              setEventDate(
                e.target.value
              );

              resetEventResults();
            }}
            style={inputStyle}
          />

          {/* HORA */}

          <label style={labelStyle}>
            Hora de inicio
          </label>

          <select
            value={startTime}
            onChange={(e) => {
              setStartTime(
                e.target.value
              );

              resetEventResults();
            }}
            style={inputStyle}
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

          <label style={labelStyle}>
            Número de invitados
          </label>

          <input
            type="number"
            min="1"
            value={guests}
            onChange={(e) => {
              setGuests(
                e.target.value
              );

              setQuote(null);
              setError("");
            }}
            style={inputStyle}
          />

          {/* DURACIÓN */}

          <label style={labelStyle}>
            Duración del evento
          </label>

          <select
            value={hours}
            onChange={(e) => {
              setHours(
                e.target.value
              );

              resetEventResults();
            }}
            style={inputStyle}
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

          <div style={extrasContainerStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={matchaBar}
                onChange={(e) => {
                  setMatchaBar(
                    e.target.checked
                  );

                  setQuote(null);
                  setError("");
                }}
              />

              Agregar Matcha Bar
            </label>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={extraBarista}
                onChange={(e) => {
                  setExtraBarista(
                    e.target.checked
                  );

                  setQuote(null);
                  setError("");
                }}
              />

              Barista adicional
            </label>
          </div>

          {/* ======================================
              DISPONIBILIDAD
          ====================================== */}

          <button
            onClick={checkAvailability}
            disabled={
              checkingAvailability ||
              loadingCities ||
              serviceAreas.length === 0
            }
            style={secondaryButtonStyle}
          >
            {checkingAvailability
              ? "Verificando disponibilidad..."
              : "Verificar disponibilidad"}
          </button>

          {availability?.available && (
            <div style={successBoxStyle}>
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "6px",
                }}
              >
                ✓ Java Coffee Cart disponible
              </div>

              <div>
                {formatDate(
                  availability.event.date
                )}
              </div>

              <div>
                Hora:{" "}
                {
                  availability.event
                    .startTime
                }
              </div>

              <div>
                Duración:{" "}
                {availability.event.hours}{" "}
                horas
              </div>
            </div>
          )}

          {/* ======================================
              COTIZAR
          ====================================== */}

          <button
            onClick={calculateQuote}
            disabled={
              loadingQuote ||
              loadingCities ||
              serviceAreas.length === 0
            }
            style={primaryButtonStyle}
          >
            {loadingQuote
              ? "Calculando..."
              : "Cotizar evento"}
          </button>

          {/* ======================================
              ERROR
          ====================================== */}

          {error && (
            <div style={errorBoxStyle}>
              {error}
            </div>
          )}

          {/* ======================================
              RESULTADO COTIZACIÓN
          ====================================== */}

          {quote && (
            <div style={quoteContainerStyle}>
              <div style={quoteLabelStyle}>
                TU EVENTO JAVA
              </div>

              <h2 style={quoteTitleStyle}>
                {quote.serviceArea.city}
              </h2>

              <div style={quoteStateStyle}>
                {quote.serviceArea.state}
              </div>

              {eventDate && (
                <div style={summaryRowStyle}>
                  Fecha:{" "}
                  <strong>
                    {formatDate(eventDate)}
                  </strong>
                </div>
              )}

              {startTime && (
                <div style={summaryRowStyle}>
                  Hora:{" "}
                  <strong>
                    {startTime}
                  </strong>
                </div>
              )}

              <div style={summaryRowStyle}>
                {guests} invitados ·{" "}
                {hours} horas
              </div>

              {matchaBar && (
                <div style={extraResultStyle}>
                  ✓ Matcha Bar
                </div>
              )}

              {extraBarista && (
                <div style={extraResultStyle}>
                  ✓ Barista adicional
                </div>
              )}

              <div style={priceLabelStyle}>
                Total estimado
              </div>

              <div style={priceStyle}>
                {formatMoney(
                  quote.quote.total
                )}
              </div>

              <div style={depositStyle}>
                Anticipo para reservar:{" "}
                <strong>
                  {formatMoney(
                    quote.quote.deposit
                  )}
                </strong>
              </div>

              <div style={balanceStyle}>
                Saldo restante:{" "}
                {formatMoney(
                  quote.quote.balance
                )}
              </div>

              <div style={noticeStyle}>
                Esta cotización utiliza
                actualmente precios de prueba
                mientras configuramos el
                tarifario definitivo de Java
                Coffee Cart.
              </div>
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
  minHeight: "100vh",

  background: "#111111",
  color: "white",

  padding: "50px 20px",

  fontFamily:
    "Arial, Helvetica, sans-serif",
};

const containerStyle = {
  maxWidth: "700px",

  margin: "0 auto",
};

const headerStyle = {
  marginBottom: "40px",
};

const brandStyle = {
  fontSize: "14px",

  letterSpacing: "2px",

  marginBottom: "12px",
};

const titleStyle = {
  fontSize: "42px",

  margin: 0,
};

const subtitleStyle = {
  color: "#bbbbbb",

  fontSize: "18px",

  lineHeight: 1.5,
};

const cardStyle = {
  background: "#1c1c1c",

  padding: "30px",

  borderRadius: "16px",
};

const labelStyle = {
  display: "block",

  marginBottom: "0px",

  fontWeight: "500",
};

const inputStyle = {
  width: "100%",

  boxSizing: "border-box",

  padding: "14px",

  marginTop: "8px",
  marginBottom: "22px",

  background: "#292929",
  color: "white",

  border: "1px solid #444444",

  borderRadius: "8px",

  fontSize: "16px",
};

const extrasContainerStyle = {
  display: "flex",

  flexDirection: "column",

  gap: "14px",

  marginTop: "5px",
  marginBottom: "28px",
};

const checkboxLabelStyle = {
  display: "flex",

  alignItems: "center",

  gap: "10px",

  cursor: "pointer",
};

const secondaryButtonStyle = {
  width: "100%",

  padding: "16px",

  marginBottom: "15px",

  border: "1px solid #666666",

  borderRadius: "10px",

  background: "#252525",

  color: "white",

  fontSize: "16px",
  fontWeight: "bold",

  cursor: "pointer",
};

const primaryButtonStyle = {
  width: "100%",

  padding: "18px",

  border: "none",

  borderRadius: "10px",

  background: "#808080",

  color: "white",

  fontSize: "17px",
  fontWeight: "bold",

  cursor: "pointer",
};

const successBoxStyle = {
  marginBottom: "20px",

  padding: "15px",

  background: "#153c22",

  border: "1px solid #246c38",

  borderRadius: "8px",

  lineHeight: 1.5,
};

const errorBoxStyle = {
  marginTop: "20px",

  padding: "15px",

  background: "#381818",

  border: "1px solid #682727",

  borderRadius: "8px",

  lineHeight: 1.5,
};

const quoteContainerStyle = {
  marginTop: "30px",

  paddingTop: "30px",

  borderTop: "1px solid #444444",
};

const quoteLabelStyle = {
  color: "#aaaaaa",

  fontSize: "13px",

  letterSpacing: "1.5px",

  marginBottom: "5px",
};

const quoteTitleStyle = {
  marginTop: 0,

  marginBottom: "5px",

  fontSize: "28px",
};

const quoteStateStyle = {
  color: "#bbbbbb",

  marginBottom: "20px",
};

const summaryRowStyle = {
  marginTop: "10px",

  lineHeight: 1.5,
};

const extraResultStyle = {
  marginTop: "8px",

  color: "#dddddd",
};

const priceLabelStyle = {
  marginTop: "30px",

  fontSize: "16px",

  color: "#bbbbbb",
};

const priceStyle = {
  fontSize: "38px",

  fontWeight: "bold",

  marginTop: "5px",
};

const depositStyle = {
  marginTop: "25px",
};

const balanceStyle = {
  marginTop: "8px",

  color: "#aaaaaa",
};

const noticeStyle = {
  marginTop: "30px",

  padding: "15px",

  background: "#262626",

  borderRadius: "8px",

  color: "#aaaaaa",

  fontSize: "14px",

  lineHeight: 1.5,
};