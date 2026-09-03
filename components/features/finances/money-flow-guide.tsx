import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SalonMoneyFlowGuide() {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">How money flows in Salon</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Services, products, and inventory connect through POS into Dashboard, Reports, and
          Finances.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <FlowBlock
            title="1 · Catalog (Services & Products)"
            lines={[
              "Services → price only (no stock). Sold at POS → full amount is revenue.",
              "Products → cost price + retail price + stock. Stock In adds units; POS sale reduces stock.",
            ]}
          />
          <FlowBlock
            title="2 · POS checkout (money IN)"
            lines={[
              "Customer pays retail price (services + products + packages).",
              "Recorded as Sales revenue → Dashboard, Reports, Finances.",
              "Product sale also records COGS = qty sold × cost price.",
            ]}
          />
          <FlowBlock
            title="3 · Inventory (stock on hand)"
            lines={[
              "Value at cost = Σ (stock × cost) — money tied up in products.",
              "Not cash out today; becomes COGS when sold at POS.",
              "Use Products → Inventory tab to restock (Stock In).",
            ]}
          />
          <FlowBlock
            title="4 · Finances (money OUT)"
            lines={[
              "Expenses: rent, utilities, marketing (Finances → Add expense).",
              "Staff payments: salary, bonus (Finances → Staff payment).",
              "Advance refunds: auto expense when admin reverts deposit.",
            ]}
          />
        </div>

        <div className="rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          Net profit = Sales revenue − Expenses − Staff paid − Product COGS (sold)
          <br />
          Net cash flow = (Sales + Advances collected) − (Expenses + Staff + COGS)
          <br />
          Product gross profit = Product retail sold − Product COGS
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" render={<Link href="/products" />}>
            Products & inventory
          </Button>
          <Button type="button" size="sm" variant="outline" render={<Link href="/reports" />}>
            Reports
          </Button>
          <Button type="button" size="sm" variant="outline" render={<Link href="/pos" />}>
            POS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FlowBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="font-medium text-foreground">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
