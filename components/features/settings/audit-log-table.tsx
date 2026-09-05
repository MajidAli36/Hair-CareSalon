"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginatedList } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { AuditLogRow } from "@/lib/actions/audit";
import {
  presentAuditLog,
  toneBadgeVariant,
  type PresentedAudit,
} from "@/lib/audit/present";
import { cn } from "@/lib/utils";
import { ExternalLink, Search } from "lucide-react";

type RowView = {
  log: AuditLogRow;
  presented: PresentedAudit;
};

function ActorCell({ presented }: { presented: PresentedAudit }) {
  const unknown = presented.roleLabel === "Unknown role";
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{presented.actorLabel}</p>
      <p className={cn("text-xs", unknown ? "text-muted-foreground/70" : "text-muted-foreground")}>
        {presented.roleLabel}
      </p>
    </div>
  );
}

export function AuditLogTable({ logs }: { logs: AuditLogRow[] }) {
  const [selected, setSelected] = useState<RowView | null>(null);
  const [query, setQuery] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const rows = useMemo<RowView[]>(
    () =>
      logs.map((log) => ({
        log,
        presented: presentAuditLog(log),
      })),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ log, presented }) => {
      const hay = [
        presented.actionLabel,
        presented.actionCode,
        presented.detail,
        presented.entityLabel,
        presented.actorLabel,
        presented.roleLabel,
        log.entity_type,
        log.entity_id ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action, person, invoice, detail…"
            className="pl-8"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {logs.length} recent events
        </p>
      </div>

      <PaginatedList
        items={filtered}
        empty={
          <p className="text-sm text-muted-foreground">
            {logs.length === 0
              ? "No audit entries yet."
              : "No events match your search."}
          </p>
        }
      >
        {(slice) => (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">When</TableHead>
                  <TableHead className="min-w-[160px]">Action</TableHead>
                  <TableHead className="min-w-[220px]">Detail</TableHead>
                  <TableHead className="min-w-[140px]">Record</TableHead>
                  <TableHead className="min-w-[160px]">Who</TableHead>
                  <TableHead className="w-[88px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map(({ log, presented }) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={toneBadgeVariant(presented.tone)}>
                          {presented.actionLabel}
                        </Badge>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {presented.actionCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[280px] text-sm leading-snug">
                        {presented.detail}
                      </p>
                    </TableCell>
                    <TableCell>
                      {presented.entityHref ? (
                        <Link
                          href={presented.entityHref}
                          className="inline-flex max-w-[200px] items-center gap-1 truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {presented.entityLabel}
                          <ExternalLink className="size-3 shrink-0 opacity-60" />
                        </Link>
                      ) : (
                        <span className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {presented.entityLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActorCell presented={presented} />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowRaw(false);
                          setSelected({ log, presented });
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PaginatedList>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setShowRaw(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.presented.actionLabel ?? "Audit details"}</DialogTitle>
            <DialogDescription>
              {selected
                ? `${formatDateTime(selected.log.created_at)} · ${selected.presented.actionCode}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Who</p>
                  <p className="font-medium">{selected.presented.actorLabel}</p>
                  <p className="text-xs text-muted-foreground">{selected.presented.roleLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Record</p>
                  {selected.presented.entityHref ? (
                    <Link
                      href={selected.presented.entityHref}
                      className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                    >
                      {selected.presented.entityLabel}
                      <ExternalLink className="size-3 opacity-60" />
                    </Link>
                  ) : (
                    <p className="font-medium">{selected.presented.entityLabel}</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  What happened
                </p>
                <p className="leading-relaxed">{selected.presented.detail}</p>
              </div>

              {selected.presented.detailLines.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Action detail
                  </p>
                  <dl className="divide-y rounded-lg border">
                    {selected.presented.detailLines.map((line) => (
                      <div
                        key={`${line.label}-${line.value}`}
                        className="flex items-start justify-between gap-4 px-3 py-2"
                      >
                        <dt className="text-muted-foreground">{line.label}</dt>
                        <dd className="text-right font-medium">{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRaw((v) => !v)}
                >
                  {showRaw ? "Hide technical data" : "Show technical data"}
                </Button>
                {selected.log.entity_id && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {selected.log.entity_id}
                  </p>
                )}
              </div>

              {showRaw && (
                <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(
                    {
                      action: selected.log.action,
                      entity_type: selected.log.entity_type,
                      entity_id: selected.log.entity_id,
                      user_id: selected.log.user_id,
                      actor_role: selected.log.actor_role,
                      actor_email: selected.log.actor_email,
                      metadata: selected.log.metadata ?? {},
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
