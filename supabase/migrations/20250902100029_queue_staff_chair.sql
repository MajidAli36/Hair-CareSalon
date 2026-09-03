-- Queue tokens: optional staff + chair assignment, explicit issue time
alter table public.queue_tokens
  add column if not exists staff_id uuid references public.staff (id) on delete set null,
  add column if not exists chair text,
  add column if not exists issued_at timestamptz not null default now();

-- Backfill issued_at from created_at for existing rows
update public.queue_tokens
set issued_at = created_at
where issued_at is distinct from created_at
  and created_at is not null;

create index if not exists queue_tokens_staff_idx
  on public.queue_tokens (organization_id, token_date, staff_id)
  where staff_id is not null;

create index if not exists queue_tokens_chair_idx
  on public.queue_tokens (organization_id, token_date, chair)
  where chair is not null;
