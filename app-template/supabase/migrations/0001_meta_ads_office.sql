-- Run once in the new Supabase project's SQL editor. All tables are server-only.
create table if not exists public.meta_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_access_token text not null,
  expires_at timestamptz,
  connected_at timestamptz not null default now()
);

create table if not exists public.meta_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_code_verifier text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists meta_oauth_states_expires_at_idx on public.meta_oauth_states(expires_at);

create table if not exists public.meta_daily_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_account_id text not null,
  report_date date not null,
  amount_spent numeric(20,4) not null default 0 check (amount_spent >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  reach bigint check (reach is null or reach >= 0),
  landing_page_views bigint not null default 0 check (landing_page_views >= 0),
  purchases bigint not null default 0 check (purchases >= 0),
  leads bigint not null default 0 check (leads >= 0),
  generated_at timestamptz not null default now(),
  primary key (user_id, ad_account_id, report_date)
);
create index if not exists meta_daily_reports_account_date_idx on public.meta_daily_reports(user_id, ad_account_id, report_date desc);

create table if not exists public.karni_launches (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  brief jsonb not null,
  asset_path text,
  state text not null default 'uploading' check (state in ('uploading','ready','working','paused','publishing','submitted','attention')),
  step integer not null default 0,
  checkpoint jsonb not null default '{}'::jsonb,
  pending_operation text,
  error text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists karni_launches_owner_idx on public.karni_launches(user_id, created_at desc);

alter table public.meta_connections enable row level security;
alter table public.meta_oauth_states enable row level security;
alter table public.meta_daily_reports enable row level security;
alter table public.karni_launches enable row level security;
revoke all on public.meta_connections, public.meta_oauth_states, public.meta_daily_reports, public.karni_launches from anon, authenticated;
grant all on public.meta_connections, public.meta_oauth_states, public.meta_daily_reports, public.karni_launches to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('creative-assets','creative-assets',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
