import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ServicePerformanceProps = {
  services: { name: string; qty: number; revenue: number }[];
};

export function ServicePerformance({ services }: ServicePerformanceProps) {
  const maxRevenue = services[0]?.revenue ?? 1;

  return (
    <div className="dashboard-card flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Top Performing Services</h3>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          View reports
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No service sales recorded yet.</p>
          <Button className="mt-3" size="sm" variant="outline" render={<Link href="/pos" />}>
            Record a sale
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {services.map((service, i) => {
            const pct = maxRevenue > 0 ? (service.revenue / maxRevenue) * 100 : 0;
            return (
              <li key={service.name} className="space-y-2 px-5 py-3.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">{service.name}</span>
                  </div>
                  <span className="shrink-0 font-semibold text-foreground">
                    {formatCurrency(service.revenue)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full bg-primary transition-all duration-300")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {service.qty} bookings
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
