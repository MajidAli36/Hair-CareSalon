"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, HelpCircle, Search } from "lucide-react";
import { getPageTitle } from "@/lib/navigation";
import { getInitials } from "@/lib/format";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/layout/user-menu";

type AppHeaderProps = {
  userEmail?: string;
  userRole?: string;
  organizationName?: string;
};

export function AppHeader({ userEmail, userRole, organizationName }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = new FormData(form).get("q") as string;
    if (q?.trim()) {
      router.push(`/customers?search=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="hidden h-4 sm:block" />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{pageTitle}</h1>
        {organizationName && pathname !== "/dashboard" ? (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{organizationName}</p>
        ) : null}
      </div>

      <form
        onSubmit={handleSearch}
        className="hidden max-w-sm flex-1 md:flex md:max-w-xs lg:max-w-md"
      >
        <div className="relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search customers, appointments…"
            className="h-9 rounded-lg border-border bg-muted/50 pl-9 text-sm transition-colors focus:bg-background"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </div>
      </form>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Search"
          onClick={() => router.push("/customers")}
        >
          <Search className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label="Help">
          <HelpCircle className="size-4" />
        </Button>
        <UserMenu
          email={userEmail}
          role={userRole}
          fallback={getInitials(userEmail ?? organizationName ?? "U")}
          variant="header"
        />
      </div>
    </header>
  );
}
