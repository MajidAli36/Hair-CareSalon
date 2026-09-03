export type ProductPricing = {
  cost_price: number;
  retail_price: number;
  stock_quantity: number;
};

export type ProductValuation = {
  costPrice: number;
  retailPrice: number;
  stock: number;
  unitMargin: number;
  marginPercent: number;
  stockValueAtCost: number;
  stockValueAtRetail: number;
  potentialProfit: number;
};

export function getProductValuation(product: ProductPricing): ProductValuation {
  const costPrice = Number(product.cost_price) || 0;
  const retailPrice = Number(product.retail_price) || 0;
  const stock = Math.max(0, Number(product.stock_quantity) || 0);
  const unitMargin = retailPrice - costPrice;
  const marginPercent =
    retailPrice > 0 ? Math.round((unitMargin / retailPrice) * 100) : 0;

  return {
    costPrice,
    retailPrice,
    stock,
    unitMargin,
    marginPercent,
    stockValueAtCost: stock * costPrice,
    stockValueAtRetail: stock * retailPrice,
    potentialProfit: stock * unitMargin,
  };
}

export type InventorySummary = {
  productCount: number;
  totalUnits: number;
  totalValueAtCost: number;
  totalValueAtRetail: number;
  totalPotentialProfit: number;
  lowStockCount: number;
};

export function getInventorySummary(
  products: (ProductPricing & { low_stock_threshold?: number; is_active?: boolean })[]
): InventorySummary {
  let totalUnits = 0;
  let totalValueAtCost = 0;
  let totalValueAtRetail = 0;
  let totalPotentialProfit = 0;
  let lowStockCount = 0;

  for (const product of products) {
    const v = getProductValuation(product);
    totalUnits += v.stock;
    totalValueAtCost += v.stockValueAtCost;
    totalValueAtRetail += v.stockValueAtRetail;
    totalPotentialProfit += v.potentialProfit;

    const threshold = product.low_stock_threshold ?? 5;
    if (product.is_active !== false && v.stock <= threshold) {
      lowStockCount++;
    }
  }

  return {
    productCount: products.length,
    totalUnits,
    totalValueAtCost,
    totalValueAtRetail,
    totalPotentialProfit,
    lowStockCount,
  };
}

/** Value moved in an inventory transaction (uses current product cost). */
export function getTransactionValue(
  quantity: number,
  costPrice: number,
  type: "IN" | "OUT" | "ADJUSTMENT"
): number {
  const qty = Math.max(0, quantity);
  const cost = Number(costPrice) || 0;
  if (type === "ADJUSTMENT") return 0;
  return qty * cost;
}
