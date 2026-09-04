"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDevice, setDeviceActive } from "@/lib/actions/devices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PaginatedList } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

type DeviceRow = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  last_seen_at: string | null;
  auto_registered: boolean;
  is_active?: boolean;
};

type CommandRow = {
  id: string;
  command: string;
  status: string;
  created_at: string;
  device: { name: string; type: string } | null;
};

export function DevicesTable({
  devices,
  canManage = false,
}: {
  devices: DeviceRow[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <PaginatedList
      items={devices}
      empty={<p className="text-sm text-muted-foreground">No devices registered yet.</p>}
    >
      {(slice) => (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((d) => {
                const active = d.is_active !== false;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{d.type}</Badge>
                    </TableCell>
                    <TableCell>{d.location ?? "—"}</TableCell>
                    <TableCell>
                      {d.last_seen_at ? formatDateTime(d.last_seen_at) : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "default" : "secondary"}>
                        {active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                await setDeviceActive(d.id, !active);
                                router.refresh();
                              })
                            }
                          >
                            {active ? "Disable" : "Enable"}
                          </Button>
                          <ConfirmAction
                            title="Delete device?"
                            description={`Delete “${d.name}”? Related command history for this device will be removed.`}
                            confirmLabel="Delete"
                            pendingLabel="Deleting…"
                            variant="ghost"
                            onConfirm={async () => {
                              await deleteDevice(d.id);
                              router.refresh();
                            }}
                          >
                            Delete
                          </ConfirmAction>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}

export function DeviceCommandsTable({ commands }: { commands: CommandRow[] }) {
  return (
    <PaginatedList
      items={commands}
      empty={<p className="text-sm text-muted-foreground">No commands yet.</p>}
    >
      {(slice) => (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.device?.name ?? "—"}</TableCell>
                  <TableCell>{c.command}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.status}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PaginatedList>
  );
}
