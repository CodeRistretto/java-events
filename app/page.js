"use client";

import { useEffect, useMemo, useState } from "react";

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}

function formatCountdown(seconds) {
  if (seconds === null) return "15:00";
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function durationHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) return 0;
  return (endMinutes - startMinutes) / 60;
}

function addOnPriceLabel(addOn) {
  const price = money(Number(addOn.unit_price_cents || 0) / 100);
  switch (addOn.pricing_type) {
    case "PER_GUEST":
      return `${price} por invitado`;
    case "PER_EVENT":
      return `${price} por todo el evento`;
    case "PER_HOUR":
      return `${price} por hora adicional`;
    case "PER_UNIT":
      return `${price} por unidad`;
    default:
      return price;
  }
}

function addOnDescription(addOn) {
  if (addOn.description?.trim()) return addOn.description;

  const descriptions = {
    COLD_BEVERAGES: "Agrega servicio de bebidas frías para todos los invitados contratados.",
    FRAPPES: "Agrega frappés al servicio para todos los invitados contratados.",
    MATCHA_CHAI: "Agrega opciones de matcha y chai al servicio del evento.",
    DECAF: "Agrega opción de café descafeinado al servicio.",
    PLANT_MILK: "Agrega opciones de leche vegetal para el servicio.",
    PASTRY: "Agrega panadería para los invitados del evento.",
    PREMIUM_PASTRY: "Agrega una selección de panadería premium.",
    DESSERT_TABLE: "Agrega una mesa de postres como servicio adicional del evento.",
    BOTTLED_WATER: "Agrega botellas de agua. Indica la cantidad que necesitas.",
    PERSONALIZED_CUPS: "Agrega vasos personalizados para los invitados contratados.",
    PERSONALIZED_MENU: "Agrega un menú personalizado para tu evento.",
    SPECIAL_GLASSWARE: "Agrega cristalería especial al servicio.",
    ADDITIONAL_CART: "Solicita un Coffee Cart adicional. La disponibilidad será validada por Java.",
    ADDITIONAL_BARISTA: "Agrega personal adicional al servicio del evento.",
    ADDITIONAL_HOUR: "Extiende el servicio por una o más horas adicionales.",
    TRANSPORTATION: "Cargo de transporte cuando corresponda a la zona del evento.",
  };

  return descriptions[addOn.code] || "Servicio opcional que puedes agregar a tu evento.";
}

function groupLabel(group) {
  const labels = {
    Beverages: "Bebidas",
    Food: "Alimentos",
    Customization: "Personalización",
    Operations: "Operación y servicio",
  };
  return labels[group] || group;
}

function itemHumanLabel(item) {
  if (item.code === "HOT_COFFEE_SERVICE") {
    return `Servicio base Java Coffee Cart para ${item.quantity} invitados`;
  }
  if (item.code === "COLD_BEVERAGES") {
    return `Servicio de bebidas frías para ${item.quantity} invitados`;
  }
  if (item.code === "ADDITIONAL_HOUR") {
    return `${item.quantity} hora(s) adicional(es) de servicio`;
  }
  return item.name;
}

function itemCalculation(item) {
  if (!item) return "";
  if (item.pricingType === "PER_GUEST") return `${item.quantity} invitados × ${money(item.unitPrice)}`;
  if (item.pricingType === "PER_HOUR") return `${item.quantity} hora(s) × ${money(item.unitPrice)}`;
  if (item.pricingType === "PER_UNIT") return `${item.quantity} unidad(es) × ${money(item.unitPrice)}`;
  if (item.pricingType === "PER_EVENT") return "Precio fijo por evento";
  return "";
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [quote, setQuote] = useState(null);
  const [hold, setHold] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");

  const [lead, setLead] = useState({
    city: "",
    state: "",
    customerName: "",
    email: "",
    phone: "",
    estimatedGuests: 100,
    eventType: "",
    expectedDate: "",
    marketingConsent: false,
  });

  const [form, setForm] = useState({
    serviceAreaId: "",
    eventType: "",
    eventDate: "",
    startTime: "16:00",
    endTime: "18:00",
    guestCount: 100,
    customerName: "",
    email: "",
    phone: "",
    venueName: "",
    eventAddress: "",
    neighborhood: "",
    postalCode: "",
    indoorOutdoor: "",
    floor: "",
    elevator: "",
    unloadingAccess: "",
    setupAccessTime: "",
    electricityDetails: "",
    potableWater: "",
    waterDistanceM: "",
    invoiceRequired: false,
    taxName: "",
    taxRfc: "",
    taxUsage: "",
    notes: "",
    termsAccepted: false,
    selectedAddOns: [],
  });

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!hold?.holdExpiresAt) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(hold.holdExpiresAt).getTime() - Date.now()) / 1000)
      );
      setRemaining(seconds);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hold?.holdExpiresAt]);

  const groupedAddOns = useMemo(() => {
    const groups = {};
    for (const item of config?.addOns || []) {
      groups[item.group_name] ||= [];
      groups[item.group_name].push(item);
    }
    return groups;
  }, [config]);

  const selectedArea = useMemo(
    () => config?.serviceAreas?.find((area) => area.id === form.serviceAreaId) || null,
    [config, form.serviceAreaId]
  );

  const depositPercent = Number(config?.settings?.deposit_bps || 0) / 100;
  const vatPercent = Number(config?.settings?.vat_bps || 0) / 100;
  const holdMinutes = Number(config?.settings?.hold_minutes || 15);

  async function loadConfig() {
    try {
      setError("");
      const response = await fetch("/api/event-config", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible cargar Java Events.");
      }

      setConfig(data);

      const firstArea = data.serviceAreas?.[0];
      const firstTier = data.guestTiers?.[0];

      setForm((current) => ({
        ...current,
        serviceAreaId: current.serviceAreaId || firstArea?.id || "",
        guestCount: current.guestCount || firstTier?.guest_count || 100,
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));

    if (["serviceAreaId", "eventDate", "guestCount", "selectedAddOns"].includes(key)) {
      setQuote(null);
    }

    if (["serviceAreaId", "eventDate"].includes(key)) {
      setAvailability(null);
    }

    setSuccess("");
  }

  function toggleAddOn(addOn) {
    const exists = form.selectedAddOns.find((item) => item.code === addOn.code);

    if (exists) {
      update(
        "selectedAddOns",
        form.selectedAddOns.filter((item) => item.code !== addOn.code)
      );
      return;
    }

    update("selectedAddOns", [
      ...form.selectedAddOns,
      { code: addOn.code, quantity: 1 },
    ]);
  }

  function setAddOnQuantity(code, quantity) {
    update(
      "selectedAddOns",
      form.selectedAddOns.map((item) =>
        item.code === code
          ? { ...item, quantity: Math.max(1, Number(quantity || 1)) }
          : item
      )
    );
  }

  async function checkAvailability() {
    try {
      setBusy("availability");
      setError("");
      setSuccess("");

      if (!form.serviceAreaId) throw new Error("Selecciona una ciudad.");
      if (!form.eventDate) throw new Error("Selecciona una fecha.");

      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceAreaId: form.serviceAreaId,
          eventDate: form.eventDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible verificar la disponibilidad.");
      }

      setAvailability(data);

      if (!data.available) {
        throw new Error(data.message || "La fecha no está disponible.");
      }

      setSuccess("La fecha está disponible. Ahora puedes calcular el precio de tu evento.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function calculateQuote() {
    try {
      setBusy("quote");
      setError("");
      setSuccess("");

      if (!availability?.available) {
        throw new Error("Primero verifica que la fecha esté disponible.");
      }

      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceAreaId: form.serviceAreaId,
          guestCount: Number(form.guestCount),
          selectedAddOns: form.selectedAddOns,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible calcular el precio.");
      }

      setQuote(data);
      setSuccess("Precio calculado. Revisa el desglose antes de continuar.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  function validateBeforeHold() {
    if (!quote?.quote) throw new Error("Primero calcula el precio de tu evento.");
    if (!form.customerName?.trim()) throw new Error("Falta el nombre completo del cliente.");
    if (!form.email?.trim()) throw new Error("Falta el correo electrónico.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      throw new Error("El correo electrónico no parece válido.");
    }
    if (!form.phone?.trim()) throw new Error("Falta el teléfono.");
    if (!form.venueName?.trim()) throw new Error("Falta el nombre del lugar donde será el evento.");
    if (!form.eventAddress?.trim()) throw new Error("Falta la calle y número del lugar.");
    if (!form.neighborhood?.trim()) throw new Error("Falta la colonia.");
    if (!form.postalCode?.trim()) throw new Error("Falta el código postal.");
    if (!form.indoorOutdoor) throw new Error("Indica si el evento será en interior o exterior.");
    if (!form.floor?.trim()) throw new Error("Indica en qué nivel o piso se realizará el evento.");
    if (!form.elevator) throw new Error("Indica si hay elevador disponible.");
    if (!form.unloadingAccess?.trim()) {
      throw new Error("Describe cómo podremos descargar y meter el equipo al lugar.");
    }
    if (!form.setupAccessTime) {
      throw new Error("Indica a qué hora podremos entrar a montar el Coffee Cart.");
    }
    if (!form.electricityDetails?.trim()) {
      throw new Error("Describe la disponibilidad de electricidad.");
    }
    if (!form.potableWater) throw new Error("Indica si hay agua potable disponible.");
    if (
      form.waterDistanceM === "" ||
      form.waterDistanceM === null ||
      form.waterDistanceM === undefined
    ) {
      throw new Error("Indica la distancia aproximada entre el Coffee Cart y el punto de agua.");
    }
    if (form.invoiceRequired && !form.taxName?.trim()) {
      throw new Error("Falta la razón social para la factura.");
    }
    if (form.invoiceRequired && !form.taxRfc?.trim()) {
      throw new Error("Falta el RFC para la factura.");
    }
    if (!form.termsAccepted) {
      throw new Error(
        "Debes confirmar que entiendes qué estás contratando y aceptar las condiciones."
      );
    }

    const hours = durationHours(form.startTime, form.endTime);

    if (hours <= 0) {
      throw new Error("La hora de término debe ser posterior a la hora de inicio.");
    }
  }

  async function createHold() {
    try {
      setBusy("hold");
      setError("");
      setSuccess("");

      validateBeforeHold();

      const hours = durationHours(form.startTime, form.endTime);
      const setupAccessIso = form.setupAccessTime
        ? new Date(form.setupAccessTime).toISOString()
        : "";

      const response = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          durationHours: hours,
          setupAccessTime: setupAccessIso,
          elevator:
            form.elevator === "yes"
              ? true
              : form.elevator === "no"
              ? false
              : null,
          potableWater:
            form.potableWater === "yes"
              ? true
              : form.potableWater === "no"
              ? false
              : null,
          latitude: null,
          longitude: null,
          waterDistanceM:
            form.waterDistanceM === "" ? null : Number(form.waterDistanceM),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible apartar la fecha.");
      }

      setHold({
        bookingId: data.bookingId,
        eventOrderNumber: data.eventOrderNumber,
        holdExpiresAt: data.holdExpiresAt,
      });

      setQuote((current) => ({
        ...current,
        quote: {
          ...current.quote,
          total: data.quote.total,
          deposit: data.quote.deposit,
          balance: data.quote.balance,
        },
      }));

      setSuccess(`Fecha apartada. Tu número de evento es ${data.eventOrderNumber}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function checkout() {
    let paymentWindow = null;

    try {
      setBusy("checkout");
      setError("");

      if (!hold?.bookingId) throw new Error("Primero aparta la fecha.");
      if (remaining !== null && remaining <= 0) {
        throw new Error("El apartado venció. Verifica de nuevo la disponibilidad.");
      }

      paymentWindow = window.open("about:blank", "java_event_checkout");

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: hold.bookingId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
        throw new Error(data.error || "No fue posible iniciar el pago.");
      }

      const confirmationUrl =
        data.confirmationUrl || `/confirmation/${hold.bookingId}`;

      if (data.alreadyPaid) {
        if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
        window.location.assign(confirmationUrl);
        return;
      }

      if (!data.checkoutUrl) {
        if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
        throw new Error("Shopify no devolvió una URL de pago.");
      }

      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.location.replace(data.checkoutUrl);
        window.location.assign(confirmationUrl);
      } else {
        window.location.assign(data.checkoutUrl);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function submitLead() {
    try {
      setBusy("lead");
      setError("");
      setSuccess("");

      const response = await fetch("/api/unsupported-city-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible guardar la solicitud.");
      }

      setSuccess(data.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function uploadFile(file, uploadType) {
    if (!file || !hold?.bookingId) return;

    setBusy(`upload-${uploadType}`);
    setError("");

    try {
      const body = new FormData();
      body.append("bookingId", hold.bookingId);
      body.append("uploadType", uploadType);
      body.append("file", file);

      const response = await fetch("/api/event-upload", {
        method: "POST",
        body,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No fue posible subir el archivo.");
      }

      setSuccess("Archivo guardado correctamente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  if (!config) {
    return (
      <main className="app-shell">
        <div className="container" style={{ paddingTop: 80 }}>
          <div className="panel form-section">
            {error || "Cargando Java Events..."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-bg" />

        <div className="container hero-inner">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Java Times Caffé · Events
          </div>

          <div className="hero-grid">
            <div>
              <h1 className="hero-title">
                Lleva Java Times Caffé <span>a tu evento</span>
              </h1>

              <p className="hero-subtitle">
                Reserva un Java Coffee Cart completo para tu evento. Tú eliges
                fecha, invitados y servicios. Nosotros te mostramos el precio
                total antes de que pagues.
              </p>

              <div className="hero-pills">
                <div className="hero-pill">Cotización clara</div>
                <div className="hero-pill">Fecha reservada</div>
                <div className="hero-pill">Pago seguro</div>
                <div className="hero-pill">Servicio Java</div>
              </div>
            </div>

            <div className="hero-card">
              <div className="hero-card-label">Lo que estás contratando</div>

              <h2 className="hero-card-title">
                Un servicio completo de Coffee Cart para un evento
              </h2>

              <p>
                No estás comprando cafés individuales. Estás contratando el
                Coffee Cart, equipo, montaje, personal y servicio de bebidas
                para el número de invitados seleccionado.
              </p>

              <div className="hero-micro-grid">
                <div className="micro-box">
                  <div className="micro-kicker">Hoy</div>
                  <div className="micro-value">Pagas anticipo</div>
                </div>

                <div className="micro-box">
                  <div className="micro-kicker">Después</div>
                  <div className="micro-value">Liquidas saldo</div>
                </div>

                <div className="micro-box">
                  <div className="micro-kicker">Precio</div>
                  <div className="micro-value">IVA desglosado</div>
                </div>

                <div className="micro-box">
                  <div className="micro-kicker">Reserva</div>
                  <div className="micro-value">Un evento</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container page-grid">
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Cotiza tu Java Coffee Cart</h2>
            <p className="panel-subtitle">
              Sigue los pasos. No se te cobrará nada hasta que veas y aceptes
              el precio de tu evento.
            </p>
          </div>

          <div className="form-section">
            <div className="quote-card" style={{ marginBottom: 28 }}>
              <div className="section-kicker">Antes de empezar</div>
              <h3 style={{ marginTop: 8, marginBottom: 12 }}>
                Así funciona tu reserva
              </h3>

              <div style={{ display: "grid", gap: 12 }}>
                <ExplainerStep
                  number="1"
                  title="Elige tu evento"
                  text="Selecciona ciudad, fecha, horario y número de invitados."
                />
                <ExplainerStep
                  number="2"
                  title="Revisa qué incluye"
                  text="El servicio base incluye Coffee Cart, equipo, montaje, personal asignado, espresso, americano, cappuccino, latte, mocha y té caliente."
                />
                <ExplainerStep
                  number="3"
                  title="Agrega extras si los necesitas"
                  text="Puedes sumar bebidas frías, alimentos, personalización u horas adicionales. Cada extra muestra claramente cómo se cobra."
                />
                <ExplainerStep
                  number="4"
                  title="Ve el precio completo"
                  text={`Antes de reservar verás subtotal, IVA ${vatPercent.toFixed(
                    0
                  )}%, total del evento, anticipo y saldo pendiente.`}
                />
                <ExplainerStep
                  number="5"
                  title="Aparta tu fecha"
                  text={`Al continuar se reserva temporalmente el Coffee Cart durante ${holdMinutes} minutos. Hoy pagarás el anticipo de ${depositPercent.toFixed(
                    0
                  )}% configurado para el evento; el saldo restante no se cobra hoy.`}
                />
              </div>
            </div>

            <div className="section-title">
              <div>
                <div className="section-kicker">1 · Tu evento</div>
                <h3>¿Dónde y cuándo será?</h3>
              </div>
            </div>

            <div className="form-grid">
              <div className="field full">
                <label className="label">Ciudad del evento</label>
                <select
                  className="select"
                  value={form.serviceAreaId}
                  onChange={(e) => update("serviceAreaId", e.target.value)}
                >
                  {config.serviceAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.city}, {area.state}
                    </option>
                  ))}
                  <option value="OTHER">Otra ciudad</option>
                </select>

                <small className="caption">
                  Sólo puedes pagar eventos dentro de una ciudad con cobertura activa.
                </small>
              </div>
            </div>

            {form.serviceAreaId === "OTHER" ? (
              <div className="quote-card">
                <h3>Quiero Java Coffee Cart en otra ciudad</h3>
                <p className="caption">
                  Todavía no podemos cobrarte un evento fuera de las zonas
                  activas, pero podemos guardar tu solicitud para expansión.
                </p>

                <div className="form-grid">
                  <TextField
                    label="Ciudad"
                    value={lead.city}
                    onChange={(value) => setLead({ ...lead, city: value })}
                  />
                  <TextField
                    label="Estado"
                    value={lead.state}
                    onChange={(value) => setLead({ ...lead, state: value })}
                  />
                  <TextField
                    label="Tu nombre"
                    value={lead.customerName}
                    onChange={(value) =>
                      setLead({ ...lead, customerName: value })
                    }
                  />
                  <TextField
                    label="Correo"
                    value={lead.email}
                    onChange={(value) => setLead({ ...lead, email: value })}
                  />
                  <TextField
                    label="Teléfono"
                    value={lead.phone}
                    onChange={(value) => setLead({ ...lead, phone: value })}
                  />
                  <TextField
                    label="Tipo de evento"
                    value={lead.eventType}
                    onChange={(value) =>
                      setLead({ ...lead, eventType: value })
                    }
                  />

                  <div className="field">
                    <label className="label">Fecha estimada</label>
                    <input
                      className="input"
                      type="date"
                      value={lead.expectedDate}
                      onChange={(e) =>
                        setLead({ ...lead, expectedDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="field">
                    <label className="label">Invitados estimados</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={lead.estimatedGuests}
                      onChange={(e) =>
                        setLead({
                          ...lead,
                          estimatedGuests: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <label className="check-card" style={{ marginTop: 15 }}>
                  <input
                    type="checkbox"
                    checked={lead.marketingConsent}
                    onChange={(e) =>
                      setLead({ ...lead, marketingConsent: e.target.checked })
                    }
                  />
                  <div>
                    <div className="check-title">
                      Quiero recibir noticias cuando Java llegue a mi ciudad
                    </div>
                  </div>
                </label>

                <div className="action-row">
                  <button className="button button-primary" onClick={submitLead}>
                    {busy === "lead" ? "Guardando..." : "Enviar solicitud"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-grid">
                  <div className="field">
                    <label className="label">Fecha del evento</label>
                    <input
                      className="input"
                      type="date"
                      value={form.eventDate}
                      onChange={(e) => update("eventDate", e.target.value)}
                    />
                  </div>

                  <TextField
                    label="Tipo de evento"
                    value={form.eventType}
                    onChange={(value) => update("eventType", value)}
                    placeholder="Ej. boda, expo, evento corporativo"
                  />

                  <div className="field">
                    <label className="label">Hora de inicio</label>
                    <input
                      className="input"
                      type="time"
                      value={form.startTime}
                      onChange={(e) => update("startTime", e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Hora de término</label>
                    <input
                      className="input"
                      type="time"
                      value={form.endTime}
                      onChange={(e) => update("endTime", e.target.value)}
                    />
                  </div>

                  <div className="field full">
                    <label className="label">
                      ¿Para cuántos invitados necesitas el servicio?
                    </label>

                    <select
                      className="select"
                      value={form.guestCount}
                      onChange={(e) =>
                        update("guestCount", Number(e.target.value))
                      }
                    >
                      {config.guestTiers.map((tier) => (
                        <option key={tier.id} value={tier.guest_count}>
                          {tier.guest_count} invitados ·{" "}
                          {money(Number(tier.rate_per_guest_cents) / 100)} por invitado
                        </option>
                      ))}
                    </select>

                    <small className="caption">
                      El precio base se calcula automáticamente según el número
                      de invitados seleccionado.
                    </small>
                  </div>
                </div>

                <div className="action-row">
                  <button
                    className="button button-secondary"
                    onClick={checkAvailability}
                    disabled={busy === "availability"}
                  >
                    {busy === "availability"
                      ? "Revisando fecha..."
                      : "Verificar disponibilidad"}
                  </button>
                </div>

                {availability && (
                  <div
                    className={`status ${
                      availability.available ? "success" : "error"
                    }`}
                  >
                    {availability.message}
                  </div>
                )}

                <div className="divider" style={{ margin: "30px 0" }} />

                <div className="section-title">
                  <div>
                    <div className="section-kicker">2 · Lugar</div>
                    <h3>¿Dónde instalaremos el Coffee Cart?</h3>
                  </div>
                </div>

                <p className="caption">
                  Estos datos nos ayudan a confirmar que podemos entrar, montar
                  el equipo y operar el servicio correctamente.
                </p>

                <div className="form-grid">
                  <TextField
                    label="Nombre del lugar"
                    value={form.venueName}
                    onChange={(value) => update("venueName", value)}
                    placeholder="Ej. Casa de Andrés, Salón XYZ"
                  />
                  <TextField
                    label="Calle y número"
                    value={form.eventAddress}
                    onChange={(value) => update("eventAddress", value)}
                    placeholder="Ej. Blvd. Independencia 123"
                  />
                  <TextField
                    label="Colonia"
                    value={form.neighborhood}
                    onChange={(value) => update("neighborhood", value)}
                  />
                  <TextField
                    label="Código postal"
                    value={form.postalCode}
                    onChange={(value) => update("postalCode", value)}
                  />
                </div>

                <div className="divider" style={{ margin: "30px 0" }} />

                <div className="section-title">
                  <div>
                    <div className="section-kicker">3 · Acceso y operación</div>
                    <h3>Lo que necesitamos saber del lugar</h3>
                  </div>
                </div>

                <div className="form-grid">
                  <SelectField
                    label="¿El Coffee Cart estará en interior o exterior?"
                    value={form.indoorOutdoor}
                    onChange={(value) => update("indoorOutdoor", value)}
                    options={[
                      ["", "Selecciona una opción"],
                      ["INDOOR", "Interior"],
                      ["OUTDOOR", "Exterior"],
                      ["BOTH", "Parte interior y parte exterior"],
                    ]}
                  />

                  <TextField
                    label="¿En qué nivel o piso se instalará?"
                    value={form.floor}
                    onChange={(value) => update("floor", value)}
                    placeholder="Ej. planta baja, segundo piso"
                  />

                  <SelectField
                    label="¿Hay elevador disponible para mover equipo?"
                    value={form.elevator}
                    onChange={(value) => update("elevator", value)}
                    options={[
                      ["", "Selecciona una opción"],
                      ["yes", "Sí"],
                      ["no", "No"],
                    ]}
                  />

                  <TextField
                    label="¿Cómo es el acceso para descargar el equipo?"
                    value={form.unloadingAccess}
                    onChange={(value) => update("unloadingAccess", value)}
                    placeholder="Ej. acceso directo por estacionamiento"
                  />

                  <div className="field">
                    <label className="label">
                      ¿Desde qué hora podemos entrar a montar?
                    </label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={form.setupAccessTime}
                      onChange={(e) =>
                        update("setupAccessTime", e.target.value)
                      }
                    />
                  </div>

                  <TextField
                    label="Electricidad disponible"
                    value={form.electricityDetails}
                    onChange={(value) => update("electricityDetails", value)}
                    placeholder="Ej. sí, contacto cercano al área del carrito"
                  />

                  <SelectField
                    label="¿Hay agua potable disponible?"
                    value={form.potableWater}
                    onChange={(value) => update("potableWater", value)}
                    options={[
                      ["", "Selecciona una opción"],
                      ["yes", "Sí"],
                      ["no", "No"],
                    ]}
                  />

                  <TextField
                    label="Distancia aproximada al punto de agua (metros)"
                    value={form.waterDistanceM}
                    onChange={(value) => update("waterDistanceM", value)}
                    placeholder="Ej. 5"
                  />
                </div>

                <div className="divider" style={{ margin: "30px 0" }} />

                <div className="section-title">
                  <div>
                    <div className="section-kicker">4 · Personaliza</div>
                    <h3>Bebidas, alimentos y extras</h3>
                  </div>
                </div>

                <div className="quote-card" style={{ marginBottom: 22 }}>
                  <strong>¿Qué incluye el precio base?</strong>
                  <p className="caption" style={{ marginBottom: 0 }}>
                    Coffee Cart, equipo, montaje, personal asignado y servicio de
                    espresso, americano, cappuccino, latte, mocha y té caliente
                    para el número de invitados contratado.
                  </p>
                </div>

                {Object.entries(groupedAddOns).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 26 }}>
                    <h4>{groupLabel(group)}</h4>

                    <div className="check-grid">
                      {items.map((addOn) => {
                        const selected = form.selectedAddOns.find(
                          (item) => item.code === addOn.code
                        );

                        return (
                          <div className="check-card" key={addOn.id}>
                            <input
                              type="checkbox"
                              checked={Boolean(selected)}
                              onChange={() => toggleAddOn(addOn)}
                            />

                            <div style={{ flex: 1 }}>
                              <div className="check-title">{addOn.name}</div>
                              <div
                                className="check-text"
                                style={{ marginTop: 6, fontWeight: 700 }}
                              >
                                {addOnPriceLabel(addOn)}
                              </div>
                              <div
                                className="check-text"
                                style={{
                                  marginTop: 6,
                                  color: "#9f9f9f",
                                  lineHeight: 1.6,
                                }}
                              >
                                {addOnDescription(addOn)}
                              </div>

                              {selected &&
                                ["PER_HOUR", "PER_UNIT"].includes(
                                  addOn.pricing_type
                                ) && (
                                  <div style={{ marginTop: 12 }}>
                                    <label className="label">
                                      {addOn.pricing_type === "PER_HOUR"
                                        ? "¿Cuántas horas adicionales?"
                                        : "¿Cuántas unidades?"}
                                    </label>

                                    <input
                                      className="input"
                                      type="number"
                                      min="1"
                                      value={selected.quantity}
                                      onChange={(e) =>
                                        setAddOnQuantity(
                                          addOn.code,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="action-row">
                  <button
                    className="button button-primary"
                    onClick={calculateQuote}
                    disabled={busy === "quote"}
                  >
                    {busy === "quote"
                      ? "Calculando..."
                      : "Calcular precio del evento"}
                  </button>
                </div>

                {quote?.quote && (
                  <div className="quote-card">
                    <div className="quote-top">
                      <div>
                        <div className="quote-money-label">Tu evento</div>
                        <div className="quote-place">{selectedArea?.city}</div>
                        <div className="quote-meta">
                          {form.guestCount} invitados ·{" "}
                          {durationHours(form.startTime, form.endTime)} horas
                        </div>
                      </div>

                      <div>
                        <div className="quote-money-label">Total del evento</div>
                        <div className="quote-money">
                          {money(quote.quote.total)}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 20 }}>
                      {quote.quote.items.map((item) => (
                        <div
                          key={`${item.code}-${item.quantity}`}
                          style={{
                            padding: "13px 0",
                            borderBottom: "1px solid rgba(255,255,255,.08)",
                          }}
                        >
                          <div className="summary-row">
                            <span>{itemHumanLabel(item)}</span>
                            <strong>{money(item.lineTotal)}</strong>
                          </div>
                          <div className="caption" style={{ marginTop: 4 }}>
                            {itemCalculation(item)}
                          </div>
                        </div>
                      ))}

                      <div className="summary-row">
                        <span>Subtotal antes de IVA</span>
                        <strong>{money(quote.quote.subtotal)}</strong>
                      </div>

                      <div className="summary-row">
                        <span>IVA {vatPercent.toFixed(0)}%</span>
                        <strong>{money(quote.quote.vat)}</strong>
                      </div>

                      <div className="summary-row">
                        <span>Total del evento</span>
                        <strong>{money(quote.quote.total)}</strong>
                      </div>

                      <div className="summary-row" style={{ marginTop: 12 }}>
                        <span>
                          <strong>Lo que pagarás hoy</strong>
                          <div className="caption">
                            Anticipo para apartar la fecha
                          </div>
                        </span>
                        <strong>{money(quote.quote.deposit)}</strong>
                      </div>

                      <div className="summary-row">
                        <span>Saldo que quedará pendiente</span>
                        <strong>{money(quote.quote.balance)}</strong>
                      </div>

                      <div className="note" style={{ marginTop: 16 }}>
                        El total de tu evento es{" "}
                        <strong>{money(quote.quote.total)}</strong>. Hoy no se
                        cobra todo: hoy pagarás únicamente el anticipo de{" "}
                        <strong>{money(quote.quote.deposit)}</strong>. El saldo de{" "}
                        <strong>{money(quote.quote.balance)}</strong> quedará
                        pendiente.
                      </div>
                    </div>
                  </div>
                )}

                <div className="divider" style={{ margin: "30px 0" }} />

                <div className="section-title">
                  <div>
                    <div className="section-kicker">5 · Tus datos</div>
                    <h3>¿Quién está reservando?</h3>
                  </div>
                </div>

                <div className="form-grid">
                  <TextField
                    label="Nombre completo"
                    value={form.customerName}
                    onChange={(value) => update("customerName", value)}
                  />
                  <TextField
                    label="Teléfono / WhatsApp"
                    value={form.phone}
                    onChange={(value) => update("phone", value)}
                    placeholder="10 dígitos"
                  />
                  <TextField
                    label="Correo electrónico"
                    value={form.email}
                    onChange={(value) => update("email", value)}
                  />

                  <label className="check-card">
                    <input
                      type="checkbox"
                      checked={form.invoiceRequired}
                      onChange={(e) =>
                        update("invoiceRequired", e.target.checked)
                      }
                    />
                    <div>
                      <div className="check-title">Requiero factura</div>
                      <div className="check-text">
                        Actívalo si necesitas capturar datos fiscales.
                      </div>
                    </div>
                  </label>

                  {form.invoiceRequired && (
                    <>
                      <TextField
                        label="Razón social"
                        value={form.taxName}
                        onChange={(value) => update("taxName", value)}
                        placeholder="Como aparece en tu constancia fiscal"
                      />
                      <TextField
                        label="RFC"
                        value={form.taxRfc}
                        onChange={(value) => update("taxRfc", value)}
                      />
                      <TextField
                        label="Uso CFDI"
                        value={form.taxUsage}
                        onChange={(value) => update("taxUsage", value)}
                        placeholder="Ej. G03 Gastos en general"
                      />
                    </>
                  )}

                  <div className="field full">
                    <label className="label">
                      Notas o instrucciones especiales
                    </label>
                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Cuéntanos cualquier restricción, acceso especial o detalle importante."
                    />
                  </div>
                </div>

                <label className="check-card" style={{ marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={form.termsAccepted}
                    onChange={(e) =>
                      update("termsAccepted", e.target.checked)
                    }
                  />

                  <div>
                    <div className="check-title">
                      Entiendo qué estoy contratando y acepto las condiciones
                      del servicio
                    </div>
                    <div className="check-text">
                      Entiendo que estoy contratando un servicio de Java Coffee
                      Cart para un evento, que el precio total aparece arriba,
                      que hoy pagaré únicamente el anticipo para apartar la
                      fecha y que el saldo restante no se cobra hoy.
                    </div>
                  </div>
                </label>

                <div className="action-row">
                  <button
                    className="button button-primary"
                    disabled={busy === "hold"}
                    onClick={createHold}
                  >
                    {busy === "hold"
                      ? "Apartando fecha..."
                      : "Apartar fecha con anticipo"}
                  </button>
                </div>

                {hold && (
                  <div className="hold-card">
                    <div className="section-kicker">
                      Fecha apartada temporalmente
                    </div>

                    <h3>{hold.eventOrderNumber}</h3>
                    <div className="countdown">
                      {formatCountdown(remaining)}
                    </div>
                    <div className="caption">
                      Completa el pago del anticipo antes de que termine este
                      tiempo.
                    </div>

                    <div className="quote-card" style={{ marginTop: 20 }}>
                      <strong>Antes de pagar</strong>
                      <p className="caption" style={{ marginBottom: 0 }}>
                        Shopify abrirá el pago del anticipo. La pestaña de Java
                        permanecerá abierta mostrando el estado de tu evento.
                      </p>
                    </div>

                    <h4 style={{ marginTop: 25 }}>Documentos del lugar</h4>
                    <p className="caption">
                      Si los tienes a la mano, puedes subirlos ahora.
                    </p>

                    <UploadField
                      label="Foto del lugar"
                      onFile={(file) => uploadFile(file, "VENUE_PHOTO")}
                    />
                    <UploadField
                      label="Foto del acceso"
                      onFile={(file) => uploadFile(file, "ACCESS_PHOTO")}
                    />
                    <UploadField
                      label="Layout o plano"
                      onFile={(file) => uploadFile(file, "FLOOR_PLAN")}
                    />
                    <UploadField
                      label="Archivo adicional"
                      onFile={(file) => uploadFile(file, "ADDITIONAL_FILE")}
                    />

                    <div className="action-row">
                      <button
                        className="button button-primary"
                        disabled={busy === "checkout" || remaining === 0}
                        onClick={checkout}
                      >
                        {busy === "checkout"
                          ? "Preparando pago..."
                          : `Pagar anticipo de ${money(
                              quote?.quote?.deposit || 0
                            )}`}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && <div className="status error">{error}</div>}
            {success && <div className="status success">{success}</div>}
          </div>
        </section>

        <aside className="panel summary-card">
          <h3 className="summary-title">Resumen de tu evento</h3>

          <div className="summary-block">
            <div className="summary-row">
              <span>Ciudad</span>
              <strong>
                {form.serviceAreaId === "OTHER"
                  ? "Otra ciudad"
                  : selectedArea
                  ? `${selectedArea.city}, ${selectedArea.state}`
                  : "—"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Invitados</span>
              <strong>{form.guestCount}</strong>
            </div>

            <div className="summary-row">
              <span>Fecha</span>
              <strong>{form.eventDate || "—"}</strong>
            </div>

            <div className="summary-row">
              <span>Horario</span>
              <strong>
                {form.startTime && form.endTime
                  ? `${form.startTime} – ${form.endTime}`
                  : "—"}
              </strong>
            </div>
          </div>

          {quote?.quote ? (
            <>
              <div className="summary-block">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{money(quote.quote.subtotal)}</strong>
                </div>
                <div className="summary-row">
                  <span>IVA {vatPercent.toFixed(0)}%</span>
                  <strong>{money(quote.quote.vat)}</strong>
                </div>
                <div className="summary-row">
                  <span>Total del evento</span>
                  <strong>{money(quote.quote.total)}</strong>
                </div>
              </div>

              <div className="summary-block">
                <div className="section-kicker" style={{ marginBottom: 8 }}>
                  Pago de hoy
                </div>
                <div className="summary-big">
                  {money(quote.quote.deposit)}
                </div>
                <div className="caption">
                  Anticipo para apartar la fecha.
                </div>

                <div className="summary-row" style={{ marginTop: 12 }}>
                  <span>Saldo después del anticipo</span>
                  <strong>{money(quote.quote.balance)}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="note">
              Cuando calcules el precio, aquí verás claramente cuánto cuesta
              todo el evento, cuánto pagarás hoy y cuánto quedará pendiente.
            </div>
          )}

          <div className="brand-quote">
            Java calcula el precio y valida la disponibilidad desde el servidor
            antes de permitir el pago.
          </div>
        </aside>
      </div>
    </main>
  );
}

function ExplainerStep({ number, title, text }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "38px 1fr",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(240,90,34,.18)",
          border: "1px solid rgba(240,90,34,.4)",
          fontWeight: 800,
        }}
      >
        {number}
      </div>

      <div>
        <div style={{ fontWeight: 800, marginBottom: 3 }}>{title}</div>
        <div className="caption">{text}</div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder = "",
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function UploadField({ label, onFile }) {
  return (
    <div className="field" style={{ marginTop: 12 }}>
      <label className="label">{label}</label>
      <input
        className="input"
        type="file"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
