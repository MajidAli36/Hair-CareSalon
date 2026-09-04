import { getAuditLogs } from "@/lib/actions/audit";
import { getActiveOrganization } from "@/lib/auth/organization";
import { canManageRecords } from "@/lib/auth/permissions";
import { AuditLogTable } from "@/components/features/settings/audit-log-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const org = await getActiveOrganization();
  const canManage = await canManageRecords();
  const auditLogs = canManage ? await getAuditLogs().catch(() => []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Organization settings, integrations, and security audit trail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {org?.organizationName ?? "—"}</p>
          <p><span className="text-muted-foreground">ID:</span> {org?.organizationId ?? "—"}</p>
          <p><span className="text-muted-foreground">Your role:</span> {org?.role ?? "—"}</p>
          <p className="pt-2 text-muted-foreground">
            Staff profiles, logins, and role permissions are managed on the{" "}
            <Button variant="link" className="h-auto p-0" render={<Link href="/staff" />}>
              Staff
            </Button>{" "}
            page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Webhook endpoints for external services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          <p>Device register: <span className="text-muted-foreground">/api/devices/register</span></p>
          <p>Online booking: <span className="text-muted-foreground">/book/[org-slug]</span></p>
          <p>Health: <span className="text-muted-foreground">/api/health</span></p>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Recent sensitive actions (last 50)</CardDescription>
          </CardHeader>
          <CardContent>
            <AuditLogTable logs={auditLogs} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
