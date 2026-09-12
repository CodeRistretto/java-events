"use client";

import { useEffect, useState } from "react";
import styles from "./website.module.css";

const slots = [
  {
    key: "hero",
    field: "hero_image_url",
    title: "Hero principal",
    help: "Usa una foto horizontal donde el Coffee Cart se vea completo. Recomendado: 1800 × 1100 px o mayor.",
  },
  {
    key: "service",
    field: "service_image_url",
    title: "Foto de servicio",
    help: "Ideal para una foto de operación, barista, carrito o bebidas. Puede ser vertical u horizontal.",
  },
  {
    key: "favicon",
    field: "favicon_url",
    title: "Favicon",
    help: "Usa una imagen cuadrada. Recomendado: PNG de 512 × 512 px.",
  },
];

export default function WebsiteAdminPage() {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const response = await fetch("/api/admin/website", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/admin");
      return;
    }
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "No fue posible cargar las imágenes.");
    setSettings(json.settings);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function upload(slot, file) {
    if (!file) return;
    try {
      setBusy(slot);
      setError("");
      setMessage("");
      const body = new FormData();
      body.append("slot", slot);
      body.append("file", file);
      const response = await fetch("/api/admin/website", { method: "POST", body });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "No fue posible subir la imagen.");
      setSettings(json.settings);
      setMessage("Imagen actualizada. La página pública usará la nueva versión automáticamente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  if (!settings) {
    return <main className={styles.page}><div className={styles.shell}>{error || "Cargando imágenes…"}</div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>JAVA EVENTS · WEBSITE</div>
            <h1>Imágenes del sitio</h1>
            <p>Cambia el hero, la fotografía de servicio y el favicon sin tocar código ni hacer un nuevo commit.</p>
          </div>
          <a className={styles.previewButton} href="/" target="_blank" rel="noreferrer">Ver sitio ↗</a>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.grid}>
          {slots.map((slot) => {
            const url = settings[slot.field];
            return (
              <section className={styles.card} key={slot.key}>
                <div className={`${styles.preview} ${slot.key === "favicon" ? styles.faviconPreview : ""}`}>
                  {url ? <img src={url} alt={slot.title} /> : <div className={styles.empty}>Sin imagen personalizada</div>}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.kicker}>{slot.key.toUpperCase()}</div>
                  <h2>{slot.title}</h2>
                  <p>{slot.help}</p>
                  <label className={styles.uploadButton}>
                    {busy === slot.key ? "Subiendo…" : "Cambiar imagen"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon"
                      disabled={Boolean(busy)}
                      onChange={(e) => upload(slot.key, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </section>
            );
          })}
        </div>

        <section className={styles.tip}>
          <strong>Para que el hero se vea bien</strong>
          <p>Evita imágenes con texto impreso. Deja espacio visual en el lado izquierdo o en el centro para que el título de Java pueda leerse encima sin tapar el carrito.</p>
        </section>
      </div>
    </main>
  );
}
