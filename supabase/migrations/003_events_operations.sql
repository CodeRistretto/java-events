-- JAVA TIMES CAFFÉ - EVENTS OPERATIONS
-- Admin Calendar + Event Detail foundation

alter table bookings
  add column if not exists operations_notes text,
  add column if not exists operations_updated_at timestamptz;

create table if not exists event_timeline (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table event_timeline enable row level security;

create index if not exists event_timeline_booking_idx
  on event_timeline(booking_id, created_at desc);

create index if not exists event_staff_assignments_booking_idx
  on event_staff_assignments(booking_id);

create index if not exists event_cart_assignments_booking_idx
  on event_cart_assignments(booking_id);

create index if not exists event_uploads_booking_idx
  on event_uploads(booking_id);

create index if not exists cart_availability_date_idx
  on cart_availability(event_date);

insert into event_timeline (
  booking_id,
  event_type,
  title,
  description,
  actor,
  metadata,
  created_at
)
select
  b.id,
  'BOOKING_CREATED',
  'Evento creado',
  'Registro inicial del evento en Java Events.',
  'system',
  jsonb_build_object('status', b.status, 'event_order_number', b.event_order_number),
  b.created_at
from bookings b
where b.event_order_number is not null
  and not exists (
    select 1
    from event_timeline t
    where t.booking_id = b.id
      and t.event_type = 'BOOKING_CREATED'
  );

insert into event_timeline (
  booking_id,
  event_type,
  title,
  description,
  actor,
  metadata,
  created_at
)
select
  b.id,
  'PAYMENT_CONFIRMED',
  'Anticipo confirmado',
  'Shopify registró el pago del anticipo.',
  'shopify',
  jsonb_build_object('shopify_order_id', b.shopify_order_id),
  coalesce(b.confirmed_at, b.created_at)
from bookings b
where b.shopify_order_id is not null
  and not exists (
    select 1
    from event_timeline t
    where t.booking_id = b.id
      and t.event_type = 'PAYMENT_CONFIRMED'
  );
