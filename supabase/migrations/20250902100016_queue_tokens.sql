-- Queue tokens (generated when customer arrives)
create type public.queue_token_status as enum ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED');

create table public.queue_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  token_number int not null,
  token_date date not null default current_date,
  customer_id uuid references public.customers (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  customer_name text not null,
  status public.queue_token_status not null default 'WAITING',
  device_id uuid,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, token_date, token_number)
);

create index queue_tokens_org_date_idx on public.queue_tokens (organization_id, token_date, status);

alter table public.queue_tokens enable row level security;

create policy "members_select_queue_tokens"
  on public.queue_tokens for select to authenticated
  using (public.is_org_member(organization_id));

create policy "staff_insert_queue_tokens"
  on public.queue_tokens for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  );

create policy "staff_update_queue_tokens"
  on public.queue_tokens for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  );

-- Next token number helper
create or replace function public.next_queue_token_number(org_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(token_number), 0) + 1
  from public.queue_tokens
  where organization_id = org_id
    and token_date = current_date;
$$;
