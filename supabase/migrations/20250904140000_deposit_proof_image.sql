-- Payment screenshot proof for JazzCash / EasyPaisa / bank advances

alter table public.appointment_deposits
  add column if not exists proof_path text;

comment on column public.appointment_deposits.proof_path is
  'Storage path in deposit-proofs bucket for payment screenshot';

-- Private bucket for payment screenshots
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deposit-proofs',
  'deposit-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role / admin uploads bypass RLS; allow authenticated staff to read own org proofs via signed URLs from server.
-- No public anon policies — uploads go through createOnlineBooking (service role).
