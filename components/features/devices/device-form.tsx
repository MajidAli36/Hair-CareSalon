"use client";

import { useActionState } from "react";
import { registerDevice } from "@/lib/actions/devices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/commerce";

export function DeviceRegisterForm() {
  const [state, formAction, pending] = useActionState(registerDevice, {} as ActionResult & { apiKey?: string });

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="d_name">Device name *</Label>
        <Input id="d_name" name="name" required placeholder="Front desk printer" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="d_type">Type *</Label>
        <select id="d_type" name="type" required className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
          <option value="ATTENDANCE">Attendance terminal</option>
          <option value="DRAWER">Cash drawer</option>
          <option value="PRINTER">Receipt printer</option>
          <option value="TOKEN_KIOSK">Token kiosk</option>
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="d_location">Location</Label>
        <Input id="d_location" name="location" placeholder="Reception" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>Register device</Button>
      </div>
      {state.apiKey && (
        <div className="sm:col-span-2 rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">API Key (save now — shown once):</p>
          <code className="break-all">{state.apiKey}</code>
          <p className="mt-2 text-muted-foreground">Use header: <code>X-Device-Key: …</code></p>
        </div>
      )}
    </form>
  );
}
