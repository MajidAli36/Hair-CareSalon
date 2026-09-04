"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CalendarClock, CircleDollarSign, Loader2 } from "lucide-react";
import {
  getAppNotifications,
  type AppNotification,
  type AppNotificationsPayload,
} from "@/lib/actions/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const SEEN_KEY = "salon-notifications-seen-at";
const POLL_MS = 45_000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [payload, setPayload] = useState<AppNotificationsPayload>({
    badgeCount: 0,
    items: [],
  });
  const [seenAt, setSeenAt] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await getAppNotifications();
        setPayload(next);
      } catch {
        // Keep last good payload if the session briefly fails
      }
    });
  }, []);

  useEffect(() => {
    try {
      setSeenAt(localStorage.getItem(SEEN_KEY));
    } catch {
      setSeenAt(null);
    }
    load();
    const id = window.setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const unseenInfoCount = payload.items.filter(
    (item) =>
      !item.actionable &&
      (!seenAt || new Date(item.createdAt).getTime() > new Date(seenAt).getTime())
  ).length;

  const badgeCount = payload.badgeCount + unseenInfoCount;
  const badgeLabel = badgeCount > 9 ? "9+" : String(badgeCount);

  function markSeen() {
    const now = new Date().toISOString();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, now);
    } catch {
      // ignore
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      load();
      markSeen();
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className="relative inline-flex size-7 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          badgeCount > 0 ? `Notifications, ${badgeCount} unread` : "Notifications"
        }
      >
        <Bell className="size-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white ring-2 ring-card">
            {badgeLabel}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
            Notifications
          </DropdownMenuLabel>
          {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <DropdownMenuSeparator className="my-0" />

        {payload.items.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Bell className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New online bookings and payment proofs show up here.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {payload.items.map((item) => (
              <li key={item.id}>
                <NotificationRow item={item} onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        )}

        <DropdownMenuSeparator className="my-0" />
        <div className="p-1.5">
          <DropdownMenuItem
            className="cursor-pointer justify-center text-xs font-medium text-primary"
            render={<Link href="/online-booking" />}
            onClick={() => setOpen(false)}
          >
            Open online booking
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  item,
  onNavigate,
}: {
  item: AppNotification;
  onNavigate: () => void;
}) {
  const Icon = item.kind === "pending_payment" ? CircleDollarSign : CalendarClock;

  return (
    <DropdownMenuItem
      className={cn(
        "cursor-pointer items-start gap-3 rounded-none px-3 py-2.5 focus:bg-accent/70",
        item.actionable && "bg-amber-50/60 focus:bg-amber-50"
      )}
      render={<Link href={item.href} />}
      onClick={onNavigate}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          item.actionable
            ? "bg-amber-100 text-amber-800"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{item.title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {relativeTime(item.createdAt)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{item.body}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{item.meta}</span>
        {item.actionable && (
          <span className="mt-1.5 inline-flex text-[11px] font-semibold text-amber-800">
            Review payment →
          </span>
        )}
      </span>
    </DropdownMenuItem>
  );
}
