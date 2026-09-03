"use client";

import { useActionState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import {
  getRoleNavMatrix,
  updateRoleNavPermission,
  resetRoleNavPermissions,
} from "@/lib/actions/role-permissions";
import { NAV_KEYS, NAV_KEY_LABELS, type NavKey } from "@/lib/permissions/nav";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { MemberRole } from "@/types";
import type { ActionResult } from "@/types/commerce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RoleNavMatrixRow = Awaited<ReturnType<typeof getRoleNavMatrix>>[number];

type RolePermissionsEditorProps = {
  matrix: RoleNavMatrixRow[];
};

export function RolePermissionsEditor({ matrix }: RolePermissionsEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Navigation by role</CardTitle>
        <CardDescription>
          Choose which sidebar pages each role can see. Changes apply immediately for all
          users with that role. Owner always has full access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={matrix[0]?.role ?? "STAFF"}>
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
            {matrix.map((row) => (
              <TabsTrigger key={row.role} value={row.role} className="text-xs sm:text-sm">
                {row.roleLabel}
              </TabsTrigger>
            ))}
          </TabsList>
          {matrix.map((row) => (
            <TabsContent key={row.role} value={row.role}>
              <RoleNavTable role={row.role} permissions={row.permissions} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RoleNavTable({
  role,
  permissions,
}: {
  role: MemberRole;
  permissions: Record<NavKey, boolean>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {ROLE_LABELS[role]} — toggle pages visible in the sidebar
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await resetRoleNavPermissions(role);
            })
          }
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          Reset defaults
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead className="w-[120px] text-right">Visible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {NAV_KEYS.map((key) => (
              <NavPermissionRow
                key={key}
                role={role}
                navKey={key}
                enabled={permissions[key]}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NavPermissionRow({
  role,
  navKey,
  enabled,
}: {
  role: MemberRole;
  navKey: NavKey;
  enabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateRoleNavPermission, {} as ActionResult);

  return (
    <TableRow>
      <TableCell className="font-medium">{NAV_KEY_LABELS[navKey]}</TableCell>
      <TableCell className="text-right">
        <form action={formAction}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="navKey" value={navKey} />
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <Button
            type="submit"
            size="sm"
            variant={enabled ? "default" : "outline"}
            disabled={isPending}
            className="min-w-[72px]"
          >
            {isPending ? "…" : enabled ? "On" : "Off"}
          </Button>
        </form>
        {state.error && (
          <p className="mt-1 text-xs text-destructive">{state.error}</p>
        )}
      </TableCell>
    </TableRow>
  );
}
