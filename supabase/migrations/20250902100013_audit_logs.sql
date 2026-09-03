-- Audit logs for sensitive actions
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

-- MANAGER+ can read audit logs
create policy "managers_select_audit_logs"
  on public.audit_logs for select to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- Authenticated users can insert audit logs for their org (app server actions)
create policy "members_insert_audit_logs"
  on public.audit_logs for insert to authenticated
  with check (public.is_org_member(organization_id));
