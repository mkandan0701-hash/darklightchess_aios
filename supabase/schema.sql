-- Darklight AIOS schema. Paste into Supabase → SQL Editor → Run. Safe to run again.
--
-- ids are text: rows imported from Airtable keep their `rec…` id (Payments and existing Razorpay
-- invoices refer to it); new rows get a uuid. A null branch means Unassigned (superadmin only).

create table if not exists public.students (
  id text primary key default gen_random_uuid()::text,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  age numeric,
  coach text,
  status text,
  payment_status text not null default 'pending',
  amount_due numeric not null default 0,
  classes_per_week numeric not null default 0,
  duration text not null default '',
  grade text not null default '',
  batch_timing text not null default '',
  paused_month text not null default '',
  online boolean not null default false,
  payment_link text,
  invoice_id text,
  created_at date,
  branch text check (branch <> '')
);

create table if not exists public.leads (
  id text primary key default gen_random_uuid()::text,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  source text not null default 'other',
  coach_assigned text,
  status text not null default 'new',
  notes text not null default '',
  demo_date date,
  demo_time text,
  meet_link text,
  online boolean not null default false,
  created_at date,
  created_time timestamptz not null default now(),
  branch text check (branch <> '')
);

-- No foreign key on student_id: some legacy rows point at nothing.
create table if not exists public.payments (
  id text primary key default gen_random_uuid()::text,
  student_id text not null default '',
  student_name text not null default '',
  amount numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'pending',
  due_date date,
  paid_date date,
  payment_id text,
  invoice_id text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  branch text check (branch <> '')
);

create table if not exists public.expenses (
  id text primary key default gen_random_uuid()::text,
  description text not null default '',
  amount numeric not null default 0,
  category text not null default 'Other',
  date date,
  branch text check (branch <> '')
);

create index if not exists students_branch on public.students (branch);
create index if not exists leads_branch on public.leads (branch);
create index if not exists payments_branch on public.payments (branch);
create index if not exists payments_student on public.payments (student_id);
create index if not exists payments_due on public.payments (due_date);
create index if not exists expenses_branch on public.expenses (branch);

-- Server only. RLS with no policies plus revoked grants: the publishable key can read nothing.
-- The app's secret key acts as service_role, which needs its grant stated explicitly.
alter table public.students enable row level security;
alter table public.leads enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
revoke all on public.students, public.leads, public.payments, public.expenses from anon, authenticated;
grant select, insert, update, delete
  on public.students, public.leads, public.payments, public.expenses to service_role;
