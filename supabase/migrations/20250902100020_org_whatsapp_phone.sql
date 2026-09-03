-- Salon WhatsApp business number for customer QR / wa.me links
alter table public.organizations
  add column if not exists whatsapp_phone text;
