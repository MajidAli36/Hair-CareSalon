"use client";

import { Badge } from "@/components/ui/badge";
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
};

type CommandRow = {
  id: string;
  command: string;
  status: string;
  created_at: string;
  device: { name: string; type: string } | null;
};

export function DevicesTable({ devices }: { devices: DeviceRow[] }) {
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
                <TableHead>Auto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{d.type}</Badge>
                  </TableCell>
                  <TableCell>{d.location ?? "—"}</TableCell>
                  <TableCell>
                    {d.last_seen_at ? formatDateTime(d.last_seen_at) : "Never"}
                  </TableCell>
                  <TableCell>{d.auto_registered ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
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
