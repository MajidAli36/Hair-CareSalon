-- Soft-delete + actor tracking for core salon entities; enrich audit_logs.

-- ── Helper: add soft-delete / actor columns if missing ──────────────────────
create or replace function public._ensure_soft_delete_cols(p_table text, p_has_org boolean default true)
returns void
language plpgsql
as $$
begin
  execute format(
    'alter table public.%I add column if not exists deleted_at timestamptz',
    p_table
  );
  execute format(
    'alter table public.%I add column if not exists deleted_by uuid references auth.users (id) on delete set null',
    p_table
  );
  execute format(
    'alter table public.%I add column if not exists deleted_by_role public.member_role',
    p_table
  );
  execute format(
    'alter table public.%I add column if not exists created_by uuid references auth.users (id) on delete set null',
    p_table
  );
  execute format(
    'alter table public.%I add column if not exists updated_by uuid references auth.users (id) on delete set null',
    p_table
  );

  if p_has_org then
    execute format(
      'create index if not exists %I on public.%I (organization_id, deleted_at)',
      p_table || '_org_deleted_at_idx',
      p_table
    );
  else
    execute format(
      'create index if not exists %I on public.%I (deleted_at)',
      p_table || '_deleted_at_idx',
      p_table
    );
  end if;
end;
$$;

select public._ensure_soft_delete_cols('customers');
select public._ensure_soft_delete_cols('staff');
select public._ensure_soft_delete_cols('services');
select public._ensure_soft_delete_cols('service_categories');
select public._ensure_soft_delete_cols('products');
select public._ensure_soft_delete_cols('product_categories');
select public._ensure_soft_delete_cols('packages');
select public._ensure_soft_delete_cols('sales');
select public._ensure_soft_delete_cols('invoices');
select public._ensure_soft_delete_cols('appointments');
select public._ensure_soft_delete_cols('chairs');

-- chairs may lack updated_at
alter table public.chairs add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'chairs_set_updated_at'
  ) then
    create trigger chairs_set_updated_at
      before update on public.chairs
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- invoices may lack updated_at
alter table public.invoices add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'invoices_set_updated_at'
  ) then
    create trigger invoices_set_updated_at
      before update on public.invoices
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Enrich audit_logs
alter table public.audit_logs
  add column if not exists actor_role public.member_role;

alter table public.audit_logs
  add column if not exists actor_email text;

drop function if exists public._ensure_soft_delete_cols(text, boolean);
