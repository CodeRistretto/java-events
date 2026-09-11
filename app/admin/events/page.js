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

const money = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v || 0));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const time = (v) => v ? String(v).slice(0,5) : "—";

function monthRange(base) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth()+1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay()+6)%7));
  const end = new Date(last);
  end.setDate(last.getDate() + (6-((last.getDay()+6)%7)));
  const days = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) days.push(new Date(d));
  return { days, from: iso(start), to: iso(end) };
}

function stateClass(status) {
  if (["CONFIRMED","COMPLETED"].includes(status)) return styles.good;
  if (["HOLD","PAYMENT_PENDING","DEPOSIT_PAID","PREPARATION"].includes(status)) return styles.warn;
  if (["CANCELLED","EXPIRED","REFUNDED"].includes(status)) return styles.bad;
  if (["PAID","IN_SERVICE"].includes(status)) return styles.live;
  return styles.neutral;
}

export default function AdminEventsPage() {
  const [month,setMonth] = useState(new Date());
  const [data,setData] = useState({bookings:[],blocks:[],carts:[]});
  const [detail,setDetail] = useState(null);
  const [cartFilter,setCartFilter] = useState("ALL");
  const [statusFilter,setStatusFilter] = useState("ALL");
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const range = useMemo(() => monthRange(month), [month]);

  async function loadCalendar() {
    setError("");
    const res = await fetch(`/api/admin/events?view=calendar&from=${range.from}&to=${range.to}`, {cache:"no-store"});
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "No fue posible cargar el calendario.");
    setData({bookings:json.bookings||[],blocks:json.blocks||[],carts:json.carts||[]});
  }

  async function openEvent(id) {
    setError("");
    const res = await fetch(`/api/admin/events?view=detail&bookingId=${encodeURIComponent(id)}`, {cache:"no-store"});
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "No fue posible cargar el evento.");
    setDetail(json);
  }

  async function action(name,payload) {
    setError(""); setMessage("");
    const res = await fetch("/api/admin/events", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:name,payload})});
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "No se pudo guardar.");
    setMessage("Cambio guardado.");
    await loadCalendar();
    if (detail?.booking?.id) await openEvent(detail.booking.id);
  }

  useEffect(() => { loadCalendar().catch(e=>setError(e.message)); }, [range.from,range.to]);

  const bookings = data.bookings.filter(b => (cartFilter==="ALL" || b.coffee_cart_id===cartFilter) && (statusFilter==="ALL" || b.status===statusFilter));
  const byDate = new Map();
  for (const b of bookings) { if (!byDate.has(b.event_date)) byDate.set(b.event_date,[]); byDate.get(b.event_date).push(b); }
  const blocksByDate = new Map();
  for (const b of data.blocks) { if (cartFilter!=="ALL" && b.coffee_cart_id!==cartFilter) continue; if (!blocksByDate.has(b.event_date)) blocksByDate.set(b.event_date,[]); blocksByDate.get(b.event_date).push(b); }

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.header}><div><div className={styles.eyebrow}>JAVA TIMES CAFFÉ · EVENTS ADMIN</div><h1>Calendar & Operations</h1><p>Reservas, Coffee Carts, personal y operación diaria.</p></div><div className={styles.actions}><Link href="/admin" className={styles.secondary}>Admin principal</Link><Link href="/" className={styles.secondary}>Cotizador</Link></div></header>

    {error && <div className={styles.error}>{error}</div>}{message && <div className={styles.success}>{message}</div>}

    <section className={styles.toolbar}><div className={styles.actions}><button className={styles.secondary} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>←</button><button className={styles.secondary} onClick={()=>setMonth(new Date())}>Hoy</button><button className={styles.secondary} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>→</button><h2>{new Intl.DateTimeFormat("es-MX",{month:"long",year:"numeric"}).format(month)}</h2></div><div className={styles.actions}><select className={styles.input} value={cartFilter} onChange={e=>setCartFilter(e.target.value)}><option value="ALL">Todos los Coffee Carts</option>{data.carts.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select><select className={styles.input} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Todos los estados</option>{Object.entries(LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div></section>

    <section className={styles.stats}><Stat label="Eventos" value={bookings.length}/><Stat label="Confirmados" value={bookings.filter(b=>b.status==="CONFIRMED").length}/><Stat label="Preparación" value={bookings.filter(b=>b.status==="PREPARATION").length}/><Stat label="Bloqueos" value={data.blocks.length}/></section>

    <section className={styles.calendar}><div className={styles.week}>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=><div key={d}>{d}</div>)}</div><div className={styles.grid}>{range.days.map(day=>{const date=iso(day);return <div key={date} className={`${styles.day} ${day.getMonth()!==month.getMonth()?styles.outside:""}`}><b>{day.getDate()}</b><div className={styles.dayItems}>{(blocksByDate.get(date)||[]).map(block=><div key={block.id} className={styles.block}>{block.state==="MAINTENANCE"?"Mantenimiento":"Bloqueado"}</div>)}{(byDate.get(date)||[]).map(b=><button key={b.id} className={`${styles.event} ${stateClass(b.status)}`} onClick={()=>openEvent(b.id).catch(e=>setError(e.message))}><small>{time(b.start_time)}</small><strong>{b.event_order_number}</strong><span>{b.event_type||"Evento"} · {b.guests}</span></button>)}</div></div>})}</div></section>

    <BlockPanel carts={data.carts} action={action}/>
    <section className={styles.detail}>{detail ? <EventDetail detail={detail} action={action}/> : <div className={styles.empty}><h2>Selecciona un evento</h2><p>Haz clic en un evento para abrir su ficha operativa.</p></div>}</section>
  </div></main>;
}

function Stat({label,value}) { return <div className={styles.stat}><span>{label}</span><strong>{value}</strong></div>; }

function BlockPanel({carts,action}) {
  const [f,setF] = useState({coffeeCartId:"",eventDate:"",state:"ADMIN_BLOCKED",reason:""});
  async function submit(e){e.preventDefault();try{await action("BLOCK_CART_DATE",f);setF({coffeeCartId:"",eventDate:"",state:"ADMIN_BLOCKED",reason:""});}catch(err){alert(err.message)}}
  return <section className={styles.card}><div className={styles.eyebrow}>DISPONIBILIDAD</div><h2>Bloquear Coffee Cart / fecha</h2><form className={styles.blockForm} onSubmit={submit}><select className={styles.input} value={f.coffeeCartId} onChange={e=>setF({...f,coffeeCartId:e.target.value})} required><option value="">Coffee Cart</option>{carts.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select><input className={styles.input} type="date" value={f.eventDate} onChange={e=>setF({...f,eventDate:e.target.value})} required/><select className={styles.input} value={f.state} onChange={e=>setF({...f,state:e.target.value})}><option value="ADMIN_BLOCKED">Bloqueado</option><option value="MAINTENANCE">Mantenimiento</option></select><input className={styles.input} placeholder="Razón" value={f.reason} onChange={e=>setF({...f,reason:e.target.value})}/><button className={styles.primary}>Bloquear</button></form></section>;
}

function EventDetail({detail,action}) {
  const b=detail.booking;
  const [status,setStatus]=useState(b.status);
  const [notes,setNotes]=useState(b.operations_notes||"");
  const [cartId,setCartId]=useState(b.coffee_cart_id||"");
  const [staff,setStaff]=useState({name:"",role:"Barista",notes:""});
  useEffect(()=>{setStatus(b.status);setNotes(b.operations_notes||"");setCartId(b.coffee_cart_id||"")},[b.id,b.status,b.operations_notes,b.coffee_cart_id]);
  const run=async(n,p)=>{try{await action(n,p)}catch(e){alert(e.message)}};
  return <div className={styles.detailCard}><div className={styles.detailHead}><div><div className={styles.eyebrow}>EVENT DETAIL</div><h2>{b.event_order_number}</h2><p>{b.event_type||"Evento"} · {b.event_date} · {time(b.start_time)}</p></div><div className={`${styles.badge} ${stateClass(b.status)}`}>{LABEL[b.status]||b.status}</div></div>
    <div className={styles.actions}><Link href={`/confirmation/${b.id}`} target="_blank" className={styles.secondary}>Comprobante cliente</Link></div>
    <div className={styles.two}><Section title="Cliente y evento"><Info l="Cliente" v={b.customer_name}/><Info l="Email" v={b.email}/><Info l="Teléfono" v={b.phone}/><Info l="Invitados" v={String(b.guests)}/><Info l="Duración" v={`${b.duration_hours} h`}/></Section><Section title="Lugar y accesos"><Info l="Lugar" v={b.venue_name}/><Info l="Dirección" v={[b.event_address,b.neighborhood,b.postal_code].filter(Boolean).join(", ")}/><Info l="Ciudad" v={`${b.city}, ${b.state}`}/><Info l="Interior / exterior" v={b.indoor_outdoor}/><Info l="Nivel / piso" v={b.floor}/><Info l="Elevador" v={b.elevator?"Sí":"No"}/><Info l="Descarga" v={b.unloading_access}/><Info l="Electricidad" v={b.electricity_details}/><Info l="Agua potable" v={b.potable_water?"Sí":"No"}/></Section></div>
    <Section title="Servicios contratados">{detail.items.map(i=><div key={i.id} className={styles.line}><div><strong>{i.item_name}</strong><small>{i.quantity} × {money(i.unitPrice)}</small></div><strong>{money(i.lineTotal)}</strong></div>)}</Section>
    <Section title="Finanzas"><div className={styles.finance}><Fin l="Subtotal" v={b.subtotal}/><Fin l={`IVA ${b.vatPercent??""}%`} v={b.vat}/><Fin l="Total" v={b.total}/><Fin l="Anticipo" v={b.deposit}/><Fin l="Saldo" v={b.balance}/></div></Section>
    <div className={styles.two}><Section title="Estado operativo"><select className={styles.input} value={status} onChange={e=>setStatus(e.target.value)}>{["CONFIRMED","PREPARATION","IN_SERVICE","COMPLETED","CANCELLED"].map(s=><option key={s} value={s}>{LABEL[s]}</option>)}</select><button className={styles.primary} onClick={()=>run("UPDATE_STATUS",{bookingId:b.id,status})}>Guardar estado</button></Section><Section title="Coffee Cart"><select className={styles.input} value={cartId} onChange={e=>setCartId(e.target.value)}><option value="">Selecciona Coffee Cart</option>{detail.availableCarts.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select><button className={styles.primary} onClick={()=>run("ASSIGN_CART",{bookingId:b.id,coffeeCartId:cartId})}>Asignar Coffee Cart</button></Section></div>
    <div className={styles.two}><Section title="Personal">{detail.staff.map(p=><div key={p.id} className={styles.line}><div><strong>{p.staff_name}</strong><small>{p.role}</small></div><button className={styles.danger} onClick={()=>run("REMOVE_STAFF",{staffId:p.id})}>Quitar</button></div>)}<form className={styles.staffForm} onSubmit={async e=>{e.preventDefault();await run("ADD_STAFF",{bookingId:b.id,...staff});setStaff({name:"",role:"Barista",notes:""})}}><input className={styles.input} placeholder="Nombre" value={staff.name} onChange={e=>setStaff({...staff,name:e.target.value})} required/><select className={styles.input} value={staff.role} onChange={e=>setStaff({...staff,role:e.target.value})}><option>Barista</option><option>Lead Barista</option><option>Supervisor</option><option>Chofer / Logística</option><option>Responsable de evento</option></select><input className={styles.input} placeholder="Nota" value={staff.notes} onChange={e=>setStaff({...staff,notes:e.target.value})}/><button className={styles.primary}>Agregar</button></form></Section><Section title="Archivos">{detail.uploads.length===0?<p className={styles.muted}>No hay archivos.</p>:detail.uploads.map(f=><a key={f.id} className={styles.file} href={f.signedUrl||"#"} target="_blank" rel="noreferrer"><strong>{f.upload_type}</strong><span>{f.original_name||"Abrir"}</span></a>)}</Section></div>
    <Section title="Notas internas"><textarea className={styles.textarea} value={notes} onChange={e=>setNotes(e.target.value)}/><button className={styles.primary} onClick={()=>run("UPDATE_NOTES",{bookingId:b.id,notes})}>Guardar notas</button></Section>
    <Section title="Timeline">{detail.timeline.map(t=><div key={t.id} className={styles.timeline}><strong>{t.title}</strong>{t.description&&<p>{t.description}</p>}<small>{new Date(t.created_at).toLocaleString("es-MX")} · {t.actor||"system"}</small></div>)}</Section>
  </div>;
}

function Section({title,children}) { return <section className={styles.section}><h3>{title}</h3>{children}</section>; }
function Info({l,v}) { return <div className={styles.info}><span>{l}</span><strong>{v||"—"}</strong></div>; }
function Fin({l,v}) { return <div className={styles.fin}><span>{l}</span><strong>{v===null||v===undefined?"—":money(v)}</strong></div>; }
