"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus, ShoppingCart, UserPlus, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canAccessPath, type NavPermissionsConfig } from "@/lib/permissions/nav";
import type { MemberRole } from "@/types";

const actions = [
  { label: "New Appointment", href: "/appointments/new", icon: Calendar, shortcut: "A" },
  { label: "New Customer", href: "/customers/new", icon: UserPlus, shortcut: "C" },
  { label: "New Sale", href: "/pos", icon: ShoppingCart, shortcut: "S" },
  { label: "Add Product", href: "/products", icon: Package, shortcut: "P" },
] as const;

type QuickActionFabProps = {
  memberRole: MemberRole;
  navOverrides: NavPermissionsConfig;
};

export function QuickActionFab({ memberRole, navOverrides }: QuickActionFabProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const visibleActions = useMemo(
    () => actions.filter((action) => canAccessPath(memberRole, action.href, navOverrides)),
    [memberRole, navOverrides]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!e.altKey) return;

      const map: Record<string, string> = {
        a: "/appointments/new",
        c: "/customers/new",
        s: "/pos",
        p: "/products",
      };
      const href = map[e.key.toLowerCase()];
      if (href && canAccessPath(memberRole, href, navOverrides)) {
        e.preventDefault();
        router.push(href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, memberRole, navOverrides]);

  if (visibleActions.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
      {open && (
        <div className="mb-1 flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {visibleActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <action.icon className="size-4 text-primary" />
              <span>{action.label}</span>
              <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Alt+{action.shortcut}
              </kbd>
            </Link>
          ))}
        </div>
      )}

      <Button
        size="icon-lg"
        className={cn(
          "size-12 rounded-full shadow-lg transition-transform duration-200 hover:scale-105",
          open && "rotate-45"
        )}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </Button>
    </div>
  );
}
