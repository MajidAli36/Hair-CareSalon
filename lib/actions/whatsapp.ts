"use server";

import { requireOrganization } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";

export type WhatsAppCustomer = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
};

export async function getWhatsAppCustomers(): Promise<WhatsAppCustomer[]> {
  const org = await requireOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .not("phone", "is", null)
    .order("first_name")
    .limit(500);

  if (error) throw new Error(error.message);
  return (data ?? []).filter(
    (customer): customer is WhatsAppCustomer =>
      typeof customer.phone === "string" && customer.phone.trim().length > 0
  );
}
