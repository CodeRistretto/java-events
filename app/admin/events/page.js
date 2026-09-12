"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./events.module.css";

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

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const time = (value) => (value ? String(value).slice(0, 5) : "—");

function monthRange(base) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));

  const days = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  return { days, from: iso(start), to: iso(end) };
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

export default function AdminEventsPage() {
  const [month, setMonth] = useState(new Date());
  const [data, setData] = useState({ bookings: [], blocks: [], carts: [] });
  const [cartFilter, setCartFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => monthRange(month), [month]);

  async function loadCalendar() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/admin/events?view=calendar&from=${range.from}&to=${range.to}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "No fue posible cargar el calendario.");
      }

      setData({
        bookings: json.bookings || [],
        blocks: json.blocks || [],
        carts: json.carts || [],
      });
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
      throw new Error(json.error || "No se pudo guardar.");
    }

    setMessage("Cambio guardado.");
    await loadCalendar();
  }

  useEffect(() => {
    loadCalendar();
  }, [range.from, range.to]);

  const bookings = data.bookings.filter(
    (booking) =>
      (cartFilter === "ALL" || booking.coffee_cart_id === cartFilter) &&
      (statusFilter === "ALL" || booking.status === statusFilter)
  );

  const byDate = new Map();
  for (const booking of bookings) {
    if (!byDate.has(booking.event_date)) byDate.set(booking.event_date, []);
    byDate.get(booking.event_date).push(booking);
  }

  const blocksByDate = new Map();
  for (const block of data.blocks) {
    if (cartFilter !== "ALL" && block.coffee_cart_id !== cartFilter) continue;
    if (!blocksByDate.has(block.event_date)) blocksByDate.set(block.event_date, []);
    blocksByDate.get(block.event_date).push(block);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>JAVA TIMES CAFFÉ · EVENTS ADMIN</div>
            <h1>Calendar & Operations</h1>
            <p>
              Haz clic en cualquier evento para abrir su ficha completa en una
              página dedicada.
            </p>
          </div>

          <div className={styles.actions}>
            <Link href="/admin/payments" className={styles.secondary}>
              Payments
            </Link>
            <Link href="/admin" className={styles.secondary}>
              Admin principal
            </Link>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <section className={styles.toolbar}>
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ←
            </button>
            <button className={styles.secondary} onClick={() => setMonth(new Date())}>
              Hoy
            </button>
            <button
              className={styles.secondary}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              →
            </button>
            <h2>
              {new Intl.DateTimeFormat("es-MX", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </h2>
          </div>

          <div className={styles.actions}>
            <select
              className={styles.input}
              value={cartFilter}
              onChange={(e) => setCartFilter(e.target.value)}
            >
              <option value="ALL">Todos los Coffee Carts</option>
              {data.carts.map((cart) => (
                <option key={cart.id} value={cart.id}>
                  {cart.code} · {cart.name}
                </option>
              ))}
            </select>

            <select
              className={styles.input}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos los estados</option>
              {Object.entries(LABEL).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.stats}>
          <Stat label="Eventos" value={bookings.length} />
          <Stat
            label="Confirmados"
            value={bookings.filter((b) => b.status === "CONFIRMED").length}
          />
          <Stat
            label="Preparación"
            value={bookings.filter((b) => b.status === "PREPARATION").length}
          />
          <Stat label="Bloqueos" value={data.blocks.length} />
        </section>

        {loading ? (
          <div className={styles.empty}>Cargando calendario...</div>
        ) : (
          <section className={styles.calendar}>
            <div className={styles.week}>
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className={styles.grid}>
              {range.days.map((day) => {
                const date = iso(day);
                const dayBookings = byDate.get(date) || [];
                const dayBlocks = blocksByDate.get(date) || [];

                return (
                  <div
                    key={date}
                    className={`${styles.day} ${
                      day.getMonth() !== month.getMonth() ? styles.outside : ""
                    }`}
                  >
                    <b>{day.getDate()}</b>

                    <div className={styles.dayItems}>
                      {dayBlocks.map((block) => (
                        <div key={block.id} className={styles.block}>
                          {block.state === "MAINTENANCE" ? "Mantenimiento" : "Bloqueado"}
                        </div>
                      ))}

                      {dayBookings.map((booking) => (
                        <Link
                          key={booking.id}
                          href={`/admin/events/${booking.id}`}
                          className={`${styles.event} ${stateClass(booking.status)}`}
                          aria-label={`Abrir evento ${booking.event_order_number}`}
                        >
                          <small>{time(booking.start_time)}</small>
                          <strong>{booking.event_order_number}</strong>
                          <span>
                            {booking.event_type || "Evento"} · {booking.guests}
                          </span>
                          <span className={styles.openHint}>Abrir evento →</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <BlockPanel carts={data.carts} action={action} />
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BlockPanel({ carts, action }) {
  const [form, setForm] = useState({
    coffeeCartId: "",
    eventDate: "",
    state: "ADMIN_BLOCKED",
    reason: "",
  });

  async function submit(event) {
    event.preventDefault();

    try {
      await action("BLOCK_CART_DATE", form);
      setForm({
        coffeeCartId: "",
        eventDate: "",
        state: "ADMIN_BLOCKED",
        reason: "",
      });
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>DISPONIBILIDAD</div>
      <h2>Bloquear Coffee Cart / fecha</h2>
      <p className={styles.muted}>
        Usa este control únicamente para mantenimiento o fechas que no deben
        venderse.
      </p>

      <form className={styles.blockForm} onSubmit={submit}>
        <select
          className={styles.input}
          value={form.coffeeCartId}
          onChange={(e) => setForm({ ...form, coffeeCartId: e.target.value })}
          required
        >
          <option value="">Coffee Cart</option>
          {carts.map((cart) => (
            <option key={cart.id} value={cart.id}>
              {cart.code} · {cart.name}
            </option>
          ))}
        </select>

        <input
          className={styles.input}
          type="date"
          value={form.eventDate}
          onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
          required
        />

        <select
          className={styles.input}
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        >
          <option value="ADMIN_BLOCKED">Bloqueado</option>
          <option value="MAINTENANCE">Mantenimiento</option>
        </select>

        <input
          className={styles.input}
          placeholder="Razón"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />

        <button className={styles.primary}>Bloquear</button>
      </form>
    </section>
  );
}
