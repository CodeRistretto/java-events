-- ============================================================
-- JAVA TIMES CAFFÉ - EVENTS MODULE - FULL SCOPE FOUNDATION
-- Run this in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

alter table service_areas
  add column if not exists activation_at timestamptz,
  add column if not exists deactivation_at timestamptz,
  add column if not exists minimum_guests integer not null default 100,
  add column if not exists transport_fee_cents bigint not null default 0,
  add column if not exists center_lat double precision,
  add column if not exists center_lng double precision,
  add column if not exists radius_km numeric(10,2),
  add column if not exists notes text;

create table if not exists service_area_postal_codes (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references service_areas(id) on delete cascade,
  postal_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(service_area_id, postal_code)
);
alter table service_area_postal_codes enable row level security;

alter table coffee_carts
  add column if not exists status text not null default 'AVAILABLE',
  add column if not exists max_guests integer not null default 400,
  add column if not exists service_profile text not null default 'STANDARD',
  add column if not exists equipment jsonb not null default '{}'::jsonb,
  add column if not exists required_baristas integer not null default 2,
  add column if not exists setup_buffer_minutes integer not null default 90,
  add column if not exists travel_buffer_minutes integer not null default 60,
  add column if not exists notes text;

create table if not exists coffee_cart_service_areas (
  id uuid primary key default gen_random_uuid(),
  coffee_cart_id uuid not null references coffee_carts(id) on delete cascade,
  service_area_id uuid not null references service_areas(id) on delete cascade,
  active boolean not null default true,
  active_from timestamptz not null default now(),
  active_to timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique(coffee_cart_id, service_area_id)
);
alter table coffee_cart_service_areas enable row level security;

create table if not exists cart_availability (
  id uuid primary key default gen_random_uuid(),
  coffee_cart_id uuid not null references coffee_carts(id) on delete cascade,
  event_date date not null,
  state text not null check (state in ('ADMIN_BLOCKED','MAINTENANCE')),
  reason text,
  created_at timestamptz not null default now(),
  unique(coffee_cart_id, event_date)
);
alter table cart_availability enable row level security;

create table if not exists event_settings (
  id integer primary key default 1 check (id = 1),
  vat_bps integer not null default 1600,
  hold_minutes integer not null default 15,
  checkout_hold_minutes integer not null default 30,
  bank_transfer_hold_minutes integer not null default 120,
  minimum_guests integer not null default 100,
  maximum_guests integer not null default 400,
  guest_increment integer not null default 50,
  standard_duration_hours integer not null default 2,
  payment_mode text not null default 'DEPOSIT'
    check (payment_mode in ('DEPOSIT','FULL','CHOICE')),
  deposit_bps integer not null default 3000,
  loyalty_enabled boolean not null default false,
  required_upload_types jsonb not null default '[]'::jsonb,
  required_fields jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table event_settings enable row level security;
insert into event_settings (id) values (1) on conflict (id) do nothing;

create table if not exists event_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table event_products enable row level security;

insert into event_products (code, name, description)
values (
  'JAVA_COFFEE_CART',
  'Java Coffee Cart for Events',
  'Take the complete Java Times Caffé experience to your event. Select the number of guests, choose your beverages, customize the service and pay directly through the app.'
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

create table if not exists event_guest_tiers (
  id uuid primary key default gen_random_uuid(),
  guest_count integer not null,
  rate_per_guest_cents bigint not null check (rate_per_guest_cents >= 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now()
);
alter table event_guest_tiers enable row level security;

create unique index if not exists event_guest_tiers_active_guest_count
on event_guest_tiers(guest_count)
where active = true and effective_to is null;

insert into event_guest_tiers (guest_count, rate_per_guest_cents)
values
  (100,10500),(150,9900),(200,9500),(250,9500),
  (300,8900),(350,8900),(400,8900)
on conflict do nothing;

create table if not exists event_add_ons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  group_name text not null,
  name text not null,
  description text,
  pricing_type text not null
    check (pricing_type in ('PER_GUEST','PER_EVENT','PER_HOUR','PER_UNIT')),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  active boolean not null default false,
  display_order integer not null default 100,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table event_add_ons enable row level security;

insert into event_add_ons
(code,group_name,name,pricing_type,unit_price_cents,active,display_order)
values
('COLD_BEVERAGES','Beverages','Cold Beverage Service','PER_GUEST',2000,true,10),
('FRAPPES','Beverages','Frappés','PER_GUEST',0,false,20),
('MATCHA_CHAI','Beverages','Matcha and Chai','PER_GUEST',0,false,30),
('DECAF','Beverages','Decaf','PER_GUEST',0,false,40),
('PLANT_MILK','Beverages','Plant-based Milk','PER_GUEST',0,false,50),
('PASTRY','Food','Pastry','PER_GUEST',0,false,60),
('PREMIUM_PASTRY','Food','Premium Pastry','PER_GUEST',0,false,70),
('DESSERT_TABLE','Food','Dessert Table','PER_EVENT',0,false,80),
('BOTTLED_WATER','Food','Bottled Water','PER_UNIT',0,false,90),
('PERSONALIZED_CUPS','Customization','Personalized Cups','PER_GUEST',0,false,100),
('PERSONALIZED_MENU','Customization','Personalized Menu','PER_EVENT',0,false,110),
('SPECIAL_GLASSWARE','Customization','Special Glassware','PER_GUEST',0,false,120),
('ADDITIONAL_CART','Operations','Additional Cart','PER_EVENT',0,false,130),
('ADDITIONAL_BARISTA','Operations','Additional Barista','PER_EVENT',0,false,140),
('ADDITIONAL_HOUR','Operations','Additional Service Hour','PER_HOUR',150000,true,150),
('TRANSPORTATION','Operations','Transportation','PER_EVENT',0,false,160)
on conflict (code) do nothing;

alter table bookings
  add column if not exists event_order_number text,
  add column if not exists venue_name text,
  add column if not exists neighborhood text,
  add column if not exists postal_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists indoor_outdoor text,
  add column if not exists floor text,
  add column if not exists elevator boolean,
  add column if not exists unloading_access text,
  add column if not exists setup_access_time timestamptz,
  add column if not exists electricity_details text,
  add column if not exists potable_water boolean,
  add column if not exists water_distance_m integer,
  add column if not exists invoice_required boolean not null default false,
  add column if not exists tax_name text,
  add column if not exists tax_rfc text,
  add column if not exists tax_usage text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists selected_add_ons jsonb not null default '[]'::jsonb,
  add column if not exists pricing_snapshot jsonb,
  add column if not exists total_cents bigint,
  add column if not exists deposit_cents bigint,
  add column if not exists balance_cents bigint,
  add column if not exists payment_method text,
  add column if not exists payment_deadline_at timestamptz,
  add column if not exists confirmation_number text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz;

create table if not exists event_order_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  item_type text not null,
  item_code text not null,
  item_name text not null,
  pricing_type text,
  quantity numeric(12,2) not null default 1,
  unit_price_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table event_order_items enable row level security;

create table if not exists event_capacity_holds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  coffee_cart_id uuid not null references coffee_carts(id) on delete cascade,
  event_date date not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','CONVERTED','RELEASED')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(coffee_cart_id,event_date)
);
alter table event_capacity_holds enable row level security;

create table if not exists event_cart_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  coffee_cart_id uuid not null references coffee_carts(id),
  assignment_type text not null default 'PRIMARY',
  created_at timestamptz not null default now(),
  unique(booking_id,coffee_cart_id)
);
alter table event_cart_assignments enable row level security;

create table if not exists event_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  staff_name text not null,
  role text not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table event_staff_assignments enable row level security;

create table if not exists event_uploads (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  upload_type text not null,
  bucket text not null default 'event-uploads',
  storage_path text not null,
  original_name text,
  mime_type text,
  created_at timestamptz not null default now()
);
alter table event_uploads enable row level security;

insert into storage.buckets (id,name,public)
values ('event-uploads','event-uploads',false)
on conflict (id) do nothing;

create table if not exists event_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  payment_method text,
  amount_cents bigint not null,
  status text not null,
  raw_snapshot jsonb,
  created_at timestamptz not null default now()
);
alter table event_payments enable row level security;

create table if not exists unsupported_city_leads (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  email text,
  phone text,
  city text not null,
  state text,
  estimated_guests integer,
  event_type text,
  expected_date date,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now()
);
alter table unsupported_city_leads enable row level security;

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
alter table admin_audit_logs enable row level security;

insert into coffee_cart_service_areas (coffee_cart_id,service_area_id,active)
select c.id,s.id,true
from coffee_carts c
cross join service_areas s
where c.code='JCC-001'
and s.city in ('Torreón','Gómez Palacio','Lerdo')
on conflict (coffee_cart_id,service_area_id)
do update set active=true;

create index if not exists bookings_event_date_idx on bookings(event_date);
create index if not exists bookings_status_idx on bookings(status);
create index if not exists event_capacity_holds_event_date_idx on event_capacity_holds(event_date);
