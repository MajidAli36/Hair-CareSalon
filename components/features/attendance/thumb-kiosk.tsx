"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { attendanceMethodLabel } from "@/lib/attendance/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { ArrowLeft, Fingerprint, Loader2, LogIn, LogOut, Settings2 } from "lucide-react";

type RecentRecord = {
  id: string;
  staffId: string | null;
  staffName: string;
  method: string;
  checkInAt: string;
  checkOutAt: string | null;
  onDuty: boolean;
};

type RecentFeed = {
  device: { id: string; name: string };
  date: string;
  onDutyCount: number;
  onDuty: RecentRecord[];
  records: RecentRecord[];
};

type ScanFlash = {
  staffName: string;
  action: "check_in" | "check_out";
  at: string;
};

const STORAGE_KEY = "salon-attendance-device-key";
/** Ignore accidental double-scans from the same thumb within this window. */
const SCAN_DEBOUNCE_MS = 2500;

function readInitialDeviceKey() {
  if (typeof window === "undefined") {
    return { key: null as string | null, setupOpen: true };
  }
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("key");
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  const key = fromUrl || fromStorage || "";
  if (fromUrl) localStorage.setItem(STORAGE_KEY, fromUrl);
  return { key: key || null, setupOpen: !key };
}

export function ThumbAttendanceKiosk() {
  const [initial] = useState(readInitialDeviceKey);
  const [deviceKey, setDeviceKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(initial.key);
  const [feed, setFeed] = useState<RecentFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<ScanFlash | null>(null);
  const [setupOpen, setSetupOpen] = useState(initial.setupOpen);
  const [scanPending, startScanTransition] = useTransition();
  const lastRecordIdRef = useRef<string | null>(null);
  const lastScanRef = useRef<{ thumbId: string; at: number } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const loadFeed = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/devices/attendance/recent?limit=12", {
        headers: { "X-Device-Key": key },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not connect to attendance device");
      }
      const data = (await res.json()) as RecentFeed;
      setFeed(data);
      setError(null);

      const latest = data.records[0];
      if (latest && latest.id !== lastRecordIdRef.current) {
        if (lastRecordIdRef.current) {
          setFlash({
            staffName: latest.staffName,
            action: latest.onDuty ? "check_in" : "check_out",
            at: latest.onDuty ? latest.checkInAt : (latest.checkOutAt ?? latest.checkInAt),
          });
        }
        lastRecordIdRef.current = latest.id;
      }

      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      return null;
    }
  }, []);

  const submitThumbScan = useCallback(
    (raw: string) => {
      const thumbId = raw.trim();
      if (!thumbId || !savedKey) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.thumbId === thumbId && now - last.at < SCAN_DEBOUNCE_MS) {
        return;
      }
      lastScanRef.current = { thumbId, at: now };

      startScanTransition(async () => {
        setError(null);
        try {
          const res = await fetch("/api/devices/attendance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Device-Key": savedKey,
            },
            body: JSON.stringify({ thumbId, action: "toggle" }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            ok?: boolean;
            staffName?: string;
            action?: "check_in" | "check_out";
            at?: string;
          };
          if (!res.ok) {
            throw new Error(body.error ?? "Scan failed");
          }
          if (body.ok && body.staffName && body.action && body.at) {
            setFlash({
              staffName: body.staffName,
              action: body.action,
              at: body.at,
            });
          }
          await loadFeed(savedKey);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Scan failed");
        } finally {
          scanInputRef.current?.focus();
        }
      });
    },
    [savedKey, loadFeed]
  );

  useEffect(() => {
    if (!savedKey) return;
    let cancelled = false;

    async function poll() {
      const data = await loadFeed(savedKey!);
      if (cancelled || !data) return;
    }

    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [savedKey, loadFeed]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Keep an invisible field focused so USB “keyboard wedge” scanners can type the thumb ID.
  useEffect(() => {
    if (!savedKey || setupOpen) return;
    const focus = () => scanInputRef.current?.focus();
    focus();
    const timer = setInterval(focus, 2000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") focus();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [savedKey, setupOpen]);

  function saveKey() {
    const trimmed = deviceKey.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setSavedKey(trimmed);
    setSetupOpen(false);
    setError(null);
  }

  function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
    setSavedKey(null);
    setFeed(null);
    setSetupOpen(true);
  }

  if (setupOpen || !savedKey) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 p-6 text-white">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="text-center">
            <Fingerprint className="mx-auto size-12 text-teal-400" />
            <h1 className="mt-4 text-2xl font-semibold">Thumb attendance kiosk</h1>
            <p className="mt-2 text-sm text-white/60">
              Connect your biometric terminal. Paste the device API key from Devices → Attendance
              terminal.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-key" className="text-white/80">
              Device API key
            </Label>
            <Input
              id="device-key"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
              placeholder="Paste X-Device-Key value"
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button className="w-full" onClick={saveKey}>
            Start kiosk
          </Button>
          <Button variant="ghost" className="w-full text-white/70" render={<Link href="/attendance" />}>
            <ArrowLeft className="mr-2 size-4" />
            Back to attendance
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Hidden capture field for USB scanners that type like a keyboard */}
      <input
        ref={scanInputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Fingerprint scanner input"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const value = e.currentTarget.value;
          e.currentTarget.value = "";
          submitThumbScan(value);
        }}
      />

      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-teal-400/80">Salon attendance</p>
          <h1 className="text-lg font-semibold">{feed?.device.name ?? "Thumb scanner"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {scanPending && <Loader2 className="size-4 animate-spin text-teal-300" />}
          <Badge variant="secondary" className="bg-teal-500/20 text-teal-100">
            {feed?.onDutyCount ?? 0} on duty
          </Badge>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-white/70"
            onClick={() => setSetupOpen(true)}
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {flash ? (
          <div
            className={cn(
              "animate-in fade-in zoom-in-95 text-center duration-300",
              flash.action === "check_in" ? "text-teal-300" : "text-amber-300"
            )}
          >
            {flash.action === "check_in" ? (
              <LogIn className="mx-auto size-20" />
            ) : (
              <LogOut className="mx-auto size-20" />
            )}
            <p className="mt-4 text-3xl font-bold">{flash.staffName}</p>
            <p className="mt-2 text-lg">
              {flash.action === "check_in" ? "Checked in" : "Checked out"}
            </p>
            <p className="mt-1 text-sm text-white/50">{formatTime(flash.at)}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="relative mx-auto size-40">
              <div className="absolute inset-0 animate-pulse rounded-full bg-teal-500/20" />
              <div className="absolute inset-4 rounded-full border-2 border-teal-400/40" />
              <Fingerprint className="absolute inset-0 m-auto size-20 text-teal-400" />
            </div>
            <h2 className="mt-8 text-2xl font-semibold">Place your thumb on the scanner</h2>
            <p className="mt-2 max-w-sm text-white/60">
              Scan once to check in, scan again when leaving. USB scanners that type an ID work
              here; SDK scanners can use the device agent bridge.
            </p>
          </div>
        )}
        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
      </main>

      <section className="border-t border-white/10 px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <h3 className="mb-3 text-sm font-medium text-white/70">Today&apos;s activity</h3>
          {feed?.records.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {feed.records.map((r) => (
                <Card key={r.id} className="border-white/10 bg-white/5 text-white">
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{r.staffName}</p>
                      <p className="text-xs text-white/50">
                        {formatTime(r.checkInAt)}
                        {r.checkOutAt && ` → ${formatTime(r.checkOutAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.onDuty ? (
                        <Badge className="bg-teal-600">On duty</Badge>
                      ) : (
                        <Badge variant="outline" className="border-white/20 text-white/70">
                          Done
                        </Badge>
                      )}
                      <span className="text-[10px] text-white/40">
                        {attendanceMethodLabel(r.method)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">No scans yet today.</p>
          )}
        </div>
      </section>

      {setupOpen && savedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-slate-900 p-6">
            <h3 className="font-semibold">Kiosk settings</h3>
            <div className="space-y-2">
              <Label>Device API key</Label>
              <Input
                value={deviceKey || savedKey}
                onChange={(e) => setDeviceKey(e.target.value)}
                className="border-white/20 bg-white/10 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveKey}>Save</Button>
              <Button variant="outline" onClick={() => setSetupOpen(false)}>
                Cancel
              </Button>
              <Button variant="ghost" onClick={clearKey}>
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
