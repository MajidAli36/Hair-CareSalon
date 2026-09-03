"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WhatsAppLinkState, WhatsAppQueueStats } from "@/lib/whatsapp/session-types";

const EMPTY_STATE: WhatsAppLinkState = {
  status: "idle",
  qr: null,
  phone: null,
  error: null,
};

function statusLabel(status: WhatsAppLinkState["status"]) {
  switch (status) {
    case "connected":
      return "Linked";
    case "qr":
      return "Scan QR";
    case "connecting":
      return "Connecting…";
    default:
      return "Not linked";
  }
}

function statusBadgeClass(status: WhatsAppLinkState["status"]) {
  switch (status) {
    case "connected":
      return "bg-green-600";
    case "qr":
      return "bg-amber-600";
    case "connecting":
      return "bg-sky-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatWait(seconds: number) {
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.ceil(seconds / 60);
  return `~${m} min`;
}

type WhatsAppLinkPanelProps = {
  canManage: boolean;
};

export function WhatsAppLinkPanel({ canManage }: WhatsAppLinkPanelProps) {
  const [state, setState] = useState<WhatsAppLinkState>(EMPTY_STATE);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/session", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setFetchError(data?.error ?? "Could not load WhatsApp link status");
        return;
      }
      const data = (await res.json()) as WhatsAppLinkState;
      setState(data);
      setFetchError(null);
    } catch {
      setFetchError("Could not reach WhatsApp link service");
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refresh();
    }, 0);
    const id = setInterval(() => {
      void refresh();
    }, 2500);
    return () => {
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, [refresh]);

  function runAction(action: "start" | "logout" | "pause_queue" | "resume_queue") {
    startTransition(async () => {
      try {
        const res = await fetch("/api/whatsapp/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = (await res.json()) as WhatsAppLinkState & { error?: string };
        if (!res.ok) {
          setFetchError(data.error ?? "Action failed");
          return;
        }
        setState(data);
        setFetchError(null);
        if (action === "start") {
          setTimeout(() => void refresh(), 800);
        }
      } catch {
        setFetchError("Action failed");
      }
    });
  }

  const queue: WhatsAppQueueStats | undefined = state.queue;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Link salon WhatsApp</CardTitle>
          <Badge className={statusBadgeClass(state.status)}>{statusLabel(state.status)}</Badge>
          {queue && queue.pending > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-800">
              Queue {queue.pending}
            </Badge>
          )}
        </div>
        <CardDescription>
          Scan once with the owner&apos;s WhatsApp (Linked Devices). Outbound messages run in a
          background queue with a 10–15 second gap to protect the account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "connected" ? (
          <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 text-sm">
            <p className="font-medium text-green-900">WhatsApp linked and ready to send</p>
            {state.phone && (
              <p className="mt-1 text-green-800/80">Connected as +{state.phone}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Use &quot;Send to customer&quot; below — messages are queued and delivered one-by-one.
            </p>
          </div>
        ) : state.status === "qr" && state.qr ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <QRCode value={state.qr} size={200} level="M" />
            </div>
            <ol className="max-w-sm list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Open WhatsApp on the salon owner&apos;s phone</li>
              <li>Settings → Linked devices → Link a device</li>
              <li>Scan this QR code</li>
            </ol>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {state.status === "connecting"
                ? "Starting link… QR will appear in a moment."
                : "Not linked yet. Generate a QR code, then scan it with the salon WhatsApp."}
            </p>
          </div>
        )}

        {queue && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">Safe send queue</p>
            <p>
              Gap between messages: <strong className="text-foreground">{queue.gapSeconds[0]}–
              {queue.gapSeconds[1]}s</strong>
              {queue.paused ? " · paused" : queue.processing ? " · delivering…" : ""}
            </p>
            <p>
              Pending: <strong className="text-foreground">{queue.pending}</strong>
              {queue.pending > 0 && (
                <>
                  {" "}
                  · ETA for last in queue:{" "}
                  <strong className="text-foreground">
                    {formatWait(queue.estimatedWaitSeconds)}
                  </strong>
                </>
              )}
            </p>
            <p>
              Sent today: {queue.sendsToday}/{queue.limits.maxPerDay} · last hour:{" "}
              {queue.sendsLastHour}/{queue.limits.maxPerHour}
            </p>
            <p>
              Same-number cooldown: {queue.limits.samePhoneCooldownSeconds}s · max queue:{" "}
              {queue.limits.maxQueue}
            </p>
          </div>
        )}

        {(state.error || fetchError) && (
          <p className="text-sm text-destructive">{state.error ?? fetchError}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Keep this server running while the queue delivers. Unofficial WhatsApp Web link — normal
          salon traffic only.
        </p>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {state.status !== "connected" && (
              <Button
                type="button"
                disabled={pending || state.status === "connecting"}
                onClick={() => runAction("start")}
              >
                {state.status === "qr" ? "Refresh QR" : "Show link QR"}
              </Button>
            )}
            {(state.status === "connected" ||
              state.status === "qr" ||
              state.status === "connecting") && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => runAction("logout")}
              >
                Disconnect
              </Button>
            )}
            {state.status === "connected" && queue && !queue.paused && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => runAction("pause_queue")}
              >
                Pause queue
              </Button>
            )}
            {state.status === "connected" && queue?.paused && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => runAction("resume_queue")}
              >
                Resume queue
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
