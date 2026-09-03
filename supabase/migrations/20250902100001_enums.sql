-- Role enum for organization members
create type public.member_role as enum (
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'RECEPTIONIST',
  'STAFF'
);
