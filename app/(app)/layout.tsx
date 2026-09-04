import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/session";
import { getActiveOrganization } from "@/lib/auth/organization";
import { ROLE_LABELS } from "@/lib/permissions/roles";
import { getOrgNavPermissions } from "@/lib/actions/role-permissions";
import { getDefaultLandingPath } from "@/lib/permissions/nav";
import { BRAND } from "@/lib/marketing/brand";
import type { Metadata } from "next";
import { SYNCOPS } from "@/lib/print/syncops";

export const metadata: Metadata = {
  title: {
    default: `Dashboard | ${BRAND.name} · ${SYNCOPS.name}`,
    template: `%s | ${BRAND.name} · ${SYNCOPS.name}`,
  },
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const org = await getActiveOrganization();
  const overrides = org ? await getOrgNavPermissions() : {};
  const landingPath = org ? getDefaultLandingPath(org.role, overrides) : "/dashboard";

  return (
    <AppShell
      organizationName={BRAND.name}
      userEmail={user.email}
      userRole={org ? ROLE_LABELS[org.role] : undefined}
      memberRole={org?.role ?? "STAFF"}
      navOverrides={overrides}
      landingPath={landingPath}
    >
      {children}
    </AppShell>
  );
}
