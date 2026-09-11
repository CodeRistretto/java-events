"use client";

import { useEffect, useMemo, useState } from "react";

const INITIAL_FORM = {
  serviceAreaId: "",
  eventDate: "",
  startTime: "16:00",
  guests: 50,
  durationHours: 2,
  matchaBar: false,
  extraBarista: false,
  customerName: "",
  email: "",
  phone: "",
  eventType: "",
  eventAddress: "",
  notes: "",
};

export default function Home() {
  const [serviceAreas, setServiceAreas] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);

  const [availability, setAvailability] = useState(null);
  const [quote, setQuote] = useState(null);
  const [hold, setHold] = useState(null);

  const [loadingAreas, setLoadingAreas] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [calculatingQuote, setCalculatingQuote] = useState(false);
  const [creatingHold, setCreatingHold] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  const selectedArea = useMemo(() => {
    return (
      serviceAreas.find((area) => area.id === form.serviceAreaId) || null
    );
  }, [serviceAreas, form.serviceAreaId]);

  useEffect(() => {
    loadServiceAreas();
  }, []);

  useEffect(() => {
    if (!hold?.holdExpiresAt) {
      setRemainingSeconds(null);
      return;
    }

    function updateCountdown() {
      const end = new Date(hold.holdExpiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setRemainingSeconds(diff);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [hold?.holdExpiresAt]);

  async function apiGet(url) {
    const response = await fetch(url, {
      cache: "no-store",
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || "No fue posible completar la solicitud."
      );
    }

    return data;
  }

  async function apiPost(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || "No fue posible completar la solicitud."
      );
    }

    return data;
  }

  async function loadServiceAreas() {
    try {
      setLoadingAreas(true);
      setError("");

      const data = await apiGet("/api/service-areas");

      const areas = data.serviceAreas || [];

      setServiceAreas(areas);

      if (areas.length > 0) {
        setForm((prev) => ({
          ...prev,
          serviceAreaId: prev.serviceAreaId || areas[0].id,
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAreas(false);
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetDownstream(from = "availability") {
    if (from === "availability") {
      setAvailability(null);
      setQuote(null);
      setHold(null);
      setSuccess("");
    }

    if (from === "quote") {
      setQuote(null);
      setHold(null);
      setSuccess("");
    }

    if (from === "hold") {
      setHold(null);
      setSuccess("");
    }
  }

  function validateStep1() {
    if (!form.serviceAreaId) {
      throw new Error("Selecciona una ciudad.");
    }

    if (!form.eventDate) {
      throw new Error("Selecciona la fecha del evento.");
    }

    if (!form.startTime) {
      throw new Error("Selecciona la hora de inicio.");
    }

    if (!Number(form.guests) || Number(form.guests) < 1) {
      throw new Error("Ingresa un número válido de invitados.");
    }

    if (!Number(form.durationHours) || Number(form.durationHours) < 1) {
      throw new Error("Selecciona una duración válida.");
    }
  }

  function validateCustomerStep() {
    if (!form.customerName.trim()) {
      throw new Error("Ingresa el nombre del cliente.");
    }

    if (!form.email.trim()) {
      throw new Error("Ingresa el correo electrónico.");
    }

    if (!/\S+@\S+\.\S+/.test(form.email.trim())) {
      throw new Error("Ingresa un correo electrónico válido.");
    }

    if (!isValidMxPhone(form.phone)) {
      throw new Error(
        "Ingresa un teléfono válido. Usa 10 dígitos de México."
      );
    }
  }

  async function handleCheckAvailability() {
    try {
      setCheckingAvailability(true);
      setError("");
      setSuccess("");
      validateStep1();
      resetDownstream("availability");

      const data = await apiPost("/api/availability", {
        serviceAreaId: form.serviceAreaId,
        eventDate: form.eventDate,
        startTime: form.startTime,
        durationHours: Number(form.durationHours),
      });

      if (!data.available) {
        throw new Error(
          data.message ||
            "No hay disponibilidad para la fecha y horario seleccionados."
        );
      }

      setAvailability(data);
      setSuccess("Disponibilidad confirmada. Ya puedes cotizar tu evento.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingAvailability(false);
    }
  }

  async function handleCalculateQuote() {
    try {
      setCalculatingQuote(true);
      setError("");
      setSuccess("");

      validateStep1();

      if (!availability?.available) {
        throw new Error("Primero verifica la disponibilidad.");
      }

      resetDownstream("quote");

      const data = await apiPost("/api/quote", {
        serviceAreaId: form.serviceAreaId,
        guests: Number(form.guests),
        hours: Number(form.durationHours),
        matchaBar: form.matchaBar,
        extraBarista: form.extraBarista,
      });

      setQuote(data);
      setSuccess("Cotización generada. Ahora captura los datos del cliente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCalculatingQuote(false);
    }
  }

  async function handleCreateHold() {
    try {
      setCreatingHold(true);
      setError("");
      setSuccess("");

      validateStep1();
      validateCustomerStep();

      if (!quote?.quote) {
        throw new Error("Primero genera la cotización.");
      }

      const data = await apiPost("/api/hold", {
        serviceAreaId: form.serviceAreaId,
        eventDate: form.eventDate,
        startTime: form.startTime,
        durationHours: Number(form.durationHours),
        guests: Number(form.guests),
        matchaBar: form.matchaBar,
        extraBarista: form.extraBarista,
        customerName: form.customerName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: onlyDigits(form.phone),
        eventType: form.eventType.trim(),
        eventAddress: form.eventAddress.trim(),
        notes: form.notes.trim(),
        packageName: "Java Coffee Cart",
        total: quote.quote.total,
        deposit: quote.quote.deposit,
        balance: quote.quote.balance,
      });

      const bookingId = data.bookingId || data.booking?.id || null;
      const holdExpiresAt =
        data.holdExpiresAt ||
        data.booking?.hold_expires_at ||
        data.booking?.holdExpiresAt ||
        null;

      if (!bookingId) {
        throw new Error("No se recibió el booking ID de la reserva.");
      }

      setHold({
        bookingId,
        holdExpiresAt,
        data,
      });

      setSuccess("Fecha apartada correctamente. Ya puedes continuar al pago.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingHold(false);
    }
  }

  async function handleCheckout() {
    try {
      setStartingCheckout(true);
      setError("");
      setSuccess("");

      if (!hold?.bookingId) {
        throw new Error("Primero aparta la fecha.");
      }

      if (remainingSeconds !== null && remainingSeconds <= 0) {
        throw new Error(
          "El tiempo para completar el pago expiró. Genera una nueva reserva."
        );
      }

      const data = await apiPost("/api/checkout", {
        bookingId: hold.bookingId,
      });

      const checkoutUrl =
        data.checkoutUrl ||
        data.invoiceUrl ||
        data.url ||
        data.checkout?.url ||
        null;

      if (!checkoutUrl) {
        throw new Error("No se recibió la URL de checkout.");
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingCheckout(false);
    }
  }

  const activeStep = getActiveStep({
    availability,
    quote,
    hold,
  });

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-bg" />
        <div className="container hero-inner">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Java Times Caffé · Eventos
          </div>

          <div className="hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">
                Java Coffee Cart <span>para eventos memorables</span>
              </h1>

              <p className="hero-subtitle">
                Cotiza, aparta y paga tu evento en un flujo mucho más claro.
                Inspirado en la esencia de Java: producto real, calidez,
                experiencia y una presentación premium.
              </p>

              <div className="hero-pills">
                <div className="hero-pill">Origen</div>
                <div className="hero-pill">Tueste</div>
                <div className="hero-pill">Experiencia</div>
                <div className="hero-pill">Entrega profesional</div>
              </div>
            </div>

            <div className="hero-card">
              <div className="hero-card-label">Flujo de reserva</div>
              <h2 className="hero-card-title">De la cotización al checkout</h2>
              <p>
                Primero validas disponibilidad, después generas la cotización,
                apartas la fecha temporalmente y terminas el pago en Shopify.
              </p>

              <div className="hero-micro-grid">
                <div className="micro-box">
                  <div className="micro-kicker">Paso 1</div>
                  <div className="micro-value">Evento</div>
                </div>

                <div className="micro-box">
                  <div className="micro-kicker">Paso 2</div>
                  <div className="micro-value">Cotización</div>
                </div>

                <div className="micro-box">
                  <div className="micro-kicker">Paso 3</div>
                  <div className="micro-value">Apartado</div>
                </div>

                <div className="micro-box">
                  <div className="micro-kicker">Paso 4</div>
                  <div className="micro-value">Checkout</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container page-grid">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Cotiza tu evento</h2>
            <p className="panel-subtitle">
              Elige ciudad, fecha y horario. Después validamos disponibilidad,
              generamos la cotización y apartamos tu fecha antes de enviarte al
              pago.
            </p>
          </div>

          <div className="stepbar">
            <div className={`stepbar-item ${activeStep >= 1 ? "active" : ""} ${availability?.available ? "done" : ""}`}>
              <div className="stepbar-number">1</div>
              <div className="stepbar-label">Evento</div>
              <div className="stepbar-desc">Ciudad, fecha, hora y tamaño del evento.</div>
            </div>

            <div className={`stepbar-item ${activeStep >= 2 ? "active" : ""} ${quote?.quote ? "done" : ""}`}>
              <div className="stepbar-number">2</div>
              <div className="stepbar-label">Cotización</div>
              <div className="stepbar-desc">Calculamos total, anticipo y saldo.</div>
            </div>

            <div className={`stepbar-item ${activeStep >= 3 ? "active" : ""} ${hold?.bookingId ? "done" : ""}`}>
              <div className="stepbar-number">3</div>
              <div className="stepbar-label">Apartado</div>
              <div className="stepbar-desc">Reservamos temporalmente tu fecha.</div>
            </div>

            <div className={`stepbar-item ${activeStep >= 4 ? "active" : ""}`}>
              <div className="stepbar-number">4</div>
              <div className="stepbar-label">Pago</div>
              <div className="stepbar-desc">Continúas a Shopify Checkout.</div>
            </div>
          </div>

          <div className="form-section">
            <div className="section-title">
              <div>
                <div className="section-kicker">Paso 1</div>
                <h3>Detalles del evento</h3>
              </div>
            </div>

            <div className="form-grid">
              <div className="field full">
                <label className="label">Ciudad del evento</label>
                <select
                  className="select"
                  value={form.serviceAreaId}
                  onChange={(e) => {
                    updateField("serviceAreaId", e.target.value);
                    resetDownstream("availability");
                  }}
                  disabled={loadingAreas}
                >
                  <option value="">
                    {loadingAreas
                      ? "Cargando ciudades..."
                      : "Selecciona una ciudad"}
                  </option>

                  {serviceAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.city}, {area.state}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">Fecha del evento</label>
                <input
                  className="input"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => {
                    updateField("eventDate", e.target.value);
                    resetDownstream("availability");
                  }}
                />
              </div>

              <div className="field">
                <label className="label">Hora de inicio</label>
                <input
                  className="input"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => {
                    updateField("startTime", e.target.value);
                    resetDownstream("availability");
                  }}
                />
              </div>

              <div className="field">
                <label className="label">Número de invitados</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.guests}
                  onChange={(e) => {
                    updateField("guests", Number(e.target.value));
                    resetDownstream("quote");
                  }}
                />
              </div>

              <div className="field">
                <label className="label">Duración del evento</label>
                <select
                  className="select"
                  value={form.durationHours}
                  onChange={(e) => {
                    updateField("durationHours", Number(e.target.value));
                    resetDownstream("availability");
                  }}
                >
                  <option value={2}>2 horas</option>
                  <option value={3}>3 horas</option>
                  <option value={4}>4 horas</option>
                  <option value={5}>5 horas</option>
                  <option value={6}>6 horas</option>
                </select>
              </div>
            </div>

            <div className="check-grid">
              <label className="check-card">
                <input
                  type="checkbox"
                  checked={form.matchaBar}
                  onChange={(e) => {
                    updateField("matchaBar", e.target.checked);
                    resetDownstream("quote");
                  }}
                />
                <div>
                  <div className="check-title">Matcha Bar</div>
                  <div className="check-text">
                    Agrega una estación complementaria de matcha para elevar la experiencia.
                  </div>
                </div>
              </label>

              <label className="check-card">
                <input
                  type="checkbox"
                  checked={form.extraBarista}
                  onChange={(e) => {
                    updateField("extraBarista", e.target.checked);
                    resetDownstream("quote");
                  }}
                />
                <div>
                  <div className="check-title">Barista adicional</div>
                  <div className="check-text">
                    Ideal para eventos con mayor flujo y mejor velocidad de atención.
                  </div>
                </div>
              </label>
            </div>

            <div className="action-row">
              <button
                className="button button-secondary"
                onClick={handleCheckAvailability}
                disabled={checkingAvailability || loadingAreas}
              >
                {checkingAvailability
                  ? "Verificando..."
                  : "Verificar disponibilidad"}
              </button>

              <button
                className="button button-primary"
                onClick={handleCalculateQuote}
                disabled={calculatingQuote || !availability?.available}
              >
                {calculatingQuote ? "Cotizando..." : "Generar cotización"}
              </button>
            </div>

            {availability?.available && (
              <div className="status success">
                <strong>Java Coffee Cart disponible.</strong>
                <br />
                {formatDateLong(form.eventDate)} · {formatTime12(form.startTime)} ·{" "}
                {form.durationHours} horas
              </div>
            )}
          </div>

          <div className="divider" />

          <div className="form-section">
            <div className="section-title">
              <div>
                <div className="section-kicker">Paso 2</div>
                <h3>Datos del cliente</h3>
              </div>
            </div>

            <div className="form-grid">
              <div className="field full">
                <label className="label">Nombre completo</label>
                <input
                  className="input"
                  type="text"
                  value={form.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                  placeholder="Nombre del cliente o empresa"
                />
              </div>

              <div className="field">
                <label className="label">Correo electrónico</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="field">
                <label className="label">Teléfono</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="8711234567"
                />
              </div>

              <div className="field">
                <label className="label">Tipo de evento</label>
                <input
                  className="input"
                  type="text"
                  value={form.eventType}
                  onChange={(e) => updateField("eventType", e.target.value)}
                  placeholder="Corporativo, boda, inauguración, etc."
                />
              </div>

              <div className="field">
                <label className="label">Dirección del evento</label>
                <input
                  className="input"
                  type="text"
                  value={form.eventAddress}
                  onChange={(e) => updateField("eventAddress", e.target.value)}
                  placeholder="Dirección completa del evento"
                />
              </div>

              <div className="field full">
                <label className="label">Notas adicionales</label>
                <textarea
                  className="textarea"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Indicaciones especiales, acceso, montaje, observaciones..."
                />
              </div>
            </div>

            {quote?.quote && (
              <div className="quote-card">
                <div className="quote-top">
                  <div>
                    <div className="quote-money-label">Tu evento Java</div>
                    <div className="quote-place">
                      {selectedArea?.city || quote?.serviceArea?.city || "Evento"}
                    </div>
                    <div className="quote-meta">
                      {formatDateLong(form.eventDate)} · {formatTime12(form.startTime)}
                      <br />
                      {form.guests} invitados · {form.durationHours} horas
                    </div>
                  </div>

                  <div>
                    <div className="quote-money-label">Total estimado</div>
                    <div className="quote-money">
                      {formatMoney(quote.quote.total)}
                    </div>
                  </div>
                </div>

                <div className="quote-breakdown">
                  <div className="mini-stat">
                    <div className="mini-stat-label">Anticipo para reservar</div>
                    <div className="mini-stat-value">
                      {formatMoney(quote.quote.deposit)}
                    </div>
                  </div>

                  <div className="mini-stat">
                    <div className="mini-stat-label">Saldo restante</div>
                    <div className="mini-stat-value">
                      {formatMoney(quote.quote.balance)}
                    </div>
                  </div>
                </div>

                <div className="note">
                  Esta cotización utiliza actualmente precios de prueba mientras
                  configuramos el tarifario definitivo de Java Coffee Cart.
                </div>
              </div>
            )}

            <div className="action-row">
              <button
                className="button button-primary"
                onClick={handleCreateHold}
                disabled={creatingHold || !quote?.quote}
              >
                {creatingHold ? "Apartando..." : "Apartar fecha"}
              </button>
            </div>

            {hold?.bookingId && (
              <div className="hold-card">
                <div className="section-kicker">Paso 3</div>
                <h3 style={{ marginTop: 6, marginBottom: 10 }}>
                  Fecha apartada temporalmente
                </h3>

                <div className="caption">
                  Tu Java Coffee Cart quedó reservado temporalmente mientras completas el pago.
                </div>

                <div className="countdown">
                  {formatCountdown(remainingSeconds)}
                </div>

                <div className="caption">
                  Tiempo restante para iniciar el pago.
                </div>

                <div className="note">
                  Booking ID: <strong>{hold.bookingId}</strong>
                </div>

                <div className="action-row">
                  <button
                    className="button button-primary"
                    onClick={handleCheckout}
                    disabled={startingCheckout || remainingSeconds === 0}
                  >
                    {startingCheckout
                      ? "Abriendo checkout..."
                      : "Continuar al pago"}
                  </button>
                </div>

                <div className="note">
                  El cliente y su teléfono quedarán asociados en Shopify.
                </div>
              </div>
            )}

            {error && <div className="status error">{error}</div>}
            {success && <div className="status success">{success}</div>}
          </div>
        </section>

        <aside className="panel summary-card">
          <div className="summary-top">
            <h3 className="summary-title">Resumen del evento</h3>
            <div className="summary-text">
              Un panel limpio para ver todo más claro mientras avanzas en el flujo.
            </div>
          </div>

          <div className="summary-block">
            <div className="summary-row">
              <span>Ciudad</span>
              <strong>
                {selectedArea
                  ? `${selectedArea.city}, ${selectedArea.state}`
                  : "—"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Fecha</span>
              <strong>
                {form.eventDate ? formatDateShort(form.eventDate) : "—"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Hora</span>
              <strong>{form.startTime ? formatTime12(form.startTime) : "—"}</strong>
            </div>

            <div className="summary-row">
              <span>Invitados</span>
              <strong>{form.guests || "—"}</strong>
            </div>

            <div className="summary-row">
              <span>Duración</span>
              <strong>{form.durationHours || "—"} horas</strong>
            </div>
          </div>

          <div className="summary-block">
            <div className="summary-row">
              <span>Total estimado</span>
              <strong>
                {quote?.quote ? formatMoney(quote.quote.total) : "—"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Anticipo</span>
              <strong>
                {quote?.quote ? formatMoney(quote.quote.deposit) : "—"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Saldo</span>
              <strong>
                {quote?.quote ? formatMoney(quote.quote.balance) : "—"}
              </strong>
            </div>

            {quote?.quote && (
              <div className="summary-big">
                {formatMoney(quote.quote.total)}
              </div>
            )}
          </div>

          <div className="summary-block">
            <div className="section-kicker">Esencia Java</div>

            <div className="chips">
              <div className="chip">Origen</div>
              <div className="chip">Selección</div>
              <div className="chip">Tueste</div>
              <div className="chip">Empaque</div>
              <div className="chip">Entrega</div>
            </div>

            <div className="brand-quote">
              Una experiencia de café pensada con calidez, mejor presentación y
              un flujo de reserva más claro.
            </div>
          </div>

          <div className="summary-block tiny">
            Este nuevo diseño está pensado para verse mucho más premium y al mismo
            tiempo convertir mejor: menos ruido, mejor jerarquía y un checkout
            más entendible.
          </div>
        </aside>
      </div>
    </main>
  );
}

function getActiveStep({ availability, quote, hold }) {
  if (hold?.bookingId) return 4;
  if (quote?.quote) return 3;
  if (availability?.available) return 2;
  return 1;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidMxPhone(value) {
  const digits = onlyDigits(value);

  return (
    digits.length === 10 ||
    (digits.length === 12 && digits.startsWith("52")) ||
    (digits.length === 13 && digits.startsWith("521"))
  );
}

function formatMoney(amount) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(amount || 0));
}

function formatDateLong(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateShort(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime12(value) {
  if (!value) return "—";

  const [h, m] = value.split(":");
  const date = new Date();
  date.setHours(Number(h), Number(m), 0, 0);

  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCountdown(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) return "15:00";
  if (totalSeconds <= 0) return "00:00";

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}