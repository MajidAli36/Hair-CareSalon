"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CalendarClock, CircleDollarSign, Loader2 } from "lucide-react";
import {
  getAppNotifications,
  type AppNotification,
  type AppNotificationsPayload,
} from "@/lib/actions/notifications";
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
    canOpenOnlineBooking: false,
  });
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      load();
      markSeen();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex size-7 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          badgeCount > 0 ? `Notifications, ${badgeCount} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell className="size-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white ring-2 ring-card">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="h-px bg-border" />

          {payload.items.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New online bookings and payment proofs show up here.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {payload.items.map((item) => (
                <NotificationRow key={item.id} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )}

          <div className="h-px bg-border" />
          {payload.canOpenOnlineBooking && (
            <div className="p-1.5">
              <Link
                href="/online-booking"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-md px-2 py-2 text-xs font-medium text-primary hover:bg-accent"
              >
                Open online booking
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
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
    <Link
      href={item.href}
      role="menuitem"
      onClick={onNavigate}
      className={cn(
        "flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/70",
        item.actionable && "bg-amber-50/60 hover:bg-amber-50"
      )}
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
    </Link>
  );
}
