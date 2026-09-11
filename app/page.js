"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [serviceAreas, setServiceAreas] = useState([]);
  const [serviceAreaId, setServiceAreaId] = useState("");

  const [guests, setGuests] = useState(50);
  const [hours, setHours] = useState(2);

  const [matchaBar, setMatchaBar] = useState(false);
  const [extraBarista, setExtraBarista] = useState(false);

  const [quote, setQuote] = useState(null);

  const [loadingCities, setLoadingCities] = useState(true);
  const [loading, setLoading] = useState(false);

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

        if (!response.ok) {
          throw new Error(
            "No fue posible cargar las ciudades disponibles."
          );
        }

        const text = await response.text();

        if (!text) {
          throw new Error(
            "El servidor no devolvió información de las ciudades."
          );
        }

        const data = JSON.parse(text);

        if (!data.success) {
          throw new Error(
            data.error ||
              "No fue posible cargar las ciudades disponibles."
          );
        }

        const areas = data.serviceAreas || [];

        setServiceAreas(areas);

        // Seleccionar automáticamente la primera ciudad
        if (areas.length > 0) {
          setServiceAreaId(areas[0].id);
        } else {
          setServiceAreaId("");
          setError(
            "Actualmente no hay ciudades disponibles para Java Coffee Cart."
          );
        }
      } catch (err) {
        console.error("Error loading service areas:", err);

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
  // COTIZAR
  // ============================================

  async function calculateQuote() {
    try {
      setLoading(true);
      setError("");
      setQuote(null);

      /*
       * Protección adicional:
       * Si React todavía no actualizó serviceAreaId,
       * usamos directamente el ID de la primera ciudad.
       */
      const selectedServiceAreaId =
        serviceAreaId || serviceAreas[0]?.id;

      if (!selectedServiceAreaId) {
        throw new Error(
          "Selecciona una ciudad para continuar."
        );
      }

      // Guardamos también el ID en el estado
      if (!serviceAreaId) {
        setServiceAreaId(selectedServiceAreaId);
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
          "Selecciona la duración del evento."
        );
      }

      const response = await fetch("/api/quote", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          serviceAreaId: selectedServiceAreaId,
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
        console.error("Respuesta no JSON:", text);

        throw new Error(
          "La respuesta del servidor no es válida."
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
      setLoading(false);
    }
  }

  // ============================================
  // FORMATO MXN
  // ============================================

  function formatMoney(amount) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  }

  // ============================================
  // PANTALLA
  // ============================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111111",
        color: "white",
        padding: "50px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              letterSpacing: "2px",
              marginBottom: "12px",
            }}
          >
            JAVA TIMES CAFFÉ
          </div>

          <h1
            style={{
              fontSize: "42px",
              margin: 0,
            }}
          >
            Java Coffee Cart
          </h1>

          <p
            style={{
              color: "#bbbbbb",
              fontSize: "18px",
              lineHeight: 1.5,
            }}
          >
            Cotiza tu evento en segundos.
          </p>
        </div>

        {/* FORMULARIO */}

        <div
          style={{
            background: "#1c1c1c",
            padding: "30px",
            borderRadius: "16px",
          }}
        >
          {/* CIUDAD */}

          <label>Ciudad del evento</label>

          <select
            value={serviceAreaId}
            disabled={loadingCities}
            onChange={(e) => {
              setServiceAreaId(e.target.value);
              setQuote(null);
              setError("");
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
                  {area.city}, {area.state}
                </option>
              ))}
          </select>

          {/* INVITADOS */}

          <label>Número de invitados</label>

          <input
            type="number"
            min="1"
            value={guests}
            onChange={(e) => {
              setGuests(e.target.value);
              setQuote(null);
            }}
            style={inputStyle}
          />

          {/* DURACIÓN */}

          <label>Duración del evento</label>

          <select
            value={hours}
            onChange={(e) => {
              setHours(e.target.value);
              setQuote(null);
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

          {/* MATCHA */}

          <div
            style={{
              marginTop: "25px",
              marginBottom: "15px",
            }}
          >
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={matchaBar}
                onChange={(e) => {
                  setMatchaBar(
                    e.target.checked
                  );

                  setQuote(null);
                }}
              />

              Agregar Matcha Bar
            </label>
          </div>

          {/* BARISTA */}

          <div
            style={{
              marginBottom: "25px",
            }}
          >
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={extraBarista}
                onChange={(e) => {
                  setExtraBarista(
                    e.target.checked
                  );

                  setQuote(null);
                }}
              />

              Barista adicional
            </label>
          </div>

          {/* BOTÓN */}

          <button
            onClick={calculateQuote}
            disabled={
              loading ||
              loadingCities ||
              serviceAreas.length === 0
            }
            style={{
              width: "100%",
              padding: "18px",

              border: "none",
              borderRadius: "10px",

              fontSize: "17px",
              fontWeight: "bold",

              cursor:
                loading ||
                loadingCities ||
                serviceAreas.length === 0
                  ? "not-allowed"
                  : "pointer",

              opacity:
                loading ||
                loadingCities ||
                serviceAreas.length === 0
                  ? 0.6
                  : 1,
            }}
          >
            {loading
              ? "Calculando..."
              : "Cotizar evento"}
          </button>

          {/* ERROR */}

          {error && (
            <div
              style={{
                marginTop: "20px",
                padding: "15px",

                background: "#381818",

                borderRadius: "8px",

                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          {/* RESULTADO */}

          {quote && (
            <div
              style={{
                marginTop: "30px",
                paddingTop: "30px",

                borderTop:
                  "1px solid #444444",
              }}
            >
              <div
                style={{
                  color: "#aaaaaa",

                  fontSize: "13px",
                  letterSpacing: "1.5px",

                  marginBottom: "5px",
                }}
              >
                TU EVENTO JAVA
              </div>

              <h2
                style={{
                  marginTop: 0,
                  marginBottom: "8px",
                }}
              >
                {quote.serviceArea.city}
              </h2>

              <div
                style={{
                  color: "#bbbbbb",
                }}
              >
                {quote.serviceArea.state}
              </div>

              <p
                style={{
                  marginTop: "20px",
                }}
              >
                {guests} invitados · {hours}{" "}
                horas
              </p>

              {matchaBar && (
                <div>✓ Matcha Bar</div>
              )}

              {extraBarista && (
                <div>
                  ✓ Barista adicional
                </div>
              )}

              {/* PRECIO */}

              <div
                style={{
                  marginTop: "30px",
                  fontSize: "16px",
                  color: "#bbbbbb",
                }}
              >
                Total estimado
              </div>

              <div
                style={{
                  fontSize: "38px",
                  fontWeight: "bold",
                  marginTop: "5px",
                }}
              >
                {formatMoney(
                  quote.quote.total
                )}
              </div>

              {/* ANTICIPO */}

              <div
                style={{
                  marginTop: "25px",
                }}
              >
                Anticipo para reservar:
                <strong>
                  {" "}
                  {formatMoney(
                    quote.quote.deposit
                  )}
                </strong>
              </div>

              {/* SALDO */}

              <div
                style={{
                  marginTop: "8px",
                  color: "#aaaaaa",
                }}
              >
                Saldo restante:{" "}
                {formatMoney(
                  quote.quote.balance
                )}
              </div>

              <div
                style={{
                  marginTop: "30px",
                  padding: "15px",

                  background: "#262626",
                  borderRadius: "8px",

                  color: "#aaaaaa",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
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

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",

  gap: "10px",

  cursor: "pointer",
};