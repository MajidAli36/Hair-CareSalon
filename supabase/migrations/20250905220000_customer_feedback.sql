-- Customer feedback ratings (0–10) for salon improvement tracking

create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  walk_in_name text,
  staff_id uuid references public.staff (id) on delete set null,
  rating_overall smallint not null check (rating_overall between 0 and 10),
  rating_behaviour smallint not null check (rating_behaviour between 0 and 10),
  rating_expertise smallint not null check (rating_expertise between 0 and 10),
  rating_service smallint not null check (rating_service between 0 and 10),
  rating_cleanliness smallint not null check (rating_cleanliness between 0 and 10),
  rating_value smallint not null check (rating_value between 0 and 10),
  rating_wait_time smallint not null check (rating_wait_time between 0 and 10),
  comment text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_feedback_identity_chk check (
    customer_id is not null or (walk_in_name is not null and length(trim(walk_in_name)) > 0)
  )
);

create index if not exists customer_feedback_org_created_idx
  on public.customer_feedback (organization_id, created_at desc);

create index if not exists customer_feedback_staff_idx
  on public.customer_feedback (organization_id, staff_id);

create index if not exists customer_feedback_customer_idx
  on public.customer_feedback (organization_id, customer_id);

alter table public.customer_feedback enable row level security;

create policy "members_select_customer_feedback"
  on public.customer_feedback for select to authenticated
  using (public.is_org_member(organization_id));

create policy "staff_insert_customer_feedback"
  on public.customer_feedback for insert to authenticated
  with check (
    public.user_org_role(organization_id) in (
      'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST'
    )
  );

create policy "managers_delete_customer_feedback"
  on public.customer_feedback for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

comment on table public.customer_feedback is
  'Post-visit customer ratings (0–10) for staff, service quality, and improvement dashboard';
