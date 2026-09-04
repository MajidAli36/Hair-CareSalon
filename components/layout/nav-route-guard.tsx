"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessPath } from "@/lib/permissions/nav";
import type { NavPermissionsConfig } from "@/lib/permissions/nav";
import type { MemberRole } from "@/types";

type NavRouteGuardProps = {
  role: MemberRole;
  overrides: NavPermissionsConfig;
  landingPath: string;
  children: React.ReactNode;
};

export function NavRouteGuard({
  role,
  overrides,
  landingPath,
  children,
}: NavRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(role, pathname, overrides);

  useEffect(() => {
    if (!allowed) {
      router.replace(landingPath);
    }
  }, [allowed, landingPath, router]);

  if (!allowed) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return children;
}
