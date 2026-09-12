"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PHOTOS = {
  hero: "/events/java-events-hero.webp",
  gallery: "/events/java-events-gallery.webp",
  cart01: "/events/java-event-cart-01.webp",
  cart02: "/events/java-event-cart-02.webp",
};

export default function EventPhotoExperience() {
  const pathname = usePathname();
  const [heroMount, setHeroMount] = useState(null);
  const [galleryMount, setGalleryMount] = useState(null);

  useEffect(() => {
    if (pathname !== "/") {
      setHeroMount(null);
      setGalleryMount(null);
      return;
    }

    let heroNode = null;
    let galleryNode = null;

    function mount() {
      const heroInner = document.querySelector("main.app-shell .hero .hero-inner");
      const pageGrid = document.querySelector("main.app-shell .page-grid");
      const quotePanel = pageGrid?.querySelector(".panel");

      if (quotePanel && !quotePanel.id) quotePanel.id = "cotiza-java-evento";

      if (heroInner && !document.querySelector(".java-events-photo-hero-mount")) {
        heroNode = document.createElement("div");
        heroNode.className = "java-events-photo-hero-mount";
        heroInner.appendChild(heroNode);
        setHeroMount(heroNode);
      } else {
        heroNode = document.querySelector(".java-events-photo-hero-mount");
        if (heroNode) setHeroMount(heroNode);
      }

      if (pageGrid && !document.querySelector(".java-events-photo-gallery-mount")) {
        galleryNode = document.createElement("div");
        galleryNode.className = "java-events-photo-gallery-mount container";
        pageGrid.parentElement?.insertBefore(galleryNode, pageGrid);
        setGalleryMount(galleryNode);
      } else {
        galleryNode = document.querySelector(".java-events-photo-gallery-mount");
        if (galleryNode) setGalleryMount(galleryNode);
      }
    }

    const timer = setTimeout(mount, 80);
    const observer = new MutationObserver(() => mount());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      heroNode?.remove();
      galleryNode?.remove();
    };
  }, [pathname]);

  return (
    <>
      {heroMount &&
        createPortal(
          <section className="java-events-photo-hero" aria-label="Java Coffee Cart en eventos">
            <div className="java-events-photo-hero-main">
              <img
                src={PHOTOS.hero}
                alt="Java Coffee Cart instalado en un evento"
                loading="eager"
              />
              <div className="java-events-photo-hero-overlay">
                <div>
                  <span>JAVA COFFEE CART</span>
                  <strong>El buen café también hace grandes historias.</strong>
                </div>
                <a href="#cotiza-java-evento">Cotiza tu evento →</a>
              </div>
            </div>

            <div className="java-events-photo-hero-side">
              <figure>
                <img src={PHOTOS.cart01} alt="Detalle del Java Coffee Cart" loading="lazy" />
              </figure>
              <figure>
                <img src={PHOTOS.cart02} alt="Servicio Java Times Caffé en evento" loading="lazy" />
              </figure>
            </div>
          </section>,
          heroMount
        )}

      {galleryMount &&
        createPortal(
          <section className="java-events-photo-gallery" aria-label="Experiencia Java en eventos">
            <div className="java-events-photo-gallery-copy">
              <div className="java-events-photo-kicker">JAVA EN TU EVENTO</div>
              <h2>Un Coffee Cart que se ve tan bien como el café que servimos.</h2>
              <p>
                Montaje, equipo, personal y servicio Java Times Caffé en un solo formato.
                Diseñado para bodas, cumpleaños, eventos empresariales y celebraciones especiales.
              </p>
            </div>

            <div className="java-events-photo-gallery-grid">
              <figure className="java-events-photo-gallery-feature">
                <img src={PHOTOS.gallery} alt="Experiencia Java Times Caffé para eventos" loading="lazy" />
              </figure>
              <figure>
                <img src={PHOTOS.cart01} alt="Java Coffee Cart en operación" loading="lazy" />
              </figure>
              <figure>
                <img src={PHOTOS.cart02} alt="Detalle del servicio Java Coffee Cart" loading="lazy" />
              </figure>
            </div>
          </section>,
          galleryMount
        )}
    </>
  );
}
