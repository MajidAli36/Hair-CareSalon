-- Thumb impression (biometric) attendance support
alter type public.attendance_method add value if not exists 'BIOMETRIC';

alter table public.staff
  add column if not exists thumb_id text,
  add column if not exists thumb_enrolled_at timestamptz;

create unique index if not exists staff_org_thumb_id_idx
  on public.staff (organization_id, thumb_id)
  where thumb_id is not null;
