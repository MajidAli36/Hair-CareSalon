-- Per-role navigation permissions (JSON overrides on top of app defaults)
alter table public.organizations
  add column if not exists nav_permissions jsonb not null default '{}'::jsonb;
