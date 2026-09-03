import { getStaff } from "@/lib/actions/staff";
import { getTeamMembers, canManageTeam } from "@/lib/actions/team";
import { getRoleNavMatrix } from "@/lib/actions/role-permissions";
import { canManageRecords } from "@/lib/auth/permissions";
import { StaffHub } from "@/components/features/staff/staff-hub";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/env";

export default async function StaffPage() {
  const [staffList, canManage, canTeam] = await Promise.all([
    getStaff(),
    canManageRecords(),
    canManageTeam(),
  ]);

  const teamMembers = canTeam ? await getTeamMembers().catch(() => []) : [];
  const roleMatrix = canTeam ? await getRoleNavMatrix().catch(() => []) : [];
  const canInvite = Boolean(getSupabaseServiceRoleKey());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-muted-foreground">
          Manage salon profiles, app logins, and role-based sidebar access in one place.
        </p>
      </div>

      <StaffHub
        staffList={staffList}
        teamMembers={teamMembers}
        roleMatrix={roleMatrix}
        canManage={canManage}
        canTeam={canTeam}
        canInvite={canInvite}
      />
    </div>
  );
}
