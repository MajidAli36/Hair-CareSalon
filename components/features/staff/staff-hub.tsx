"use client";

import type { TeamMember } from "@/lib/actions/team";
import type { RoleNavMatrixRow } from "@/components/features/staff/role-permissions-editor";
import { TeamManagement } from "@/components/features/staff/team-management";
import { RolePermissionsEditor } from "@/components/features/staff/role-permissions-editor";
import { StaffForm } from "@/components/features/staff/staff-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginatedList } from "@/components/ui/table-pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fingerprint, Plus } from "lucide-react";
import Link from "next/link";

type StaffRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  job_title: string | null;
  pin_code: string | null;
  thumb_id: string | null;
  thumb_enrolled_at: string | null;
  is_active: boolean;
  online_booking_enabled: boolean;
};

type StaffHubProps = {
  staffList: StaffRow[];
  teamMembers: TeamMember[];
  roleMatrix: RoleNavMatrixRow[];
  canManage: boolean;
  canTeam: boolean;
  canInvite: boolean;
};

function loginByEmail(teamMembers: TeamMember[]) {
  const map = new Map<string, TeamMember>();
  for (const member of teamMembers) {
    map.set(member.email.toLowerCase(), member);
  }
  return map;
}

export function StaffHub({
  staffList,
  teamMembers,
  roleMatrix,
  canManage,
  canTeam,
  canInvite,
}: StaffHubProps) {
  const logins = loginByEmail(teamMembers);
  const defaultTab = "roster";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="roster">Salon team</TabsTrigger>
        {canTeam && <TabsTrigger value="logins">App logins</TabsTrigger>}
        {canTeam && roleMatrix.length > 0 && (
          <TabsTrigger value="access">Role access</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="roster" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Salon team</CardTitle>
              <CardDescription>
                Employee profiles for thumb attendance, appointments, and payroll. Enroll thumbs on
                the Attendance page.
              </CardDescription>
            </div>
            {canManage && (
              <Dialog>
                <DialogTrigger
                  render={
                    <Button type="button">
                      <Plus className="mr-1.5 size-4" />
                      Add staff
                    </Button>
                  }
                />
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add staff member</DialogTitle>
                    <DialogDescription>
                      Create a salon profile. Use the same email when adding an app login so
                      they appear linked here.
                    </DialogDescription>
                  </DialogHeader>
                  <StaffForm />
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            <PaginatedList
              items={staffList}
              empty={
                <p className="text-sm text-muted-foreground">
                  No staff profiles yet. Add your first team member above.
                </p>
              }
            >
              {(slice) => (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Thumb</TableHead>
                        <TableHead>App login</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slice.map((s) => {
                        const login = s.email
                          ? logins.get(s.email.toLowerCase())
                          : undefined;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.full_name}</TableCell>
                            <TableCell>{s.job_title ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              <div>{s.phone ?? "—"}</div>
                              {s.email && (
                                <div className="text-muted-foreground">{s.email}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {s.thumb_id ? (
                                <Badge variant="default" className="gap-1">
                                  <Fingerprint className="size-3" />
                                  Enrolled
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not enrolled</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {login ? (
                                <Badge variant="outline">{login.roleLabel}</Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">No login</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={s.is_active ? "default" : "secondary"}>
                                  {s.is_active ? "Active" : "Inactive"}
                                </Badge>
                                {s.online_booking_enabled && (
                                  <Badge variant="outline">Online booking</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PaginatedList>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Related:</span>
          <Button variant="link" className="h-auto p-0" render={<Link href="/attendance" />}>
            Attendance
          </Button>
          <span>·</span>
          <Button variant="link" className="h-auto p-0" render={<Link href="/online-booking" />}>
            Online booking schedules
          </Button>
          <span>·</span>
          <Button variant="link" className="h-auto p-0" render={<Link href="/finances" />}>
            Staff payments
          </Button>
        </div>
      </TabsContent>

      {canTeam && (
        <TabsContent value="logins">
          <TeamManagement members={teamMembers} canInvite={canInvite} />
        </TabsContent>
      )}

      {canTeam && roleMatrix.length > 0 && (
        <TabsContent value="access">
          <RolePermissionsEditor matrix={roleMatrix} />
        </TabsContent>
      )}
    </Tabs>
  );
}
