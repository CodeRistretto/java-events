"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./service.module.css";

function money(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(cents || 0) / 100);
}

function listToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export default function ServiceAdminPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    const response = await fetch("/api/admin/service", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/admin");
      return;
    }
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "No fue posible cargar la configuración.");
    setData(json);
    setForm({
      cupSizeOz: json.settings.cup_size_oz ?? 12,
      hotDrinks: listToText(json.settings.included_hot_drinks),
      coldDrinks: listToText(json.settings.included_cold_drinks),
      minimumLeadDays: json.settings.minimum_lead_days ?? 7,
      balanceDueDaysBefore: json.settings.balance_due_days_before ?? 3,
      cancellationRefundPercent: Number(json.settings.cancellation_refund_bps || 0) / 100,
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const leadCount = useMemo(() => data?.leads?.length || 0, [data]);

  async function save() {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const response = await fetch("/api/admin/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_SERVICE_RULES", payload: form }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "No se pudo guardar.");
      setMessage("Servicio y condiciones actualizados.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data || !form) {
    return <main className={styles.page}><div className={styles.shell}>{error || "Cargando…"}</div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>JAVA EVENTS · SERVICE CONTROL</div>
            <h1>Servicio, bebidas y condiciones</h1>
            <p>Lo que aparece en el cotizador se controla desde aquí.</p>
          </div>
          <div className={styles.stat}><span>Interesados cotizados</span><strong>{leadCount}</strong></div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.kicker}>INCLUIDO EN EL SERVICIO</div>
              <h2>Bebidas</h2>
              <p>Una bebida por servicio en presentación de {form.cupSizeOz} oz. Puedes cambiar esta lista sin tocar código.</p>
            </div>
          </div>

          <div className={styles.grid3}>
            <label className={styles.field}>
              <span>Tamaño del vaso (oz)</span>
              <input type="number" min="1" value={form.cupSizeOz} onChange={(e) => setForm({ ...form, cupSizeOz: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span>Bebidas calientes · una por línea</span>
              <textarea value={form.hotDrinks} onChange={(e) => setForm({ ...form, hotDrinks: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span>Bebidas frías · una por línea</span>
              <textarea value={form.coldDrinks} onChange={(e) => setForm({ ...form, coldDrinks: e.target.value })} />
            </label>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.kicker}>REGLAS DE RESERVA</div>
              <h2>Anticipación, saldo y cancelación</h2>
            </div>
          </div>

          <div className={styles.grid3}>
            <label className={styles.field}>
              <span>Días mínimos de anticipación</span>
              <input type="number" min="0" value={form.minimumLeadDays} onChange={(e) => setForm({ ...form, minimumLeadDays: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span>Saldo liquidado antes del evento (días)</span>
              <input type="number" min="0" value={form.balanceDueDaysBefore} onChange={(e) => setForm({ ...form, balanceDueDaysBefore: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span>% del anticipo que se devuelve si se cancela por falta de pago</span>
              <input type="number" min="0" max="100" value={form.cancellationRefundPercent} onChange={(e) => setForm({ ...form, cancellationRefundPercent: e.target.value })} />
            </label>
          </div>

          <div className={styles.policyPreview}>
            <strong>Texto que verá el cliente</strong>
            <p>La reserva debe realizarse con al menos {form.minimumLeadDays} días de anticipación. El saldo completo debe quedar pagado a más tardar {form.balanceDueDaysBefore} días antes del evento. Si el saldo no se liquida dentro del plazo y el evento se cancela por falta de pago, se devuelve {form.cancellationRefundPercent}% del anticipo; el resto se retiene por costos de logística, preparación y por haber bloqueado la fecha para otros clientes.</p>
          </div>

          <button className={styles.save} onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.kicker}>BASE DE INTERESADOS</div>
              <h2>Cotizaciones con datos</h2>
              <p>Se guarda cuando una persona ve su precio y decide continuar dejando sus datos.</p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Fecha</th><th>Nombre</th><th>Contacto</th><th>Invitados</th><th>Cotización</th><th>Estado</th></tr></thead>
              <tbody>
                {(data.leads || []).map((lead) => (
                  <tr key={lead.id}>
                    <td>{new Date(lead.created_at).toLocaleString("es-MX")}</td>
                    <td>{lead.customer_name}</td>
                    <td><div>{lead.email}</div><div>{lead.phone}</div></td>
                    <td>{lead.guest_count || "—"}</td>
                    <td>{lead.quote_total_cents ? money(lead.quote_total_cents) : "—"}</td>
                    <td>{lead.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
