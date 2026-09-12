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
  cancellationRefundPercent: 50,
};

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

export default function EventPhotoExperience() {
  const pathname = usePathname();
  const [mountNode, setMountNode] = useState(null);
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
          cancellationRefundPercent:
            Number(settings.cancellation_refund_bps ?? 5000) / 100,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/") {
      setMountNode(null);
      return;
    }

    let node = null;
    let hero = null;

    function mount() {
      hero = document.querySelector("main.app-shell .hero");
      const pageGrid = document.querySelector("main.app-shell .page-grid");
      const quotePanel = pageGrid?.querySelector(".panel");

      if (quotePanel && !quotePanel.id) quotePanel.id = "cotiza-java-evento";

      if (hero) {
        hero.classList.add("java-events-real-hero");
        hero.style.setProperty("--java-events-hero-photo", `url(${heroPhoto})`);
      }

      const existing = document.querySelector(".java-events-service-value-mount");
      if (existing) {
        node = existing;
        setMountNode(existing);
        return;
      }

      if (!pageGrid) return;
      node = document.createElement("div");
      node.className = "java-events-service-value-mount container";
      pageGrid.parentElement?.insertBefore(node, pageGrid);
      setMountNode(node);
    }

    const timer = setTimeout(mount, 80);
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      node?.remove();
      if (hero) {
        hero.classList.remove("java-events-real-hero");
        hero.style.removeProperty("--java-events-hero-photo");
      }
    };
  }, [pathname, heroPhoto]);

  if (!mountNode) return null;

  return createPortal(
    <section className="java-events-service-value" aria-label="Qué incluye Java Coffee Cart">
      <div className="java-events-service-copy">
        <div className="java-events-photo-kicker">QUÉ INCLUYE TU SERVICIO</div>
        <h2>Java Coffee Cart, listo para servir tu evento.</h2>
        <p className="java-events-service-intro">
          El precio base incluye Coffee Cart, máquina, molino, montaje, personal y
          servicio de bebidas para el número de invitados contratado.
        </p>

        <div className="java-events-service-grid">
          <div className="java-events-service-card">
            <span>Presentación</span>
            <strong>{service.cupSizeOz} oz</strong>
            <p>Todas las bebidas incluidas se sirven en el mismo tamaño, frías o calientes.</p>
          </div>

          <div className="java-events-service-card">
            <span>Calientes</span>
            <strong>{service.hotDrinks.join(" · ")}</strong>
          </div>

          <div className="java-events-service-card">
            <span>Frías / en las rocas</span>
            <strong>{service.coldDrinks.join(" · ")}</strong>
          </div>

          <div className="java-events-service-card">
            <span>Reserva</span>
            <strong>{service.minimumLeadDays} días mínimo</strong>
            <p>El saldo debe quedar liquidado {service.balanceDueDaysBefore} días antes del evento.</p>
          </div>
        </div>

        <div className="java-events-service-policy">
          <strong>Condición importante de la fecha</strong>
          <p>
            Si el saldo no se liquida dentro del plazo y el evento se cancela por
            falta de pago, se devuelve {service.cancellationRefundPercent}% del
            anticipo. El resto se retiene por logística, preparación y por haber
            bloqueado la fecha para otros clientes.
          </p>
        </div>
      </div>

      <figure className="java-events-service-photo">
        <img src={servicePhoto} alt="Java Coffee Cart operando en un evento" loading="lazy" />
        <figcaption>Servicio real de Java Times Caffé en evento.</figcaption>
      </figure>
    </section>,
    mountNode
  );
}
