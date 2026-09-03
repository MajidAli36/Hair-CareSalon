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

  useEffect(() => {
    if (!canAccessPath(role, pathname, overrides)) {
      router.replace(landingPath);
    }
  }, [role, pathname, overrides, landingPath, router]);

  if (!canAccessPath(role, pathname, overrides)) {
    return null;
  }

  return children;
}
