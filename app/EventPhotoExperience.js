"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const FALLBACK_HERO = "/events/java-event-cart-02.webp";
const FALLBACK_SERVICE = "/events/java-event-cart-01.webp";

const FALLBACK = {
  cupSizeOz: 12,
  hotDrinks: ["Latte", "Caramel Latte", "Mocha Latte"],
  coldDrinks: ["Latte en las rocas", "Caramel Rocks Latte", "Mocha Latte Rocks"],
  minimumLeadDays: 7,
  balanceDueDaysBefore: 3,
  depositPercent: 40,
  standardDurationHours: 2,
  minimumGuests: 100,
  maximumGuests: 400,
  cartLengthCm: 320,
  cartWidthCm: 150,
  passageCm: 100,
  coldPriceCents: 0,
  extraHourCents: 0,
  cities: [],
};

function moneyFromCents(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100);
}

function setFavicon(url) {
  if (!url || typeof document === "undefined") return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

function openQuote() {
  const launch = document.querySelector(".java-quote-wizard-launch");
  if (launch) {
    launch.click();
    return;
  }
  document.getElementById("cotiza-java-evento")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function scrollToIncludes() {
  document.getElementById("java-events-incluye")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export default function EventPhotoExperience() {
  const pathname = usePathname();
  const [heroMount, setHeroMount] = useState(null);
  const [landingMount, setLandingMount] = useState(null);
  const [quoteMount, setQuoteMount] = useState(null);
  const [coldSelected, setColdSelected] = useState(false);
  const [heroPhoto, setHeroPhoto] = useState(FALLBACK_HERO);
  const [servicePhoto, setServicePhoto] = useState(FALLBACK_SERVICE);
  const [service, setService] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/event-config", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        const settings = data.settings || {};
        const coldAddOn = (data.addOns || []).find((item) => item.code === "COLD_BEVERAGES");
        const extraHour = (data.addOns || []).find((item) => item.code === "ADDITIONAL_HOUR");

        setHeroPhoto(settings.hero_image_url || FALLBACK_HERO);
        setServicePhoto(settings.service_image_url || FALLBACK_SERVICE);
        setFavicon(settings.favicon_url || null);

        setService({
          cupSizeOz: Number(settings.cup_size_oz ?? 12),
          hotDrinks: Array.isArray(settings.included_hot_drinks)
            ? settings.included_hot_drinks
            : FALLBACK.hotDrinks,
          coldDrinks: Array.isArray(settings.included_cold_drinks)
            ? settings.included_cold_drinks
            : FALLBACK.coldDrinks,
          minimumLeadDays: Number(settings.minimum_lead_days ?? 7),
          balanceDueDaysBefore: Number(settings.balance_due_days_before ?? 3),
          depositPercent: Number(settings.deposit_bps ?? 4000) / 100,
          standardDurationHours: Number(settings.standard_duration_hours ?? 2),
          minimumGuests: Number(settings.minimum_guests ?? 100),
          maximumGuests: Number(settings.maximum_guests ?? 400),
          cartLengthCm: Number(settings.cart_operating_length_cm ?? 320),
          cartWidthCm: Number(settings.cart_operating_width_cm ?? 150),
          passageCm: Number(settings.minimum_passage_width_cm ?? 100),
          coldPriceCents: Number(coldAddOn?.unit_price_cents || 0),
          extraHourCents: Number(extraHour?.unit_price_cents || 0),
          cities: (data.serviceAreas || []).map((area) => area.city).filter(Boolean),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/") {
      setHeroMount(null);
      setLandingMount(null);
      return;
    }

    let hero = null;
    let heroNode = null;
    let landingNode = null;
    let observer = null;

    function mount() {
      hero = document.querySelector("main.app-shell .hero");
      const heroInner = hero?.querySelector(".hero-inner");
      const pageGrid = document.querySelector("main.app-shell .page-grid");
      const quotePanel = pageGrid?.querySelector("section.panel");

      if (!hero || !heroInner || !pageGrid) return false;
      if (quotePanel && !quotePanel.id) quotePanel.id = "cotiza-java-evento";

      hero.classList.add("java-events-real-hero", "java-events-marketing-hero");

      heroNode = heroInner.querySelector(".java-events-hero-mount");
      if (!heroNode) {
        heroNode = document.createElement("div");
        heroNode.className = "java-events-hero-mount";
        heroInner.appendChild(heroNode);
      }

      landingNode = document.querySelector(".java-events-landing-mount");
      if (!landingNode) {
        landingNode = document.createElement("div");
        landingNode.className = "java-events-landing-mount container";
        pageGrid.parentElement?.insertBefore(landingNode, pageGrid);
      }

      setHeroMount(heroNode);
      setLandingMount(landingNode);
      return true;
    }

    const timer = setTimeout(() => {
      if (mount()) return;
      observer = new MutationObserver(() => {
        if (mount()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, 40);

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      heroNode?.remove();
      landingNode?.remove();
      if (hero) hero.classList.remove("java-events-real-hero", "java-events-marketing-hero");
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const hero = document.querySelector("main.app-shell .hero");
    if (!hero) return;
    hero.style.setProperty("--java-events-hero-photo", `url(${heroPhoto})`);
    return () => hero.style.removeProperty("--java-events-hero-photo");
  }, [pathname, heroPhoto]);

  useEffect(() => {
    if (pathname !== "/") return;

    function syncQuoteMount() {
      const quoteCard = Array.from(document.querySelectorAll("main.app-shell .quote-card")).find(
        (card) => card.querySelector(".quote-money")
      );

      if (!quoteCard) {
        setQuoteMount(null);
        setColdSelected(false);
        return;
      }

      let mount = quoteCard.querySelector(".java-quote-confidence-mount");
      if (!mount) {
        mount = document.createElement("div");
        mount.className = "java-quote-confidence-mount";
        quoteCard.appendChild(mount);
      }

      const text = String(quoteCard.textContent || "").toLowerCase();
      setColdSelected(
        text.includes("bebidas frías") ||
          text.includes("bebidas frias") ||
          text.includes("cold beverage")
      );
      setQuoteMount((current) => (current === mount ? current : mount));
    }

    syncQuoteMount();
    const interval = window.setInterval(syncQuoteMount, 600);
    return () => window.clearInterval(interval);
  }, [pathname]);

  if (pathname !== "/") return null;

  const balancePercent = Math.max(0, 100 - service.depositPercent);
  const citiesText = service.cities.length ? service.cities.join(", ") : "zonas con cobertura activa";

  return (
    <>
      {heroMount &&
        createPortal(
          <div className="java-events-hero-content">
            <div className="java-events-hero-kicker">JAVA TIMES CAFFÉ · EVENTS</div>
            <h1>
              Tu evento merece café de verdad. <span>Java lo lleva hasta ti.</span>
            </h1>
            <p className="java-events-hero-lead">
              Coffee Cart, equipo, montaje y personal Java en un solo servicio. Elige
              fecha, invitados y extras; ve el precio completo antes de pagar.
            </p>

            <div className="java-events-hero-actions">
              <button type="button" className="primary" onClick={openQuote}>
                Cotizar mi evento →
              </button>
              <button type="button" className="secondary" onClick={scrollToIncludes}>
                Ver qué incluye
              </button>
            </div>

            <div className="java-events-payment-promise">
              <div>
                <small>HOY</small>
                <strong>{service.depositPercent.toFixed(0)}% de anticipo</strong>
              </div>
              <div className="java-events-payment-arrow">→</div>
              <div>
                <small>DESPUÉS</small>
                <strong>{balancePercent.toFixed(0)}% restante</strong>
                <span>Liquídalo a más tardar {service.balanceDueDaysBefore} días antes.</span>
              </div>
            </div>

            <div className="java-events-hero-proof">
              <span>Precio transparente</span>
              <span>IVA desglosado</span>
              <span>Pago seguro con Shopify</span>
              <span>Fecha validada antes de cobrar</span>
            </div>
          </div>,
          heroMount
        )}

      {landingMount &&
        createPortal(
          <div className="java-events-landing">
            <section className="java-events-value-strip" aria-label="Ventajas del servicio">
              <div>
                <span>01</span>
                <strong>Nosotros operamos todo</strong>
                <p>No rentas una máquina. Contratas un servicio completo para tus invitados.</p>
              </div>
              <div>
                <span>02</span>
                <strong>Sabes cuánto cuesta antes de pagar</strong>
                <p>Invitados, extras, IVA, anticipo y saldo quedan claros desde la cotización.</p>
              </div>
              <div>
                <span>03</span>
                <strong>No pagas todo hoy</strong>
                <p>El anticipo aparta la fecha y el saldo se liquida {service.balanceDueDaysBefore} días antes.</p>
              </div>
            </section>

            <section className="java-events-story" aria-label="Java para todo tipo de eventos">
              <div className="java-events-story-copy">
                <div className="java-events-photo-kicker">HAZ QUE EL CAFÉ SEA PARTE DEL EVENTO</div>
                <h2>Una experiencia que tus invitados sí recuerdan.</h2>
                <p>
                  Bodas, cumpleaños, expos, eventos corporativos, lanzamientos, reuniones
                  privadas y celebraciones especiales. Java llega, monta, sirve y opera.
                </p>
                <div className="java-events-event-types">
                  <span>Bodas</span><span>Corporativos</span><span>Expos</span><span>Cumpleaños</span>
                  <span>Activaciones</span><span>Eventos privados</span>
                </div>
                <button type="button" className="java-events-inline-cta" onClick={openQuote}>
                  Quiero saber cuánto cuesta →
                </button>
              </div>
              <figure className="java-events-story-photo">
                <img src={servicePhoto} alt="Java Coffee Cart atendiendo un evento" loading="lazy" />
              </figure>
            </section>

            <section className="java-events-how" aria-label="Cómo funciona">
              <div className="java-events-section-heading">
                <div className="java-events-photo-kicker">FÁCIL, CLARO Y SIN SORPRESAS</div>
                <h2>Cotizar tu Coffee Cart toma unos minutos.</h2>
                <p>No necesitas hablar con un vendedor para conocer el precio.</p>
              </div>
              <div className="java-events-how-grid">
                <article><span>1</span><strong>Elige fecha e invitados</strong><p>Selecciona ciudad, día, horario y tamaño del evento.</p></article>
                <article><span>2</span><strong>Personaliza</strong><p>Agrega bebidas frías u horas adicionales sólo si las necesitas.</p></article>
                <article><span>3</span><strong>Ve el precio real</strong><p>Revisas subtotal, IVA, total, anticipo de hoy y saldo pendiente.</p></article>
                <article><span>4</span><strong>Aparta la fecha</strong><p>Pagas {service.depositPercent.toFixed(0)}% hoy y liquidas el resto antes del evento.</p></article>
              </div>
            </section>

            <section id="java-events-incluye" className="java-events-includes" aria-label="Qué incluye Java Coffee Cart">
              <div className="java-events-section-heading compact">
                <div className="java-events-photo-kicker">TODO LO NECESARIO PARA SERVIR</div>
                <h2>¿Qué incluye tu Java Coffee Cart?</h2>
                <p>La idea es simple: tú organizas tu evento; Java se encarga del café.</p>
              </div>

              <div className="java-events-includes-grid">
                <article>
                  <div className="icon">☕</div>
                  <strong>Coffee Cart + equipo</strong>
                  <p>Carrito, máquina de espresso, molino y equipo necesario para operar el servicio.</p>
                </article>
                <article>
                  <div className="icon">●</div>
                  <strong>Personal Java</strong>
                  <p>Personal asignado para montar y operar el Coffee Cart. No necesitas aportar baristas.</p>
                </article>
                <article>
                  <div className="icon">12</div>
                  <strong>Bebidas de {service.cupSizeOz} oz</strong>
                  <p>La presentación del servicio es de {service.cupSizeOz} oz, tanto en bebidas calientes como frías.</p>
                </article>
                <article>
                  <div className="icon">↗</div>
                  <strong>{service.standardDurationHours} horas base</strong>
                  <p>Puedes extender el servicio; las horas adicionales se calculan automáticamente.</p>
                </article>
              </div>

              <div className="java-events-menu-grid">
                <div>
                  <span>CALIENTES INCLUIDAS</span>
                  <strong>{service.hotDrinks.join(" · ")}</strong>
                </div>
                <div>
                  <span>FRÍAS / EN LAS ROCAS</span>
                  <strong>{service.coldDrinks.join(" · ")}</strong>
                  <p>
                    {service.coldPriceCents > 0
                      ? `Disponibles agregando el servicio de bebidas frías desde ${moneyFromCents(service.coldPriceCents)} por invitado.`
                      : "Disponibles según la configuración de tu cotización."}
                  </p>
                </div>
              </div>
            </section>

            <section className="java-events-payment-section" aria-label="Forma de pago">
              <div>
                <div className="java-events-photo-kicker">RESERVA SIN LIQUIDAR TODO HOY</div>
                <h2>Primero apartas. Después liquidas.</h2>
                <p>
                  Una vez validada la fecha, el anticipo confirma tu reserva. El resto queda
                  pendiente y debe quedar liquidado a más tardar {service.balanceDueDaysBefore} días antes del evento.
                </p>
              </div>
              <div className="java-events-payment-card">
                <div><span>Hoy</span><strong>{service.depositPercent.toFixed(0)}%</strong><small>Anticipo para apartar</small></div>
                <div className="line" />
                <div><span>Después</span><strong>{balancePercent.toFixed(0)}%</strong><small>Saldo antes del evento</small></div>
              </div>
            </section>

            <section className="java-events-faq" aria-label="Preguntas frecuentes">
              <div className="java-events-section-heading compact">
                <div className="java-events-photo-kicker">ANTES DE COTIZAR</div>
                <h2>Lo importante, sin letra pequeña escondida.</h2>
              </div>
              <div className="java-events-faq-grid">
                <details><summary>¿Con cuánto tiempo debo reservar?</summary><p>Con mínimo {service.minimumLeadDays} días de anticipación. El calendario bloquea automáticamente fechas que ya no cumplen ese plazo.</p></details>
                <details><summary>¿Para cuántas personas puedo cotizar?</summary><p>Actualmente el cotizador trabaja de {service.minimumGuests} a {service.maximumGuests} invitados, según las opciones activas.</p></details>
                <details><summary>¿Qué necesita el lugar?</summary><p>Área firme de al menos {service.cartLengthCm} × {service.cartWidthCm} cm, recorrido mínimo de {service.passageCm} cm y conexión eléctrica accesible. Java lleva su agua potable.</p></details>
                <details><summary>¿Puedo contratar más tiempo?</summary><p>Sí. El servicio base contempla {service.standardDurationHours} horas. Si eliges más tiempo, el cotizador agrega automáticamente las horas adicionales{service.extraHourCents > 0 ? ` desde ${moneyFromCents(service.extraHourCents)} + IVA por hora` : ""}.</p></details>
                <details><summary>¿En qué ciudades está disponible?</summary><p>El selector sólo muestra ciudades con cobertura activa. Actualmente: {citiesText}.</p></details>
                <details><summary>¿Cuándo queda realmente apartada la fecha?</summary><p>Después de validar disponibilidad y pagar el anticipo. Antes de eso, la fecha todavía puede ser tomada por otro evento.</p></details>
              </div>
            </section>

            <section className="java-events-final-cta">
              <div>
                <div className="java-events-photo-kicker">¿LISTO PARA VER TU PRECIO?</div>
                <h2>Arma tu evento. Ve el total. Decide después.</h2>
                <p>Cotizar no realiza ningún cobro.</p>
              </div>
              <button type="button" onClick={openQuote}>Cotizar mi Java Coffee Cart →</button>
            </section>
          </div>,
          landingMount
        )}

      {quoteMount &&
        createPortal(
          <section className="java-quote-confidence" aria-label="Qué incluye esta cotización">
            <div className="java-quote-confidence-head">
              <div>
                <span>ESTO ES LO QUE ESTÁS CONTRATANDO</span>
                <h4>Tu evento, cubierto por Java.</h4>
              </div>
              <strong>{service.cupSizeOz} oz</strong>
            </div>

            <div className="java-quote-confidence-grid">
              <div><span>Servicio</span><strong>Java Coffee Cart + equipo + montaje</strong></div>
              <div><span>Personal</span><strong>Equipo Java asignado para operar el servicio</strong></div>
              <div><span>Bebidas calientes</span><strong>{service.hotDrinks.join(" · ")}</strong></div>
              <div>
                <span>Bebidas frías</span>
                <strong>
                  {coldSelected
                    ? service.coldDrinks.join(" · ")
                    : "Disponibles como servicio adicional"}
                </strong>
              </div>
            </div>

            <div className="java-quote-confidence-payment">
              <div>
                <span>Hoy</span>
                <strong>Sólo pagas el anticipo</strong>
                <p>Eso es lo que aparta tu fecha después de validar disponibilidad.</p>
              </div>
              <div>
                <span>Saldo</span>
                <strong>Se liquida {service.balanceDueDaysBefore} días antes</strong>
                <p>No se cobra el total del evento hoy.</p>
              </div>
            </div>

            <p className="java-quote-confidence-note">
              Extras elegidos, horas adicionales e IVA aparecen en el desglose de arriba.
              Antes del pago, Java vuelve a validar precio y disponibilidad.
            </p>
          </section>,
          quoteMount
        )}
    </>
  );
}
