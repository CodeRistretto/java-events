-- JAVA EVENTS - BOOKING RULES, INCLUDED DRINKS & QUOTED LEADS

alter table public.event_settings
  add column if not exists cup_size_oz integer not null default 12,
  add column if not exists included_hot_drinks jsonb not null default '["Latte","Caramel Latte","Mocha Latte"]'::jsonb,
  add column if not exists included_cold_drinks jsonb not null default '["Latte en las rocas","Caramel Rocks Latte","Mocha Latte Rocks"]'::jsonb,
  add column if not exists minimum_lead_days integer not null default 7,
  add column if not exists balance_due_days_before integer not null default 3,
  add column if not exists cancellation_refund_bps integer not null default 5000;

update public.event_settings
set
  cup_size_oz = coalesce(cup_size_oz, 12),
  included_hot_drinks = coalesce(included_hot_drinks, '["Latte","Caramel Latte","Mocha Latte"]'::jsonb),
  included_cold_drinks = coalesce(included_cold_drinks, '["Latte en las rocas","Caramel Rocks Latte","Mocha Latte Rocks"]'::jsonb),
  minimum_lead_days = coalesce(minimum_lead_days, 7),
  balance_due_days_before = coalesce(balance_due_days_before, 3),
  cancellation_refund_bps = coalesce(cancellation_refund_bps, 5000)
where id = 1;

create table if not exists public.event_leads (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid references public.service_areas(id) on delete set null,
  customer_name text not null,
  email text not null,
  phone text not null,
  guest_count integer,
  start_time time,
  end_time time,
  duration_hours numeric,
  quote_total_cents integer,
  quote_deposit_cents integer,
  quote_balance_cents integer,
  status text not null default 'QUOTED',
  source text not null default 'JAVA_EVENTS_QUOTE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_leads_created_at_idx
  on public.event_leads(created_at desc);
create index if not exists event_leads_email_idx
  on public.event_leads(lower(email));
create index if not exists event_leads_phone_idx
  on public.event_leads(phone);

alter table public.event_leads enable row level security;
