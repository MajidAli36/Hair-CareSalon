-- Salon chairs (manage how many stations/chairs you have)
create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index chairs_org_idx on public.chairs (organization_id, sort_order, name);

alter table public.chairs enable row level security;

create policy "members_select_chairs"
  on public.chairs for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_chairs"
  on public.chairs for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_chairs"
  on public.chairs for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_chairs"
  on public.chairs for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

-- Link queue tokens to a chair (name still stored for history)
alter table public.queue_tokens
  add column if not exists chair_id uuid references public.chairs (id) on delete set null;

create index if not exists queue_tokens_chair_id_idx
  on public.queue_tokens (organization_id, token_date, chair_id)
  where chair_id is not null;
