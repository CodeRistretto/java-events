"use client";

import { useEffect, useState } from "react";

export default function CommunicationsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/communications", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/admin");
          return null;
        }
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "No fue posible cargar el historial.");
        return json;
      })
      .then((json) => json && setData(json))
      .catch((e) => setError(e.message));
  }, []);

  const page = {
    minHeight: "100vh",
    background: "#f5f5f7",
    color: "#1d1d1f",
    padding: "38px 20px 80px",
  };
  const shell = { maxWidth: 1220, margin: "0 auto" };
  const card = {
    background: "#fff",
    border: "1px solid rgba(29,29,31,.08)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,.035)",
  };

  if (!data) return <main style={page}><div style={shell}>{error || "Cargando automatizaciones…"}</div></main>;

  return (
    <main style={page}>
      <div style={shell}>
        <div style={{ color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: ".14em" }}>JAVA EVENTS · COMMUNICATIONS</div>
        <h1 style={{ margin: "7px 0 8px", fontSize: "clamp(36px,5vw,58px)", letterSpacing: "-.05em", lineHeight: 1 }}>Correos y recordatorios</h1>
        <p style={{ margin: "0 0 26px", color: "#6e6e73", maxWidth: 760, lineHeight: 1.6 }}>
          Java usa Shopify para enviar los recordatorios de saldo con una liga de pago segura.
        </p>

        {error && <div style={{ ...card, marginBottom: 18, color: "#9f1522", background: "#fff1f2" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 18 }}>
          <section style={card}>
            <div style={{ color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: ".12em" }}>CALENDARIO AUTOMÁTICO</div>
            <h2 style={{ margin: "8px 0 14px", letterSpacing: "-.035em" }}>Antes del evento</h2>
            {["15 días · primer recordatorio", "7 días · segundo recordatorio", "6 días · recordatorio diario", "5 días · recordatorio diario", "4 días · recordatorio diario", "3 días · fecha límite de liquidación"].map((item) => (
              <div key={item} style={{ padding: "11px 0", borderBottom: "1px solid rgba(29,29,31,.08)", fontSize: 13 }}>{item}</div>
            ))}
          </section>

          <section style={card}>
            <div style={{ color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: ".12em" }}>REGLA</div>
            <h2 style={{ margin: "8px 0 10px", letterSpacing: "-.035em" }}>Sólo mientras exista saldo</h2>
            <p style={{ color: "#6e6e73", lineHeight: 1.65, margin: 0 }}>
              Cuando Shopify confirma el pago completo, Java deja de enviar recordatorios. El saldo vence {data.settings?.balance_due_days_before ?? 3} días antes del evento.
            </p>
          </section>
        </div>

        <section style={card}>
          <div style={{ color: "#f05a22", fontSize: 10, fontWeight: 700, letterSpacing: ".12em" }}>HISTORIAL</div>
          <h2 style={{ margin: "8px 0 16px", letterSpacing: "-.035em" }}>Recordatorios enviados</h2>

          {!data.logs?.length ? (
            <p style={{ color: "#6e6e73" }}>Todavía no hay recordatorios registrados.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Enviado", "Evento", "Cliente", "Recordatorio", "Asunto"].map((title) => (
                      <th key={title} style={{ textAlign: "left", padding: "10px 9px", color: "#8e8e93", borderBottom: "1px solid rgba(29,29,31,.1)" }}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((item) => (
                    <tr key={item.id}>
                      <td style={cell}>{new Date(item.sent_at).toLocaleString("es-MX")}</td>
                      <td style={cell}>{item.booking?.event_order_number || item.booking_id.slice(0, 8)}</td>
                      <td style={cell}>{item.booking?.customer_name || item.recipient}</td>
                      <td style={cell}>{item.reminder_key}</td>
                      <td style={cell}>{item.subject}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const cell = {
  padding: "12px 9px",
  borderBottom: "1px solid rgba(29,29,31,.07)",
  verticalAlign: "top",
};
