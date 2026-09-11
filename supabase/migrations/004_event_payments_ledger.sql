-- ============================================================
-- JAVA TIMES CAFFÉ - EVENTS PAYMENTS LEDGER
-- Migration 004: deposits, balance payments and manual payments
-- ============================================================

alter table bookings
  add column if not exists shopify_balance_draft_order_id text,
  add column if not exists shopify_balance_order_id text;

alter table event_payments
  add column if not exists payment_type text not null default 'OTHER',
  add column if not exists reference text,
  add column if not exists notes text,
  add column if not exists recorded_by text,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text;

create index if not exists event_payments_booking_created_idx
  on event_payments(booking_id, created_at desc);

create index if not exists event_payments_booking_status_idx
  on event_payments(booking_id, status);

create unique index if not exists event_payments_provider_payment_unique
  on event_payments(provider, provider_payment_id)
  where provider_payment_id is not null;

insert into event_payments (
  booking_id,
  provider,
  provider_payment_id,
  payment_method,
  amount_cents,
  status,
  payment_type,
  reference,
  recorded_by,
  paid_at,
  raw_snapshot
)
select
  b.id,
  'SHOPIFY',
  b.shopify_order_id,
  'SHOPIFY',
  coalesce(b.deposit_cents, round(coalesce(b.deposit, 0) * 100)::bigint),
  'PAID',
  'DEPOSIT',
  b.event_order_number,
  'migration',
  coalesce(b.confirmed_at, b.created_at),
  jsonb_build_object(
    'source', 'migration_004',
    'shopify_order_id', b.shopify_order_id
  )
from bookings b
where b.shopify_order_id is not null
  and coalesce(b.deposit_cents, round(coalesce(b.deposit, 0) * 100)::bigint) > 0
  and not exists (
    select 1
    from event_payments p
    where p.booking_id = b.id
      and p.provider = 'SHOPIFY'
      and p.provider_payment_id = b.shopify_order_id
  );
