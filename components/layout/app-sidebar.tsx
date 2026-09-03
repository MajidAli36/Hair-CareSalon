"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Scissors } from "lucide-react";
import { filterNavGroupsForRole, type NavPermissionsConfig } from "@/lib/permissions/nav";
import type { MemberRole } from "@/types";
import { getInitials } from "@/lib/format";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND } from "@/lib/marketing/brand";
import { UserMenu } from "@/components/layout/user-menu";

type AppSidebarProps = {
  memberRole: MemberRole;
  navOverrides: NavPermissionsConfig;
  organizationName?: string;
  userEmail?: string;
  userRole?: string;
};

export function AppSidebar({
  memberRole,
  navOverrides,
  organizationName = BRAND.name,
  userEmail,
  userRole = "Owner",
}: AppSidebarProps) {
  const pathname = usePathname();
  const navGroups = useMemo(
    () => filterNavGroupsForRole(memberRole, navOverrides),
    [memberRole, navOverrides]
  );
  const showSettingsLink = navGroups.some((g) =>
    g.items.some((item) => item.href === "/settings")
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scissors className="size-4" />
            </div>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-foreground">{organizationName}</p>
              <p className="truncate text-xs text-muted-foreground">{BRAND.tagline}</p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled>{organizationName}</DropdownMenuItem>
            {showSettingsLink && (
              <DropdownMenuItem>
                <Link href="/settings">Workspace settings</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        className="h-10 rounded-lg px-2.5 transition-colors duration-150 data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground"
                        render={<Link href={item.href} />}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        <span className="text-[13px]">{item.title}</span>
                        {item.badge ? (
                          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {item.badge}
                          </span>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <UserMenu
          email={userEmail}
          role={userRole}
          variant="sidebar"
          fallback={getInitials(userEmail ?? organizationName)}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
