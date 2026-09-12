-- ============================================================
-- JAVA TIMES CAFFÉ - SITE IMAGES + EMAIL AUTOMATION
-- Migration 006
-- ============================================================

alter table public.event_settings
  add column if not exists hero_image_url text,
  add column if not exists service_image_url text,
  add column if not exists favicon_url text;

create table if not exists public.event_email_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reminder_key text not null,
  email_type text not null default 'SHOPIFY_BALANCE_INVOICE',
  recipient text,
  subject text,
  shopify_draft_order_id text,
  invoice_url text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (booking_id, reminder_key)
);

create index if not exists event_email_log_booking_sent_idx
  on public.event_email_log(booking_id, sent_at desc);

create index if not exists event_email_log_reminder_key_idx
  on public.event_email_log(reminder_key);

alter table public.event_email_log enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-site-assets',
  'event-site-assets',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
