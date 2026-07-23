-- Rodar no SQL Editor do Supabase (projeto gobhrarraopgalhrrizm).

create table if not exists public.transactions (
  id                       uuid        primary key default gen_random_uuid(),
  identifier               text        not null unique,
  poseidon_transaction_id  text,
  amount                   numeric     not null,
  donor_name               text        not null,
  donor_email              text        not null,
  donor_phone              text,
  message                  text,
  is_anonymous             boolean     not null default false,
  status                   text        not null default 'PENDING',
  pix_code                 text,
  created_at               timestamptz not null default now(),
  paid_at                  timestamptz
);

create table if not exists public.mural_messages (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  amount     numeric     not null,
  message    text        not null,
  created_at timestamptz not null default now()
);

-- RLS ligada; sem policies. O backend usa service_role (BYPASSRLS).
alter table public.transactions   enable row level security;
alter table public.mural_messages enable row level security;
