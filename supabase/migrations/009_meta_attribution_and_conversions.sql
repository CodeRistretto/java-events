-- ============================================================
-- JAVA EVENTS - CAMPAIGN ATTRIBUTION + META CAPI DELIVERY LOG
-- Migration 009
-- ============================================================

alter table bookings
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists fbclid text,
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists gclid text,
  add column if not exists gbraid text,
  add column if not exists wbraid text,
  add column if not exists ttclid text,
  add column if not exists landing_page text,
  add column if not exists referrer text,
  add column if not exists client_session_id text,
  add column if not exists client_ip_address text,
  add column if not exists client_user_agent text,
  add column if not exists meta_test_event_code text,
  add column if not exists attribution_captured_at timestamptz;

create index if not exists bookings_client_session_id_idx
  on bookings(client_session_id)
  where client_session_id is not null;

create index if not exists bookings_utm_campaign_idx
  on bookings(utm_campaign)
  where utm_campaign is not null;

create table if not exists event_conversion_deliveries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  payment_id uuid references event_payments(id) on delete set null,
  provider text not null default 'META',
  event_name text not null,
  event_id text not null unique,
  status text not null default 'PENDING'
    check (status in ('PENDING','SENT','FAILED','SKIPPED')),
  attempts integer not null default 0,
  last_error text,
  request_snapshot jsonb not null default '{}'::jsonb,
  response_snapshot jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table event_conversion_deliveries enable row level security;

create index if not exists event_conversion_deliveries_booking_idx
  on event_conversion_deliveries(booking_id, created_at desc);

create index if not exists event_conversion_deliveries_retry_idx
  on event_conversion_deliveries(status, updated_at)
  where status in ('PENDING','FAILED');
