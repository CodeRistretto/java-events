"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";

function money(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("pricing");
  const [auth, setAuth] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/admin/config", { cache: "no-store" });

    if (res.status === 401) {
      setData(null);
      return;
    }

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || "Error");
    }

    setData(json);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function login(e) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(auth),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      setError(json.error || "No fue posible iniciar sesión.");
      return;
    }

    await load();
  }

  async function save(action, payload) {
    setError("");
    setMessage("");

    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      setError(json.error || "No se pudo guardar.");
      return;
    }

    setMessage("Guardado.");
    await load();
  }

  if (!data) {
    return (
      <main className={styles.page}>
        <form className={styles.login} onSubmit={login}>
          <h1>Java Events Admin</h1>
          <p className={styles.muted}>
            Precios, add-ons, cobertura, carts y órdenes.
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.stack}>
            <input
              className={styles.input}
              placeholder="Usuario"
              value={auth.username}
              onChange={(e) =>
                setAuth({ ...auth, username: e.target.value })
              }
            />

            <input
              className={styles.input}
              type="password"
              placeholder="Contraseña"
              value={auth.password}
              onChange={(e) =>
                setAuth({ ...auth, password: e.target.value })
              }
            />

            <button className={styles.button}>Entrar</button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Java Events Admin</h1>
            <div className={styles.muted}>
              Controla precios y operación sin publicar una nueva app.
            </div>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <div className={styles.tabs}>
          {[
            ["pricing", "Pricing"],
            ["addons", "Add-ons"],
            ["areas", "Service Areas"],
            ["carts", "Coffee Cart Fleet"],
            ["orders", "Orders"],
            ["audit", "Audit"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`${styles.tab} ${tab === key ? styles.active : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pricing" && (
          <>
            <SettingsCard
              settings={data.settings}
              onSave={(payload) => save("UPDATE_SETTINGS", payload)}
            />

            <div className={styles.card}>
              <h2>Guest tiers</h2>

              {(data.guestTiers || []).map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  onSave={(payload) =>
                    save("UPDATE_GUEST_TIER", payload)
                  }
                />
              ))}
            </div>
          </>
        )}

        {tab === "addons" && (
          <div className={styles.card}>
            <h2>Beverages, Food, Customization & Operations</h2>

            {(data.addOns || []).map((addOn) => (
              <AddOnRow
                key={addOn.id}
                addOn={addOn}
                onSave={(payload) => save("UPSERT_ADD_ON", payload)}
              />
            ))}

            <NewAddOn onSave={(payload) => save("UPSERT_ADD_ON", payload)} />
          </div>
        )}

        {tab === "areas" && (
          <div className={styles.card}>
            <h2>Event Service Areas</h2>

            {(data.serviceAreas || []).map((area) => (
              <AreaRow
                key={area.id}
                area={area}
                onSave={(payload) =>
                  save("UPDATE_SERVICE_AREA", payload)
                }
              />
            ))}
          </div>
        )}

        {tab === "carts" && (
          <div className={styles.card}>
            <h2>Coffee Cart Fleet</h2>

            {(data.carts || []).map((cart) => (
              <CartRow
                key={cart.id}
                cart={cart}
                onSave={(payload) => save("UPDATE_CART", payload)}
              />
            ))}
          </div>
        )}

        {tab === "orders" && (
          <div className={`${styles.card} ${styles.tableWrap}`}>
            <h2>Event order queue</h2>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>City</th>
                  <th>Date</th>
                  <th>Guests</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {(data.orders || []).map((order) => (
                  <tr key={order.id}>
                    <td>
                      {order.event_order_number || order.id.slice(0, 8)}
                    </td>
                    <td>{order.customer_name}</td>
                    <td>{order.city}</td>
                    <td>{order.event_date}</td>
                    <td>{order.guests}</td>
                    <td>${Number(order.total || 0).toFixed(2)}</td>
                    <td>{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "audit" && (
          <div className={`${styles.card} ${styles.tableWrap}`}>
            <h2>Admin audit log</h2>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>

              <tbody>
                {(data.audit || []).map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>{item.admin_id}</td>
                    <td>{item.action}</td>
                    <td>{item.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function SettingsCard({ settings, onSave }) {
  const [form, setForm] = useState(settings);

  return (
    <div className={styles.card}>
      <h2>Global event settings</h2>

      <div className={styles.grid}>
        <Field
          label="VAT %"
          value={Number(form.vat_bps) / 100}
          onChange={(value) =>
            setForm({ ...form, vat_bps: Number(value) * 100 })
          }
        />

        <Field
          label="Hold minutes"
          value={form.hold_minutes}
          onChange={(value) => setForm({ ...form, hold_minutes: value })}
        />

        <Field
          label="Checkout hold"
          value={form.checkout_hold_minutes}
          onChange={(value) =>
            setForm({ ...form, checkout_hold_minutes: value })
          }
        />

        <Field
          label="Bank transfer hold"
          value={form.bank_transfer_hold_minutes}
          onChange={(value) =>
            setForm({ ...form, bank_transfer_hold_minutes: value })
          }
        />

        <Field
          label="Min guests"
          value={form.minimum_guests}
          onChange={(value) =>
            setForm({ ...form, minimum_guests: value })
          }
        />

        <Field
          label="Max guests"
          value={form.maximum_guests}
          onChange={(value) =>
            setForm({ ...form, maximum_guests: value })
          }
        />

        <Field
          label="Guest increment"
          value={form.guest_increment}
          onChange={(value) =>
            setForm({ ...form, guest_increment: value })
          }
        />

        <Field
          label="Deposit %"
          value={Number(form.deposit_bps) / 100}
          onChange={(value) =>
            setForm({ ...form, deposit_bps: Number(value) * 100 })
          }
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          className={styles.button}
          onClick={() => onSave(form)}
        >
          Save settings
        </button>
      </div>
    </div>
  );
}

function TierRow({ tier, onSave }) {
  const [price, setPrice] = useState(money(tier.rate_per_guest_cents));
  const [active, setActive] = useState(tier.active);

  return (
    <div className={styles.row}>
      <strong>{tier.guest_count} guests</strong>
      <span>Rate / guest</span>

      <input
        className={styles.input}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />

      <label>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />{" "}
        Active
      </label>

      <span>${price}</span>

      <button
        className={styles.button}
        onClick={() =>
          onSave({
            id: tier.id,
            ratePerGuest: price,
            active,
          })
        }
      >
        Save
      </button>
    </div>
  );
}

function AddOnRow({ addOn, onSave }) {
  const [form, setForm] = useState({
    id: addOn.id,
    code: addOn.code,
    groupName: addOn.group_name,
    name: addOn.name,
    description: addOn.description || "",
    pricingType: addOn.pricing_type,
    unitPrice: money(addOn.unit_price_cents),
    active: addOn.active,
    displayOrder: addOn.display_order,
  });

  return (
    <div className={styles.row}>
      <input
        className={styles.input}
        value={form.name}
        onChange={(e) =>
          setForm({ ...form, name: e.target.value })
        }
      />

      <select
        className={styles.select}
        value={form.groupName}
        onChange={(e) =>
          setForm({ ...form, groupName: e.target.value })
        }
      >
        {["Beverages", "Food", "Customization", "Operations"].map(
          (value) => (
            <option key={value}>{value}</option>
          )
        )}
      </select>

      <select
        className={styles.select}
        value={form.pricingType}
        onChange={(e) =>
          setForm({ ...form, pricingType: e.target.value })
        }
      >
        {["PER_GUEST", "PER_EVENT", "PER_HOUR", "PER_UNIT"].map(
          (value) => (
            <option key={value}>{value}</option>
          )
        )}
      </select>

      <input
        className={styles.input}
        value={form.unitPrice}
        onChange={(e) =>
          setForm({ ...form, unitPrice: e.target.value })
        }
      />

      <label>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) =>
            setForm({ ...form, active: e.target.checked })
          }
        />{" "}
        Active
      </label>

      <button
        className={styles.button}
        onClick={() => onSave(form)}
      >
        Save
      </button>
    </div>
  );
}

function NewAddOn({ onSave }) {
  const [form, setForm] = useState({
    code: "",
    groupName: "Beverages",
    name: "",
    description: "",
    pricingType: "PER_GUEST",
    unitPrice: "0",
    active: false,
    displayOrder: 100,
  });

  return (
    <div className={styles.card} style={{ marginTop: 18 }}>
      <h3>New add-on</h3>

      <div className={styles.grid}>
        <Field
          label="Code"
          value={form.code}
          onChange={(value) => setForm({ ...form, code: value })}
        />

        <Field
          label="Name"
          value={form.name}
          onChange={(value) => setForm({ ...form, name: value })}
        />

        <Field
          label="Price MXN"
          value={form.unitPrice}
          onChange={(value) =>
            setForm({ ...form, unitPrice: value })
          }
        />

        <select
          className={styles.select}
          value={form.pricingType}
          onChange={(e) =>
            setForm({ ...form, pricingType: e.target.value })
          }
        >
          {["PER_GUEST", "PER_EVENT", "PER_HOUR", "PER_UNIT"].map(
            (value) => (
              <option key={value}>{value}</option>
            )
          )}
        </select>
      </div>

      <button
        className={styles.button}
        style={{ marginTop: 12 }}
        onClick={() => onSave(form)}
      >
        Create
      </button>
    </div>
  );
}

function AreaRow({ area, onSave }) {
  const [form, setForm] = useState({
    id: area.id,
    active: area.active,
    minimumGuests: area.minimum_guests,
    transportFee: money(area.transport_fee_cents),
    centerLat: area.center_lat ?? "",
    centerLng: area.center_lng ?? "",
    radiusKm: area.radius_km ?? "",
    notes: area.notes || "",
    postalCodes: (area.postalCodes || []).join(", "),
  });

  return (
    <div className={styles.card}>
      <h3>
        {area.city}, {area.state}
      </h3>

      <div className={styles.grid}>
        <Field
          label="Transport fee MXN"
          value={form.transportFee}
          onChange={(value) =>
            setForm({ ...form, transportFee: value })
          }
        />

        <Field
          label="Minimum guests"
          value={form.minimumGuests}
          onChange={(value) =>
            setForm({ ...form, minimumGuests: value })
          }
        />

        <Field
          label="Radius km"
          value={form.radiusKm}
          onChange={(value) =>
            setForm({ ...form, radiusKm: value })
          }
        />

        <Field
          label="Postal codes comma-separated"
          value={form.postalCodes}
          onChange={(value) =>
            setForm({ ...form, postalCodes: value })
          }
        />
      </div>

      <label>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) =>
            setForm({ ...form, active: e.target.checked })
          }
        />{" "}
        Active
      </label>

      <div style={{ marginTop: 12 }}>
        <button
          className={styles.button}
          onClick={() => onSave(form)}
        >
          Save area
        </button>
      </div>
    </div>
  );
}

function CartRow({ cart, onSave }) {
  const [form, setForm] = useState({
    id: cart.id,
    active: cart.active,
    status: cart.status,
    maxGuests: cart.max_guests,
    requiredBaristas: cart.required_baristas,
    setupBufferMinutes: cart.setup_buffer_minutes,
    travelBufferMinutes: cart.travel_buffer_minutes,
    notes: cart.notes || "",
  });

  return (
    <div className={styles.card}>
      <h3>
        {cart.code} · {cart.name}
      </h3>

      <div className={styles.grid}>
        <select
          className={styles.select}
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value })
          }
        >
          {[
            "AVAILABLE",
            "RESERVED",
            "IN_SERVICE",
            "IN_TRANSIT",
            "MAINTENANCE",
            "INACTIVE",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <Field
          label="Max guests"
          value={form.maxGuests}
          onChange={(value) =>
            setForm({ ...form, maxGuests: value })
          }
        />

        <Field
          label="Required baristas"
          value={form.requiredBaristas}
          onChange={(value) =>
            setForm({ ...form, requiredBaristas: value })
          }
        />

        <Field
          label="Setup buffer minutes"
          value={form.setupBufferMinutes}
          onChange={(value) =>
            setForm({ ...form, setupBufferMinutes: value })
          }
        />
      </div>

      <label>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) =>
            setForm({ ...form, active: e.target.checked })
          }
        />{" "}
        Active
      </label>

      <div style={{ marginTop: 12 }}>
        <button
          className={styles.button}
          onClick={() => onSave(form)}
        >
          Save cart
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label>
      <div className={styles.muted} style={{ marginBottom: 5 }}>
        {label}
      </div>

      <input
        className={styles.input}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
