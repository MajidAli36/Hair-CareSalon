-- Staff conduct notes: warnings, complaints, praise, general notes

create type public.staff_note_type as enum (
  'WARNING',
  'COMPLAINT',
  'PRAISE',
  'NOTE'
);

create table if not exists public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  note_type public.staff_note_type not null,
  title text not null,
  details text,
  severity smallint not null default 1 check (severity between 1 and 3),
  occurred_on date not null default (timezone('Asia/Karachi', now()))::date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_notes_staff_date_idx
  on public.staff_notes (staff_id, occurred_on desc);

create index if not exists staff_notes_org_date_idx
  on public.staff_notes (organization_id, occurred_on desc);

alter table public.staff_notes enable row level security;

create policy "members_select_staff_notes"
  on public.staff_notes for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_staff_notes"
  on public.staff_notes for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_staff_notes"
  on public.staff_notes for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

comment on table public.staff_notes is
  'Warnings, complaints, praise, and notes for staff monthly performance review';
