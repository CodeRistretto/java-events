"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "../events.module.css";

const LABEL = {
  HOLD: "Apartado",
  PAYMENT_PENDING: "Pago pendiente",
  DEPOSIT_PAID: "Anticipo recibido",
  PAID: "Pagado",
  CONFIRMED: "Confirmado",
  PREPARATION: "Preparación",
  IN_SERVICE: "En servicio",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
  REFUNDED: "Reembolsado",
};

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function time(value) {
  return value ? String(value).slice(0, 5) : "—";
}

function stateClass(status) {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return styles.good;
  if (["HOLD", "PAYMENT_PENDING", "DEPOSIT_PAID", "PREPARATION"].includes(status)) {
    return styles.warn;
  }
  if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(status)) return styles.bad;
  if (["PAID", "IN_SERVICE"].includes(status)) return styles.live;
  return styles.neutral;
}

export default function AdminEventDetailPage() {
  const params = useParams();
  const bookingId = params?.bookingId;

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDetail() {
    if (!bookingId) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/admin/events?view=detail&bookingId=${encodeURIComponent(bookingId)}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible cargar el evento.");
      }

      setDetail(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function action(name, payload) {
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, payload }),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.error || "No se pudo guardar el cambio.");
    }

    setMessage("Cambio guardado.");
    await loadDetail();
  }

  useEffect(() => {
    loadDetail();
  }, [bookingId]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>JAVA TIMES CAFFÉ · EVENT DETAIL</div>
            <h1>{detail?.booking?.event_order_number || "Evento"}</h1>
            <p>
              Esta es la ficha operativa completa. Todos los cambios se guardan
              directamente en Java Events.
            </p>
          </div>

          <div className={styles.actions}>
            <Link href="/admin/events" className={styles.secondary}>
              ← Volver al calendario
            </Link>
            {bookingId && (
              <Link
                href={`/confirmation/${bookingId}`}
                target="_blank"
                className={styles.secondary}
              >
                Comprobante cliente
              </Link>
            )}
            <Link
              href={`/admin/payments?bookingId=${bookingId || ""}`}
              className={styles.secondary}
            >
              Ver pagos
            </Link>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        {loading && !detail ? (
          <div className={styles.empty}>Cargando evento...</div>
        ) : detail ? (
          <EventDetail detail={detail} action={action} />
        ) : (
          <div className={styles.empty}>No encontramos este evento.</div>
        )}
      </div>
    </main>
  );
}

function EventDetail({ detail, action }) {
  const booking = detail.booking;
  const [status, setStatus] = useState(booking.status);
  const [notes, setNotes] = useState(booking.operations_notes || "");
  const [cartId, setCartId] = useState(booking.coffee_cart_id || "");
  const [staff, setStaff] = useState({
    name: "",
    role: "Barista",
    notes: "",
  });

  useEffect(() => {
    setStatus(booking.status);
    setNotes(booking.operations_notes || "");
    setCartId(booking.coffee_cart_id || "");
  }, [booking.id, booking.status, booking.operations_notes, booking.coffee_cart_id]);

  async function run(name, payload) {
    try {
      await action(name, payload);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailHead}>
        <div>
          <div className={styles.eyebrow}>RESUMEN DEL EVENTO</div>
          <h2>{booking.event_order_number}</h2>
          <p>
            {booking.event_type || "Evento"} · {booking.event_date} ·{" "}
            {time(booking.start_time)}
          </p>
        </div>

        <div className={`${styles.badge} ${stateClass(booking.status)}`}>
          {LABEL[booking.status] || booking.status}
        </div>
      </div>

      <div className={styles.two}>
        <Section title="Cliente y evento">
          <Info label="Cliente" value={booking.customer_name} />
          <Info label="Email" value={booking.email} />
          <Info label="Teléfono" value={booking.phone} />
          <Info label="Tipo" value={booking.event_type} />
          <Info label="Fecha" value={booking.event_date} />
          <Info label="Hora" value={time(booking.start_time)} />
          <Info label="Duración" value={`${booking.duration_hours} h`} />
          <Info label="Invitados" value={String(booking.guests)} />
        </Section>

        <Section title="Lugar y accesos">
          <Info label="Lugar" value={booking.venue_name} />
          <Info
            label="Dirección"
            value={[booking.event_address, booking.neighborhood, booking.postal_code]
              .filter(Boolean)
              .join(", ")}
          />
          <Info label="Ciudad" value={`${booking.city}, ${booking.state}`} />
          <Info label="Interior / exterior" value={booking.indoor_outdoor} />
          <Info label="Nivel / piso" value={booking.floor} />
          <Info label="Elevador" value={booking.elevator ? "Sí" : "No"} />
          <Info label="Descarga" value={booking.unloading_access} />
          <Info label="Electricidad" value={booking.electricity_details} />
          <Info label="Agua potable" value={booking.potable_water ? "Sí" : "No"} />
          <Info
            label="Acceso montaje"
            value={
              booking.setup_access_time
                ? new Date(booking.setup_access_time).toLocaleString("es-MX")
                : "—"
            }
          />
        </Section>
      </div>

      <Section title="Servicios contratados">
        {(detail.items || []).map((item) => (
          <div key={item.id} className={styles.line}>
            <div>
              <strong>{item.item_name}</strong>
              <small>
                {item.quantity} × {money(item.unitPrice)}
              </small>
            </div>
            <strong>{money(item.lineTotal)}</strong>
          </div>
        ))}
      </Section>

      <Section title="Finanzas">
        <div className={styles.finance}>
          <Finance label="Subtotal" value={booking.subtotal} />
          <Finance
            label={`IVA ${booking.vatPercent ?? ""}%`}
            value={booking.vat}
          />
          <Finance label="Total" value={booking.total} />
          <Finance label="Anticipo" value={booking.deposit} />
          <Finance label="Saldo" value={booking.balance} />
        </div>
      </Section>

      <div className={styles.two}>
        <Section title="Estado operativo">
          <select
            className={styles.input}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["CONFIRMED", "PREPARATION", "IN_SERVICE", "COMPLETED", "CANCELLED"].map(
              (value) => (
                <option key={value} value={value}>
                  {LABEL[value]}
                </option>
              )
            )}
          </select>

          <button
            className={styles.primary}
            onClick={() => run("UPDATE_STATUS", { bookingId: booking.id, status })}
          >
            Guardar estado
          </button>
        </Section>

        <Section title="Coffee Cart">
          <select
            className={styles.input}
            value={cartId}
            onChange={(e) => setCartId(e.target.value)}
          >
            <option value="">Selecciona Coffee Cart</option>
            {(detail.availableCarts || []).map((cart) => (
              <option key={cart.id} value={cart.id}>
                {cart.code} · {cart.name}
              </option>
            ))}
          </select>

          <button
            className={styles.primary}
            onClick={() =>
              run("ASSIGN_CART", {
                bookingId: booking.id,
                coffeeCartId: cartId,
              })
            }
          >
            Asignar Coffee Cart
          </button>
        </Section>
      </div>

      <div className={styles.two}>
        <Section title="Personal asignado">
          {(detail.staff || []).length === 0 && (
            <p className={styles.muted}>Aún no hay personal asignado.</p>
          )}

          {(detail.staff || []).map((person) => (
            <div key={person.id} className={styles.line}>
              <div>
                <strong>{person.staff_name}</strong>
                <small>{person.role}</small>
              </div>
              <button
                className={styles.danger}
                onClick={() => run("REMOVE_STAFF", { staffId: person.id })}
              >
                Quitar
              </button>
            </div>
          ))}

          <form
            className={styles.staffForm}
            onSubmit={async (event) => {
              event.preventDefault();
              await run("ADD_STAFF", { bookingId: booking.id, ...staff });
              setStaff({ name: "", role: "Barista", notes: "" });
            }}
          >
            <input
              className={styles.input}
              placeholder="Nombre"
              value={staff.name}
              onChange={(e) => setStaff({ ...staff, name: e.target.value })}
              required
            />
            <select
              className={styles.input}
              value={staff.role}
              onChange={(e) => setStaff({ ...staff, role: e.target.value })}
            >
              <option>Barista</option>
              <option>Lead Barista</option>
              <option>Supervisor</option>
              <option>Chofer / Logística</option>
              <option>Responsable de evento</option>
            </select>
            <input
              className={styles.input}
              placeholder="Nota"
              value={staff.notes}
              onChange={(e) => setStaff({ ...staff, notes: e.target.value })}
            />
            <button className={styles.primary}>Agregar</button>
          </form>
        </Section>

        <Section title="Archivos">
          {(detail.uploads || []).length === 0 ? (
            <p className={styles.muted}>No hay archivos.</p>
          ) : (
            detail.uploads.map((file) => (
              <a
                key={file.id}
                className={styles.file}
                href={file.signedUrl || "#"}
                target="_blank"
                rel="noreferrer"
              >
                <strong>{file.upload_type}</strong>
                <span>{file.original_name || "Abrir archivo"}</span>
              </a>
            ))
          )}
        </Section>
      </div>

      <Section title="Notas internas de operación">
        <textarea
          className={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Montaje, accesos, pendientes, contacto con venue..."
        />
        <button
          className={styles.primary}
          onClick={() =>
            run("UPDATE_NOTES", {
              bookingId: booking.id,
              notes,
            })
          }
        >
          Guardar notas
        </button>
      </Section>

      <Section title="Timeline">
        {(detail.timeline || []).length === 0 && (
          <p className={styles.muted}>No hay movimientos registrados.</p>
        )}

        {(detail.timeline || []).map((entry) => (
          <div key={entry.id} className={styles.timeline}>
            <strong>{entry.title}</strong>
            {entry.description && <p>{entry.description}</p>}
            <small>
              {new Date(entry.created_at).toLocaleString("es-MX")} ·{" "}
              {entry.actor || "system"}
            </small>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className={styles.info}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function Finance({ label, value }) {
  return (
    <div className={styles.fin}>
      <span>{label}</span>
      <strong>{value === null || value === undefined ? "—" : money(value)}</strong>
    </div>
  );
}
