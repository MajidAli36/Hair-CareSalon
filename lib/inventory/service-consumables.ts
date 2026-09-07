import { createClient } from "@/lib/supabase/server";

export type CartLikeLine = {
  itemType: string;
  itemId: string;
  quantity: number;
};

export type ConsumableNeed = {
  productId: string;
  quantity: number;
  unitCost: number;
  productName: string;
};

/**
 * Resolve salon stock needed for SERVICE / PACKAGE cart lines from service recipes.
 * Retail PRODUCT lines are ignored here (handled separately).
 */
export async function resolveServiceConsumableNeeds(
  organizationId: string,
  lines: CartLikeLine[]
): Promise<{ needs: ConsumableNeed[]; error?: string }> {
  const serviceQty = new Map<string, number>();

  const serviceLines = lines.filter((l) => l.itemType === "SERVICE");
  for (const line of serviceLines) {
    const q = Math.max(0, Math.floor(Number(line.quantity) || 0));
    if (q <= 0) continue;
    serviceQty.set(line.itemId, (serviceQty.get(line.itemId) ?? 0) + q);
  }

  const packageLines = lines.filter((l) => l.itemType === "PACKAGE");
  if (packageLines.length) {
    const supabase = await createClient();
    const packageIds = [...new Set(packageLines.map((l) => l.itemId))];
    const { data: pkgItems, error } = await supabase
      .from("package_items")
      .select("package_id, service_id, quantity")
      .eq("organization_id", organizationId)
      .in("package_id", packageIds);
    if (error) return { needs: [], error: error.message };

    const pkgQtySold = new Map<string, number>();
    for (const line of packageLines) {
      const q = Math.max(0, Math.floor(Number(line.quantity) || 0));
      if (q <= 0) continue;
      pkgQtySold.set(line.itemId, (pkgQtySold.get(line.itemId) ?? 0) + q);
    }

    for (const row of pkgItems ?? []) {
      const sold = pkgQtySold.get(row.package_id) ?? 0;
      if (sold <= 0) continue;
      const perPkg = Math.max(0, Math.floor(Number(row.quantity) || 0));
      if (perPkg <= 0) continue;
      const add = sold * perPkg;
      serviceQty.set(row.service_id, (serviceQty.get(row.service_id) ?? 0) + add);
    }
  }

  if (serviceQty.size === 0) return { needs: [] };

  const supabase = await createClient();
  const serviceIds = [...serviceQty.keys()];
  const { data: recipes, error: recipeErr } = await supabase
    .from("service_consumables")
    .select("service_id, product_id, quantity")
    .eq("organization_id", organizationId)
    .in("service_id", serviceIds);
  if (recipeErr) return { needs: [], error: recipeErr.message };
  if (!recipes?.length) return { needs: [] };

  const productTotals = new Map<string, number>();
  for (const row of recipes) {
    const svcTimes = serviceQty.get(row.service_id) ?? 0;
    if (svcTimes <= 0) continue;
    const per = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (per <= 0) continue;
    const add = svcTimes * per;
    productTotals.set(row.product_id, (productTotals.get(row.product_id) ?? 0) + add);
  }

  if (productTotals.size === 0) return { needs: [] };

  const productIds = [...productTotals.keys()];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, stock_quantity, cost_price")
    .eq("organization_id", organizationId)
    .in("id", productIds);
  if (prodErr) return { needs: [], error: prodErr.message };

  const productMap = new Map(
    (products ?? []).map((p) => [
      p.id,
      {
        name: p.name,
        stock: Number(p.stock_quantity) || 0,
        cost: Number(p.cost_price) || 0,
      },
    ])
  );

  const needs: ConsumableNeed[] = [];
  for (const [productId, quantity] of productTotals) {
    const p = productMap.get(productId);
    if (!p) {
      return {
        needs: [],
        error: "A salon product linked to a service was not found (inactive or deleted).",
      };
    }
    needs.push({
      productId,
      quantity,
      unitCost: p.cost,
      productName: p.name,
    });
  }
  return { needs };
}

export function mergeStockNeeds(
  retail: Map<string, number>,
  consumables: ConsumableNeed[]
): Map<string, number> {
  const merged = new Map(retail);
  for (const c of consumables) {
    merged.set(c.productId, (merged.get(c.productId) ?? 0) + c.quantity);
  }
  return merged;
}

export async function assertStockAvailable(
  organizationId: string,
  needed: Map<string, number>
): Promise<{ error?: string; costById: Map<string, number>; nameById: Map<string, string> }> {
  const costById = new Map<string, number>();
  const nameById = new Map<string, string>();
  if (needed.size === 0) return { costById, nameById };

  const supabase = await createClient();
  const ids = [...needed.keys()];
  const { data: rows, error } = await supabase
    .from("products")
    .select("id, name, stock_quantity, cost_price")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (error) return { error: error.message, costById, nameById };

  const map = new Map(
    (rows ?? []).map((p) => [
      p.id,
      {
        name: p.name,
        stock: Number(p.stock_quantity) || 0,
        cost: Number(p.cost_price) || 0,
      },
    ])
  );

  for (const [productId, qty] of needed) {
    const row = map.get(productId);
    if (!row) return { error: "A product required for stock was not found", costById, nameById };
    costById.set(productId, row.cost);
    nameById.set(productId, row.name);
    if (qty > row.stock) {
      return {
        error: `Insufficient stock for ${row.name} (have ${row.stock}, need ${qty})`,
        costById,
        nameById,
      };
    }
  }
  return { costById, nameById };
}

/** Persist snapshot + create inventory OUT rows for service consumables. */
export async function applySaleConsumableUsages(options: {
  organizationId: string;
  saleId: string;
  needs: ConsumableNeed[];
  userId: string | null;
  referenceType?: string;
}): Promise<{ error?: string }> {
  const { organizationId, saleId, needs, userId } = options;
  const referenceType = options.referenceType ?? "service_consumable";
  if (!needs.length) return {};

  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("sale_consumable_usages")
    .delete()
    .eq("sale_id", saleId)
    .eq("organization_id", organizationId);
  if (delErr) return { error: delErr.message };

  const { error: insErr } = await supabase.from("sale_consumable_usages").insert(
    needs.map((n) => ({
      organization_id: organizationId,
      sale_id: saleId,
      product_id: n.productId,
      quantity: n.quantity,
      unit_cost: n.unitCost,
    }))
  );
  if (insErr) return { error: insErr.message };

  for (const n of needs) {
    const { error: invErr } = await supabase.from("inventory_transactions").insert({
      organization_id: organizationId,
      product_id: n.productId,
      type: "OUT",
      quantity: n.quantity,
      reference_type: referenceType,
      reference_id: saleId,
      notes: `Salon use — ${n.productName}`,
      created_by: userId,
    });
    if (invErr) return { error: `Salon stock out failed for ${n.productName}: ${invErr.message}` };
  }
  return {};
}

/** Restore stock from sale snapshot (void / admin delete / full refund). */
export async function reverseSaleConsumableUsages(options: {
  organizationId: string;
  saleId: string;
  userId: string | null;
  referenceType: string;
}): Promise<{ error?: string }> {
  const { organizationId, saleId, userId, referenceType } = options;
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("sale_consumable_usages")
    .select("product_id, quantity")
    .eq("sale_id", saleId)
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };
  if (!rows?.length) return {};

  for (const row of rows) {
    const qty = Math.floor(Number(row.quantity) || 0);
    if (qty <= 0) continue;
    const { error: invErr } = await supabase.from("inventory_transactions").insert({
      organization_id: organizationId,
      product_id: row.product_id,
      type: "IN",
      quantity: qty,
      reference_type: referenceType,
      reference_id: saleId,
      notes: "Salon use restored",
      created_by: userId,
    });
    if (invErr) return { error: `Salon stock restore failed: ${invErr.message}` };
  }
  return {};
}

/** Replace consumable usage on amend: restore old snapshot, apply new needs. */
export async function replaceSaleConsumableUsages(options: {
  organizationId: string;
  saleId: string;
  newNeeds: ConsumableNeed[];
  userId: string | null;
}): Promise<{ error?: string }> {
  const restore = await reverseSaleConsumableUsages({
    organizationId: options.organizationId,
    saleId: options.saleId,
    userId: options.userId,
    referenceType: "service_consumable_amend_reverse",
  });
  if (restore.error) return restore;

  const supabase = await createClient();
  await supabase
    .from("sale_consumable_usages")
    .delete()
    .eq("sale_id", options.saleId)
    .eq("organization_id", options.organizationId);

  if (!options.newNeeds.length) return {};

  return applySaleConsumableUsages({
    organizationId: options.organizationId,
    saleId: options.saleId,
    needs: options.newNeeds,
    userId: options.userId,
    referenceType: "service_consumable_amend",
  });
}
