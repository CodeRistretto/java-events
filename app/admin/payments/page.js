"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dt(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [payments, setPayments] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({
    amount: "",
    paymentMethod: "SPEI",
    reference: "",
    notes: "",
  });

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/config", { cache: "no-store" });

      if (response.status === 401) {
        throw new Error("Inicia sesión primero en /admin.");
      }

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible cargar los eventos.");
      }

      const list = (json.orders || []).filter((order) => order.event_order_number);
      setOrders(list);

      if (!selectedId && list.length) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments(bookingId = selectedId) {
    if (!bookingId) return;

    setError("");

    try {
      const response = await fetch(
        `/api/admin/events/payments?bookingId=${encodeURIComponent(bookingId)}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible cargar pagos.");
      }

      setPayments(json);
      setManual((current) => ({
        ...current,
        amount:
          current.amount ||
          (json.summary?.remaining > 0
            ? Number(json.summary.remaining).toFixed(2)
            : ""),
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (selectedId) loadPayments(selectedId);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((order) =>
      [
        order.event_order_number,
        order.customer_name,
        order.city,
        order.event_date,
        order.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [orders, search]);

  const selectedOrder = orders.find((order) => order.id === selectedId);

  async function createBalanceCheckout() {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      const popup = window.open("", "_blank");

      const response = await fetch("/api/admin/events/balance-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: selectedId }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        if (popup) popup.close();
        throw new Error(json.error || "No fue posible crear el checkout.");
      }

      if (json.alreadyPaid) {
        if (popup) popup.close();
        setMessage("El evento ya está liquidado.");
      } else {
        if (popup) popup.location = json.checkoutUrl;
        else window.open(json.checkoutUrl, "_blank");

        setMessage(
          json.reused
            ? "Se abrió el checkout de saldo pendiente."
            : "Checkout de saldo creado en Shopify."
        );
      }

      await loadPayments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function registerManual(event) {
    event.preventDefault();

    try {
      setBusy(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/events/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTER_MANUAL_PAYMENT",
          payload: {
            bookingId: selectedId,
            ...manual,
          },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible registrar el pago.");
      }

      setMessage("Pago registrado.");
      setManual({
        amount: "",
        paymentMethod: "SPEI",
        reference: "",
        notes: "",
      });
      await loadPayments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function voidManual(payment) {
    const reason = window.prompt("Motivo para anular este pago manual:");
    if (reason === null) return;

    try {
      setBusy(true);
      setError("");

      const response = await fetch("/api/admin/events/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VOID_MANUAL_PAYMENT",
          payload: { paymentId: payment.id, reason },
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible anular el pago.");
      }

      setMessage("Pago manual anulado.");
      await loadPayments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pay-page">
      <div className="pay-shell">
        <header className="pay-header">
          <div>
            <div className="eyebrow">JAVA TIMES CAFFÉ · EVENTS ADMIN</div>
            <h1>Payments & Balances</h1>
            <p>Anticipos, saldos, pagos manuales y cobros Shopify por evento.</p>
          </div>

          <div className="nav">
            <Link href="/admin/events">Calendar</Link>
            <Link href="/admin">Admin principal</Link>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <div className="layout">
          <aside className="events-panel">
            <h2>Eventos</h2>
            <input
              placeholder="Buscar JEV, cliente, ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="event-list">
              {loading ? (
                <p className="muted">Cargando...</p>
              ) : (
                filtered.map((order) => (
                  <button
                    key={order.id}
                    className={order.id === selectedId ? "event-row active" : "event-row"}
                    onClick={() => {
                      setSelectedId(order.id);
                      setManual({
                        amount: "",
                        paymentMethod: "SPEI",
                        reference: "",
                        notes: "",
                      });
                    }}
                  >
                    <strong>{order.event_order_number}</strong>
                    <span>{order.customer_name}</span>
                    <small>
                      {order.event_date} · {order.city} · {order.status}
                    </small>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="detail-panel">
            {!selectedOrder || !payments ? (
              <div className="empty">Selecciona un evento.</div>
            ) : (
              <>
                <div className="event-head">
                  <div>
                    <div className="eyebrow">EVENTO</div>
                    <h2>{selectedOrder.event_order_number}</h2>
                    <p>
                      {selectedOrder.customer_name} · {selectedOrder.event_date} ·{" "}
                      {selectedOrder.city}
                    </p>
                  </div>

                  <Link
                    href={`/confirmation/${selectedOrder.id}`}
                    target="_blank"
                    className="secondary"
                  >
                    Ver comprobante
                  </Link>
                </div>

                <div className="summary-grid">
                  <div><span>Total contratado</span><strong>{money(payments.summary.total)}</strong></div>
                  <div><span>Pagado a la fecha</span><strong>{money(payments.summary.paid)}</strong></div>
                  <div className={payments.summary.remaining > 0 ? "due" : "paid"}>
                    <span>Saldo pendiente</span>
                    <strong>{money(payments.summary.remaining)}</strong>
                  </div>
                </div>

                {!payments.summary.fullyPaid && (
                  <section className="card">
                    <h3>Cobrar saldo por Shopify</h3>
                    <p>
                      Genera un checkout exactamente por el saldo actual. Cuando Shopify
                      marque la orden como pagada, el webhook actualizará el historial.
                    </p>
                    <button disabled={busy} onClick={createBalanceCheckout}>
                      Crear / abrir checkout por {money(payments.summary.remaining)}
                    </button>
                  </section>
                )}

                {!payments.summary.fullyPaid && (
                  <section className="card">
                    <h3>Registrar pago recibido fuera de Shopify</h3>
                    <form className="manual-form" onSubmit={registerManual}>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={payments.summary.remaining}
                        placeholder="Monto MXN"
                        value={manual.amount}
                        onChange={(e) => setManual({ ...manual, amount: e.target.value })}
                        required
                      />
                      <select
                        value={manual.paymentMethod}
                        onChange={(e) =>
                          setManual({ ...manual, paymentMethod: e.target.value })
                        }
                      >
                        <option value="SPEI">SPEI</option>
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta / terminal externa</option>
                        <option value="OTHER">Otro</option>
                      </select>
                      <input
                        placeholder="Referencia / folio"
                        value={manual.reference}
                        onChange={(e) =>
                          setManual({ ...manual, reference: e.target.value })
                        }
                      />
                      <input
                        placeholder="Nota opcional"
                        value={manual.notes}
                        onChange={(e) => setManual({ ...manual, notes: e.target.value })}
                      />
                      <button disabled={busy}>Registrar pago</button>
                    </form>
                  </section>
                )}

                <section className="card">
                  <h3>Historial de pagos</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Origen</th>
                          <th>Referencia</th>
                          <th>Estado</th>
                          <th>Monto</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...payments.payments].reverse().map((payment) => (
                          <tr key={payment.id}>
                            <td>{dt(payment.paidAt || payment.createdAt)}</td>
                            <td>{payment.paymentType}</td>
                            <td>
                              {payment.provider}
                              {payment.paymentMethod ? ` · ${payment.paymentMethod}` : ""}
                            </td>
                            <td>{payment.reference || "—"}</td>
                            <td>{payment.status}</td>
                            <td className="amount">{money(payment.amount)}</td>
                            <td>
                              {payment.provider === "MANUAL" && payment.status === "PAID" && (
                                <button
                                  className="danger"
                                  disabled={busy}
                                  onClick={() => voidManual(payment)}
                                >
                                  Anular
                                </button>
                              )}
                              {payment.status === "PENDING" && payment.checkoutUrl && (
                                <a
                                  className="secondary small"
                                  href={payment.checkoutUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        *{box-sizing:border-box}body{margin:0}.pay-page{min-height:100vh;background:radial-gradient(circle at top left,rgba(240,90,34,.1),transparent 28%),#090909;color:#fff;padding:28px 20px 70px}.pay-shell{max-width:1450px;margin:auto}.pay-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px}.pay-header h1{font-size:clamp(34px,5vw,52px);margin:7px 0}.pay-header p,.muted,.card p,.event-head p{color:#929292}.eyebrow{color:#ff7541;font-size:11px;font-weight:900;letter-spacing:1.6px}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,.secondary{background:#191919;color:#fff;border:1px solid #363636;border-radius:11px;padding:11px 14px;text-decoration:none;font-weight:800}.alert{padding:13px 15px;border-radius:13px;margin-bottom:14px}.error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.28);color:#fca5a5}.success{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28);color:#86efac}.layout{display:grid;grid-template-columns:minmax(280px,.55fr) minmax(0,1.45fr);gap:16px}.events-panel,.detail-panel{background:#141414;border:1px solid #2a2a2a;border-radius:20px;padding:18px}.events-panel{max-height:78vh;overflow:auto}.events-panel h2{margin-top:0}.events-panel input,.manual-form input,.manual-form select{width:100%;background:#1b1b1b;color:#fff;border:1px solid #373737;border-radius:11px;padding:11px 12px;outline:none}.event-list{display:grid;gap:8px;margin-top:12px}.event-row{display:grid;gap:3px;text-align:left;background:#1a1a1a;color:#fff;border:1px solid #2b2b2b;border-radius:12px;padding:12px;cursor:pointer}.event-row span,.event-row small{color:#8f8f8f}.event-row.active{border-color:#f05a22;background:rgba(240,90,34,.08)}.event-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid #292929;padding-bottom:16px}.event-head h2{font-size:32px;margin:6px 0}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.summary-grid>div{padding:16px;border:1px solid #2c2c2c;background:#1c1c1c;border-radius:14px}.summary-grid span{display:block;color:#8f8f8f;font-size:11px}.summary-grid strong{display:block;font-size:clamp(22px,3vw,31px);margin-top:7px}.summary-grid .due{border-color:rgba(245,158,11,.35)}.summary-grid .paid{border-color:rgba(34,197,94,.35)}.card{margin-top:14px;background:#181818;border:1px solid #292929;border-radius:16px;padding:18px}.card h3{margin-top:0}.card button,.manual-form button{background:#f05a22;color:#fff;border:0;border-radius:11px;padding:11px 14px;font-weight:800;cursor:pointer}.card button:disabled{opacity:.55}.manual-form{display:grid;grid-template-columns:1fr 1fr 1.2fr 1.2fr auto;gap:8px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:850px}th,td{padding:11px 9px;border-bottom:1px solid #292929;text-align:left;font-size:12px}th{color:#777;font-size:10px}.amount{font-weight:900;white-space:nowrap}.danger{background:rgba(239,68,68,.1)!important;color:#fca5a5!important;border:1px solid rgba(239,68,68,.28)!important}.small{display:inline-block;padding:7px 9px!important;font-size:11px}.empty{color:#888;padding:30px;text-align:center}@media(max-width:950px){.layout{grid-template-columns:1fr}.events-panel{max-height:none}.manual-form{grid-template-columns:1fr 1fr}.summary-grid{grid-template-columns:1fr}}@media(max-width:600px){.pay-page{padding:16px 10px 50px}.pay-header,.event-head{flex-direction:column}.manual-form{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
