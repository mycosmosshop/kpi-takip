-- ============================================================
-- KPI Takip Tablosu — Supabase kurulum SQL'i
-- Proje: ERP portal projesi (chchaielttnimuuezazb)
-- Çalıştırma: Supabase Dashboard > SQL Editor > New query > yapıştır > Run
-- (Tek seferlik; tekrar çalıştırmak güvenli — "already exists" hataları yok sayılabilir.)
-- ============================================================

-- 1) Tablolar -------------------------------------------------
create table if not exists public.kpi_data (
  location   text not null,
  year       int  not null,
  data       jsonb not null default '{}'::jsonb,   -- { yil, kpis: [...] }
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (location, year)
);

create table if not exists public.kpi_action_data (
  location     text not null,
  year         int  not null,
  items        jsonb not null default '[]'::jsonb,  -- ActionItem[]
  next_meeting text default '',
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid(),
  primary key (location, year)
);

create table if not exists public.kpi_meta (
  key        text primary key,                      -- ör. 'locations'
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- 2) RLS açık -------------------------------------------------
alter table public.kpi_data        enable row level security;
alter table public.kpi_action_data enable row level security;
alter table public.kpi_meta        enable row level security;

-- 3) Politikalar: giriş yapmış (onaylı) kullanıcılar oku + yaz
--    (ERP onayı zaten erp-guard ile uygulama açılışında kontrol edilir.)
drop policy if exists "kpi_data auth all"   on public.kpi_data;
drop policy if exists "kpi_action auth all" on public.kpi_action_data;
drop policy if exists "kpi_meta auth all"   on public.kpi_meta;

create policy "kpi_data auth all"   on public.kpi_data        for all to authenticated using (true) with check (true);
create policy "kpi_action auth all" on public.kpi_action_data for all to authenticated using (true) with check (true);
create policy "kpi_meta auth all"   on public.kpi_meta        for all to authenticated using (true) with check (true);

-- 4) Realtime (başka kullanıcıların değişikliği canlı yansısın)
alter publication supabase_realtime add table public.kpi_data;
alter publication supabase_realtime add table public.kpi_action_data;

-- ============================================================
-- Not: "Herkes okusun, onaylı yazsın" istenirse select politikasını
-- 'to anon, authenticated' yapıp insert/update/delete'i ayrı tanımlayın.
-- ============================================================
