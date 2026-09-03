"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createChair,
  deleteChair,
  renameChair,
  setChairActive,
  type ChairRow,
} from "@/lib/actions/chairs";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginatedList } from "@/components/ui/table-pagination";
import type { ActionResult } from "@/types/commerce";

type Props = {
  chairs: ChairRow[];
  canManage: boolean;
};

function RenameRow({ chair }: { chair: ChairRow }) {
  const [name, setName] = useState(chair.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Chair name required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", chair.id);
      fd.set("name", trimmed);
      const result = await renameChair({} as ActionResult, fd);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-32"
          maxLength={40}
          required
        />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={save}>
          {pending ? "…" : "Save"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ChairsManager({ chairs, canManage }: Props) {
  const [createState, createAction, creating] = useActionState(createChair, {} as ActionResult);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add chair</CardTitle>
            <CardDescription>
              Add as many chairs/stations as your salon has. They appear in the Queue form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label htmlFor="chair-name">Name</Label>
                <Input
                  id="chair-name"
                  name="name"
                  required
                  placeholder="e.g. Chair 1, Station A"
                  maxLength={40}
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding…" : "Add chair"}
              </Button>
            </form>
            {createState.error && (
              <p className="mt-2 text-sm text-destructive">{createState.error}</p>
            )}
            {createState.success && (
              <p className="mt-2 text-sm text-green-600">Chair added.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chairs ({chairs.length})</CardTitle>
          <CardDescription>Active chairs can be selected when issuing a queue token.</CardDescription>
        </CardHeader>
        <CardContent>
          <PaginatedList
            items={chairs}
            empty={
              <p className="text-sm text-muted-foreground">
                No chairs yet.{" "}
                {canManage ? "Add your first chair above." : "Ask a manager to add chairs."}
              </p>
            }
          >
            {(slice) => (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="w-[280px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((chair) => (
                      <TableRow key={chair.id}>
                        <TableCell className="font-medium">{chair.name}</TableCell>
                        <TableCell>
                          <Badge variant={chair.is_active ? "default" : "secondary"}>
                            {chair.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <RenameRow chair={chair} />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() =>
                                  startTransition(async () => {
                                    await setChairActive(chair.id, !chair.is_active);
                                  })
                                }
                              >
                                {chair.is_active ? "Disable" : "Enable"}
                              </Button>
                              <ConfirmAction
                                title="Delete chair?"
                                description={`Delete “${chair.name}”? Existing queue tokens keep the old chair name.`}
                                confirmLabel="Delete"
                                pendingLabel="Deleting…"
                                variant="ghost"
                                onConfirm={async () => {
                                  await deleteChair(chair.id);
                                }}
                              >
                                Delete
                              </ConfirmAction>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </PaginatedList>
        </CardContent>
      </Card>
    </div>
  );
}
