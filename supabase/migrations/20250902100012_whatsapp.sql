-- WhatsApp message enums
create type public.whatsapp_direction as enum ('INBOUND', 'OUTBOUND');
create type public.whatsapp_status as enum ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- WhatsApp messages log
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  direction public.whatsapp_direction not null,
  status public.whatsapp_status not null default 'PENDING',
  phone text not null,
  body text not null,
  external_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index whatsapp_messages_org_idx on public.whatsapp_messages (organization_id);
create index whatsapp_messages_phone_idx on public.whatsapp_messages (organization_id, phone);
create index whatsapp_messages_created_idx on public.whatsapp_messages (organization_id, created_at desc);

alter table public.whatsapp_messages enable row level security;

-- Members can read messages in their org
create policy "members_select_whatsapp_messages"
  on public.whatsapp_messages for select to authenticated
  using (public.is_org_member(organization_id));

-- RECEPTIONIST+ can send (insert outbound)
create policy "staff_insert_whatsapp_outbound"
  on public.whatsapp_messages for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST')
    and direction = 'OUTBOUND'
  );

-- Service/webhook inserts inbound via service role (bypasses RLS)
