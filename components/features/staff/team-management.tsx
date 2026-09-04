"use client";

import { useActionState, useCallback, useState, useTransition } from "react";
import {
  inviteTeamMember,
  removeTeamMember,
  resetTeamMemberPassword,
  updateTeamMemberRole,
} from "@/lib/actions/team";
import type { TeamMember } from "@/lib/actions/team";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import type { MemberRole } from "@/types";
import type { ActionResult } from "@/types/commerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginatedList } from "@/components/ui/table-pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ASSIGNABLE_ROLES: MemberRole[] = [
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "RECEPTIONIST",
  "STAFF",
];

type TeamManagementProps = {
  members: TeamMember[];
  canInvite: boolean;
};

export function TeamManagement({ members, canInvite }: TeamManagementProps) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteTeamMember,
    {} as ActionResult
  );
  const [role, setRole] = useState<MemberRole>("STAFF");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>App logins</CardTitle>
          <CardDescription>
            Dashboard accounts (email + password). Each login has a role that controls sidebar
            access — fine-tune pages per role in the Role access tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginatedList
            items={members}
            empty={<p className="text-sm text-muted-foreground">No app logins yet.</p>}
          >
            {(slice) => (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Login email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((member) => (
                      <TeamMemberRow key={member.id} member={member} canResetPassword={canInvite} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </PaginatedList>
        </CardContent>
      </Card>

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Create login</CardTitle>
            <CardDescription>
              Use the same email as the salon profile so they appear linked on the Salon team
              tab. Share the password with the team member — they can sign in immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={inviteAction} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Login email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="staff@salon.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Initial password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Role</Label>
                <input type="hidden" name="role" value={role} />
                <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteState.error && (
                <p className="text-sm text-destructive sm:col-span-2">{inviteState.error}</p>
              )}
              {inviteState.success && (
                <p className="text-sm text-green-600 sm:col-span-2">
                  Login created. They can sign in with the email and password above.
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={invitePending}>
                  {invitePending ? "Creating…" : "Create login"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create login</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add <code className="rounded bg-muted px-1 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env.local</code> to create logins
              from the app. Until then, create users in the Supabase dashboard.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamMemberRow({
  member,
  canResetPassword,
}: {
  member: TeamMember;
  canResetPassword: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(member.role);
  const [updateState, updateAction] = useActionState(updateTeamMemberRole, {} as ActionResult);

  const isOwner = member.role === "OWNER";

  return (
    <TableRow>
      <TableCell className="font-medium">{member.email}</TableCell>
      <TableCell>
        {isOwner ? (
          <Badge>{member.roleLabel}</Badge>
        ) : (
          <form action={updateAction} className="flex items-center gap-2">
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="role" value={role} />
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" variant="outline" disabled={pending || role === member.role}>
              Save
            </Button>
          </form>
        )}
        {updateState.error && (
          <p className="mt-1 text-xs text-destructive">{updateState.error}</p>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(member.joinedAt)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {!isOwner && canResetPassword && (
            <ResetPasswordDialog member={member} />
          )}
          {!isOwner && (
            <ConfirmAction
              title="Remove app login?"
              description={`Remove ${member.email} from this salon? They will not be able to sign in. Salon staff profile is kept separately.`}
              confirmLabel="Remove"
              pendingLabel="Removing…"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onConfirm={async () => {
                await removeTeamMember(member.id);
              }}
            >
              Remove
            </ConfirmAction>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ResetPasswordDialog({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false);
  const resetAction = useCallback(
    async (prev: ActionResult, formData: FormData) => {
      const result = await resetTeamMemberPassword(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    []
  );
  const [state, formAction, isPending] = useActionState(resetAction, {} as ActionResult);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline">
            Reset password
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {member.email}. They will use this on next login.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="memberId" value={member.id} />
          <div className="space-y-2">
            <Label htmlFor={`pwd-${member.id}`}>New password</Label>
            <Input
              id={`pwd-${member.id}`}
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600">Password updated.</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Update password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
