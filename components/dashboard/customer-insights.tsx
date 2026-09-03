import { formatCurrency } from "@/lib/format";
import { Users, UserPlus, Repeat, Wallet } from "lucide-react";

type CustomerInsightsProps = {
  totalCustomers: number;
  newThisWeek: number;
  returning: number;
  averageSpend: number;
  retentionRate: number | null;
};

export function CustomerInsights({
  totalCustomers,
  newThisWeek,
  returning,
  averageSpend,
  retentionRate,
}: CustomerInsightsProps) {
  const cards = [
    {
      label: "Total Customers",
      value: String(totalCustomers),
      sub: "Active in salon",
      icon: Users,
    },
    {
      label: "New This Week",
      value: String(newThisWeek),
      sub: newThisWeek > 0 ? "Recent sign-ups" : "No new customers",
      icon: UserPlus,
    },
    {
      label: "Returning",
      value: String(returning),
      sub: "Repeat buyers",
      icon: Repeat,
    },
    {
      label: "Average Spend",
      value: formatCurrency(averageSpend),
      sub: retentionRate != null ? `${retentionRate.toFixed(0)}% retention` : "Per customer",
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Customer Insights</h3>
        <p className="text-xs text-muted-foreground">Growth and loyalty metrics</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="dashboard-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{card.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{card.sub}</p>
              </div>
              <card.icon className="size-4 shrink-0 text-muted-foreground/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
