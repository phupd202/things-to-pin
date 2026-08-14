-- Things to Pin — Supabase schema
-- Chạy file này trong Supabase Dashboard → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- Nhóm pin (collections): tài liệu, việc cần chú ý, link/slide...
create table if not exists public.collections (
  id text primary key default gen_random_uuid()::text,
  label text not null,
  bg text not null default '#EDE8D9',
  ink text not null default '#6E6650',
  created_at timestamptz not null default now()
);

-- Danh sách tổ / thành phần tham gia
create table if not exists public.teams (
  name text primary key,
  created_at timestamptz not null default now()
);

-- Thành viên: lưu khi vào web lần đầu để đối chiếu ai là ai
create table if not exists public.members (
  display_name text primary key,   -- ví dụ: AnNV
  full_name text not null,         -- ví dụ: Nguyễn Văn An
  team text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Pin: nội dung + link + deadline + thành phần tham gia + độ ưu tiên
create table if not exists public.pins (
  id text primary key default gen_random_uuid()::text,
  content text not null,
  url text,
  deadline date,
  people text[] not null default '{}',
  priority text not null default 'bt' check (priority in ('ttkhan','tkhan','khan','bt')),
  collection_id text references public.collections(id) on delete set null,
  starred boolean not null default false,
  done boolean not null default false,
  created_by text not null,
  created_by_team text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Ý tưởng / feedback: vote ▲▼, ý tưởng nhiều vote nhất được phát triển
create table if not exists public.ideas (
  id text primary key default gen_random_uuid()::text,
  content text not null,
  author text not null,
  up_voters text[] not null default '{}',
  down_voters text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Nâng cấp cho database đã tạo từ trước (chạy lại file này là đủ)
alter table public.pins add column if not exists done boolean not null default false;

create index if not exists pins_deadline_idx on public.pins (deadline);
create index if not exists pins_collection_idx on public.pins (collection_id);

-- Dữ liệu mặc định
insert into public.collections (id, label, bg, ink) values
  ('viec',  'Việc cần chú ý', '#FFDCC0', '#8A4A18'),
  ('taily', 'Tài liệu',       '#CFE6FF', '#1B4E82'),
  ('link',  'Link / Slide',   '#E5DEFF', '#4A3A8A')
on conflict (id) do nothing;

insert into public.teams (name) values
  ('Nhóm Điều hành và Quản lý vận hành'),
  ('Nhóm Quản lý mạng lõi'),
  ('Nhóm Quản lý hạ tầng CNTT'),
  ('Nhóm Quản lý CSHT và đầu tư'),
  ('Nhóm Quản lý chất lượng'),
  ('Nhóm Điều hành dịch vụ')
on conflict (name) do nothing;

-- RLS: Phase 1 chưa có login — mở cho anon (nội bộ phòng).
-- Phase 2 (login/LDAP/SSO) sẽ siết lại các policy này.
alter table public.pins enable row level security;
alter table public.collections enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;

drop policy if exists "anon full access pins" on public.pins;
create policy "anon full access pins" on public.pins
  for all using (true) with check (true);

drop policy if exists "anon full access collections" on public.collections;
create policy "anon full access collections" on public.collections
  for all using (true) with check (true);

drop policy if exists "anon full access teams" on public.teams;
create policy "anon full access teams" on public.teams
  for all using (true) with check (true);

drop policy if exists "anon full access members" on public.members;
create policy "anon full access members" on public.members
  for all using (true) with check (true);

alter table public.ideas enable row level security;
drop policy if exists "anon full access ideas" on public.ideas;
create policy "anon full access ideas" on public.ideas
  for all using (true) with check (true);

-- Bật realtime để mọi người thấy thay đổi ngay (bỏ qua nếu đã bật)
do $$ begin
  alter publication supabase_realtime add table public.pins;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.collections;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.ideas;
exception when duplicate_object then null; end $$;
