"use client";

import { useEffect, useMemo, useState } from "react";

const EMPTY_TEMPLATE = {
  code: "",
  name: "",
  subject_template: "",
  body_template: "",
  active: true,
};

const EMPTY_RULE = {
  id: null,
  code: "",
  name: "",
  template_code: "BALANCE_REMINDER",
  provider: "SHOPIFY_INVOICE",
  trigger_type: "EVENT_DATE_OFFSET",
  offset_days: 15,
  interval_days: 30,
  max_sends: 1,
  requires_deposit_paid: true,
  requires_balance_pending: true,
  requires_marketing_consent: false,
  active: true,
  sort_order: 100,
};

const placeholders = [
  "{{customer_name}}",
  "{{event_ref}}",
  "{{event_date}}",
  "{{total}}",
  "{{deposit}}",
  "{{remaining}}",
  "{{due_date}}",
  "{{confirmation_url}}",
  "{{quote_url}}",
  "{{unsubscribe_url}}",
];

export default function EmailAutomationPage() {
  const [data, setData] = useState(null);
  const [template, setTemplate] = useState(EMPTY_TEMPLATE);
  const [rule, setRule] = useState(EMPTY_RULE);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setError("");
    const response = await fetch("/api/admin/email-settings", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/admin");
      return;
    }
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.error || "No fue posible cargar la automatización.");
    }
    setData(json);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const templateOptions = useMemo(() => data?.templates || [], [data]);

  async function post(body, label) {
    try {
      setBusy(label);
      setError("");
      setMessage("");
      const response = await fetch("/api/admin/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible guardar.");
      }
      setMessage("Cambios guardados.");
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  async function saveTemplate(event) {
    event.preventDefault();
    const ok = await post(
      {
        action: "SAVE_TEMPLATE",
        payload: {
          code: template.code,
          name: template.name,
          subjectTemplate: template.subject_template,
          bodyTemplate: template.body_template,
          active: template.active,
        },
      },
      "template"
    );
    if (ok) setTemplate(EMPTY_TEMPLATE);
  }

  async function saveRule(event) {
    event.preventDefault();
    const ok = await post(
      {
        action: "SAVE_RULE",
        payload: {
          id: rule.id,
          code: rule.code,
          name: rule.name,
          templateCode: rule.template_code,
          provider: rule.provider,
          triggerType: rule.trigger_type,
          offsetDays: rule.offset_days,
          intervalDays: rule.interval_days,
          maxSends: rule.max_sends,
          requiresDepositPaid: rule.requires_deposit_paid,
          requiresBalancePending: rule.requires_balance_pending,
          requiresMarketingConsent: rule.requires_marketing_consent,
          active: rule.active,
          sortOrder: rule.sort_order,
        },
      },
      "rule"
    );
    if (ok) setRule(EMPTY_RULE);
  }

  async function removeRule(item) {
    if (!window.confirm(`Eliminar la automatización “${item.name}”?`)) return;
    await post({ action: "DELETE_RULE", ruleId: item.id }, `delete-${item.id}`);
  }

  if (!data) {
    return <main style={page}><div style={shell}>{error || "Cargando correos…"}</div></main>;
  }

  return (
    <main style={page}>
      <div style={shell}>
        <div style={kicker}>JAVA EVENTS · EMAIL AUTOMATION</div>
        <h1 style={title}>Correos automáticos</h1>
        <p style={intro}>
          Edita el contenido y el calendario sin tocar código. Los recordatorios de saldo
          usan Shopify; los correos de solicitud sin pago y reactivación usan el proveedor
          de correo de Java.
        </p>

        {!data.providerConfigured && (
          <div style={{ ...notice, background: "#fff8f4", color: "#8a3d1d" }}>
            Los correos APP_EMAIL están preparados pero no se enviarán hasta configurar
            RESEND_API_KEY y EVENTS_FROM_EMAIL en Vercel. Los recordatorios Shopify siguen
            funcionando independientemente.
          </div>
        )}

        {error && <div style={{ ...notice, background: "#fff1f2", color: "#9f1522" }}>{error}</div>}
        {message && <div style={{ ...notice, background: "#eff9f1", color: "#176b2b" }}>{message}</div>}

        <section style={card}>
          <div style={kicker}>PLANTILLAS</div>
          <h2 style={h2}>Contenido del correo</h2>
          <p style={muted}>
            Variables disponibles: {placeholders.join(" · ")}
          </p>

          <div style={listGrid}>
            {data.templates.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setTemplate(item)}
                style={miniCard}
              >
                <strong>{item.name}</strong>
                <span>{item.code}</span>
                <small>{item.active ? "Activa" : "Desactivada"}</small>
              </button>
            ))}
            <button type="button" onClick={() => setTemplate(EMPTY_TEMPLATE)} style={addCard}>
              + Nueva plantilla
            </button>
          </div>

          <form onSubmit={saveTemplate} style={formGrid}>
            <Field label="Código">
              <input value={template.code} onChange={(e) => setTemplate({ ...template, code: e.target.value })} placeholder="EJ. FOLLOWUP_30_DAYS" required />
            </Field>
            <Field label="Nombre">
              <input value={template.name} onChange={(e) => setTemplate({ ...template, name: e.target.value })} required />
            </Field>
            <Field label="Asunto" full>
              <input value={template.subject_template} onChange={(e) => setTemplate({ ...template, subject_template: e.target.value })} required />
            </Field>
            <Field label="Mensaje" full>
              <textarea value={template.body_template} onChange={(e) => setTemplate({ ...template, body_template: e.target.value })} rows={7} required />
            </Field>
            <label style={check}><input type="checkbox" checked={template.active} onChange={(e) => setTemplate({ ...template, active: e.target.checked })} /> Plantilla activa</label>
            <button style={primary} disabled={busy === "template"}>{busy === "template" ? "Guardando…" : "Guardar plantilla"}</button>
          </form>
        </section>

        <section style={card}>
          <div style={kicker}>AUTOMATIZACIONES</div>
          <h2 style={h2}>Cuándo debe enviarse</h2>
          <p style={muted}>
            Puedes editar los recordatorios existentes o crear nuevos. Para seguimiento
            mensual sin anticipo, conserva “Requiere consentimiento” activado.
          </p>

          <div style={ruleList}>
            {data.rules.map((item) => (
              <div key={item.id} style={ruleCard}>
                <div>
                  <strong>{item.name}</strong>
                  <div style={ruleMeta}>
                    {item.provider} · {item.trigger_type === "EVENT_DATE_OFFSET" ? `${item.offset_days} días antes` : `cada ${item.interval_days} días · máx. ${item.max_sends}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={secondary} onClick={() => setRule(item)}>Editar</button>
                  <button type="button" style={danger} onClick={() => removeRule(item)} disabled={busy === `delete-${item.id}`}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={saveRule} style={formGrid}>
            <Field label="Código"><input value={rule.code} onChange={(e) => setRule({ ...rule, code: e.target.value })} required /></Field>
            <Field label="Nombre"><input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} required /></Field>
            <Field label="Plantilla">
              <select value={rule.template_code} onChange={(e) => setRule({ ...rule, template_code: e.target.value })}>
                {templateOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Quién envía">
              <select value={rule.provider} onChange={(e) => setRule({ ...rule, provider: e.target.value })}>
                <option value="SHOPIFY_INVOICE">Shopify · factura/checkout de saldo</option>
                <option value="APP_EMAIL">Java · correo informativo/reactivación</option>
              </select>
            </Field>
            <Field label="Tipo de disparo">
              <select value={rule.trigger_type} onChange={(e) => setRule({ ...rule, trigger_type: e.target.value })}>
                <option value="EVENT_DATE_OFFSET">X días antes del evento</option>
                <option value="BOOKING_AGE_INTERVAL">Cada X días desde la solicitud</option>
              </select>
            </Field>

            {rule.trigger_type === "EVENT_DATE_OFFSET" ? (
              <Field label="Días antes del evento"><input type="number" min="0" value={rule.offset_days ?? 0} onChange={(e) => setRule({ ...rule, offset_days: e.target.value })} /></Field>
            ) : (
              <>
                <Field label="Intervalo en días"><input type="number" min="1" value={rule.interval_days ?? 30} onChange={(e) => setRule({ ...rule, interval_days: e.target.value })} /></Field>
                <Field label="Máximo de envíos"><input type="number" min="1" value={rule.max_sends ?? 1} onChange={(e) => setRule({ ...rule, max_sends: e.target.value })} /></Field>
              </>
            )}

            <Field label="Orden"><input type="number" value={rule.sort_order ?? 100} onChange={(e) => setRule({ ...rule, sort_order: e.target.value })} /></Field>

            <div style={{ gridColumn: "1/-1", display: "grid", gap: 9 }}>
              <Toggle label="Requiere anticipo pagado" checked={rule.requires_deposit_paid} onChange={(checked) => setRule({ ...rule, requires_deposit_paid: checked })} />
              <Toggle label="Sólo si existe saldo pendiente" checked={rule.requires_balance_pending} onChange={(checked) => setRule({ ...rule, requires_balance_pending: checked })} />
              <Toggle label="Requiere consentimiento para seguimiento" checked={rule.requires_marketing_consent} onChange={(checked) => setRule({ ...rule, requires_marketing_consent: checked })} />
              <Toggle label="Automatización activa" checked={rule.active} onChange={(checked) => setRule({ ...rule, active: checked })} />
            </div>

            <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={primary} disabled={busy === "rule"}>{busy === "rule" ? "Guardando…" : rule.id ? "Guardar automatización" : "Crear automatización"}</button>
              <button type="button" style={secondary} onClick={() => setRule(EMPTY_RULE)}>Nueva automatización</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({ label, full = false, children }) {
  return <label style={{ ...field, gridColumn: full ? "1/-1" : undefined }}><span>{label}</span>{children}</label>;
}

function Toggle({ label, checked, onChange }) {
  return <label style={check}><input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

const page = { minHeight: "100vh", background: "#f5f5f7", padding: "38px 20px 80px", color: "#1d1d1f" };
const shell = { maxWidth: 1220, margin: "0 auto" };
const kicker = { color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: ".14em" };
const title = { margin: "7px 0 8px", fontSize: "clamp(36px,5vw,58px)", lineHeight: 1, letterSpacing: "-.05em" };
const intro = { margin: "0 0 24px", color: "#6e6e73", lineHeight: 1.65, maxWidth: 800 };
const h2 = { margin: "8px 0 7px", letterSpacing: "-.035em" };
const muted = { color: "#6e6e73", lineHeight: 1.6, fontSize: 13, marginTop: 0 };
const card = { background: "#fff", border: "1px solid rgba(29,29,31,.08)", borderRadius: 24, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,.035)", marginBottom: 18 };
const notice = { padding: "14px 16px", borderRadius: 16, marginBottom: 14, border: "1px solid rgba(29,29,31,.07)", fontSize: 13, lineHeight: 1.55 };
const listGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, margin: "18px 0" };
const miniCard = { textAlign: "left", padding: 14, borderRadius: 16, border: "1px solid rgba(29,29,31,.08)", background: "#fbfbfd", cursor: "pointer", font: "inherit" };
const addCard = { ...miniCard, color: "#f05a22", fontWeight: 650, background: "#fff8f4" };
const formGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 18 };
const field = { display: "grid", gap: 7, fontSize: 12, fontWeight: 600 };
const check = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#3a3a3c" };
const primary = { minHeight: 44, padding: "0 17px", border: 0, borderRadius: 999, background: "#f05a22", color: "#fff", font: "inherit", fontWeight: 650, cursor: "pointer" };
const secondary = { minHeight: 38, padding: "0 13px", borderRadius: 999, border: "1px solid rgba(29,29,31,.12)", background: "#fff", color: "#1d1d1f", font: "inherit", cursor: "pointer" };
const danger = { ...secondary, color: "#9f1522", background: "#fff7f7" };
const ruleList = { display: "grid", gap: 9, margin: "16px 0" };
const ruleCard = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14, border: "1px solid rgba(29,29,31,.08)", borderRadius: 16, background: "#fbfbfd", flexWrap: "wrap" };
const ruleMeta = { color: "#8e8e93", fontSize: 11, marginTop: 5 };
