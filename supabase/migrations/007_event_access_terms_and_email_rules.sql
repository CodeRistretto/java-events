-- ============================================================
-- JAVA TIMES CAFFÉ - ACCESS, TERMS & CONFIGURABLE EMAIL RULES
-- Migration 007
-- ============================================================

alter table public.event_settings
  add column if not exists cart_operating_length_cm integer not null default 320,
  add column if not exists cart_operating_width_cm integer not null default 150,
  add column if not exists minimum_passage_width_cm integer not null default 100,
  add column if not exists reschedule_extra_hours integer not null default 2,
  add column if not exists service_terms_version text not null default '2026-09-11',
  add column if not exists lead_followup_months integer not null default 12,
  add column if not exists lead_followup_interval_days integer not null default 30;

alter table public.bookings
  add column if not exists minimum_passage_width_cm numeric,
  add column if not exists electricity_distance_m numeric,
  add column if not exists access_requirements_accepted_at timestamptz,
  add column if not exists service_terms_version text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists reservation_notice_sent_at timestamptz,
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid();

alter table public.event_leads
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists bookings_email_unsubscribe_token_idx
  on public.bookings(email_unsubscribe_token);

create unique index if not exists event_leads_email_unsubscribe_token_idx
  on public.event_leads(email_unsubscribe_token);

create table if not exists public.event_email_templates (
  code text primary key,
  name text not null,
  subject_template text not null,
  body_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_email_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  template_code text not null references public.event_email_templates(code) on update cascade,
  provider text not null default 'APP_EMAIL',
  trigger_type text not null,
  offset_days integer,
  interval_days integer,
  max_sends integer not null default 1,
  requires_deposit_paid boolean not null default false,
  requires_balance_pending boolean not null default false,
  requires_marketing_consent boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_lead_email_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.event_leads(id) on delete cascade,
  reminder_key text not null,
  email_type text not null default 'APP_EMAIL_REACTIVATION',
  recipient text,
  subject text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (lead_id, reminder_key)
);

alter table public.event_email_templates enable row level security;
alter table public.event_email_rules enable row level security;
alter table public.event_lead_email_log enable row level security;

insert into public.event_email_templates (code, name, subject_template, body_template, active)
values
(
  'BALANCE_REMINDER',
  'Recordatorio de saldo',
  'Tu evento Java se acerca · saldo pendiente {{remaining}}',
  'Hola {{customer_name}}. Tu evento Java Coffee Cart es el {{event_date}}. Tu saldo pendiente es {{remaining}} y debe quedar liquidado a más tardar el {{due_date}}. Usa el botón de pago de esta factura de Shopify para liquidar. Confirmación: {{confirmation_url}}',
  true
),
(
  'RESERVATION_UNPAID',
  'Solicitud recibida sin anticipo',
  'Recibimos tu solicitud de Java Coffee Cart · {{event_ref}}',
  'Hola {{customer_name}}. Recibimos los datos de tu evento Java Coffee Cart. Importante: la fecha todavía NO está confirmada; queda confirmada únicamente cuando se paga el anticipo. Evento: {{event_date}}. Cotización total: {{total}}. Anticipo requerido: {{deposit}}. Puedes continuar aquí: {{confirmation_url}}',
  true
),
(
  'MONTHLY_REACTIVATION',
  'Reactivación mensual de cotización',
  '¿Aún estás planeando tu evento con Java Coffee Cart?',
  'Hola {{customer_name}}. Hace un tiempo cotizaste Java Coffee Cart y no se confirmó el anticipo. Si tu evento sigue en pie, puedes volver a cotizar una fecha disponible aquí: {{quote_url}}. Si ya no deseas recibir estos recordatorios, puedes cancelar el seguimiento aquí: {{unsubscribe_url}}',
  true
)
on conflict (code) do nothing;

insert into public.event_email_rules (
  code, name, template_code, provider, trigger_type, offset_days,
  interval_days, max_sends, requires_deposit_paid,
  requires_balance_pending, requires_marketing_consent, active, sort_order
)
values
('BALANCE_D15','Saldo · 15 días antes','BALANCE_REMINDER','SHOPIFY_INVOICE','EVENT_DATE_OFFSET',15,null,1,true,true,false,true,10),
('BALANCE_D7','Saldo · 7 días antes','BALANCE_REMINDER','SHOPIFY_INVOICE','EVENT_DATE_OFFSET',7,null,1,true,true,false,true,20),
('BALANCE_D6','Saldo · 6 días antes','BALANCE_REMINDER','SHOPIFY_INVOICE','EVENT_DATE_OFFSET',6,null,1,true,true,false,true,30),
('BALANCE_D5','Saldo · 5 días antes','BALANCE_REMINDER','SHOPIFY_INVOICE','EVENT_DATE_OFFSET',5,null,1,true,true,false,true,40),
('BALANCE_D4','Saldo · 4 días antes','BALANCE_REMINDER','SHOPIFY_INVOICE','EVENT_DATE_OFFSET',4,null,1,true,true,false,true,50),
('BALANCE_D3','Saldo · 3 días antes','BALANCE_REMINDER','SHOPIFY_INVOICE','EVENT_DATE_OFFSET',3,null,1,true,true,false,true,60),
('UNPAID_MONTHLY','Seguimiento mensual sin anticipo','MONTHLY_REACTIVATION','APP_EMAIL','BOOKING_AGE_INTERVAL',null,30,12,false,false,true,true,100)
on conflict (code) do nothing;

create index if not exists event_email_rules_active_sort_idx
  on public.event_email_rules(active, sort_order);

create index if not exists event_lead_email_log_lead_sent_idx
  on public.event_lead_email_log(lead_id, sent_at desc);
