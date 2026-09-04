"use client";

import { useState, useTransition } from "react";
import { openDrawer } from "@/lib/actions/queue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Banknote, Loader2 } from "lucide-react";

type OpenDrawerButtonProps = {
  hasDrawer?: boolean;
  source?: string;
  className?: string;
};

export function OpenDrawerButton({
  hasDrawer = true,
  source = "pos",
  className,
}: OpenDrawerButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );

  function handleOpen() {
    setMessage(null);
    startTransition(async () => {
      const result = await openDrawer(source);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "Drawer open signal sent" });
      window.setTimeout(() => setMessage(null), 2500);
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        disabled={pending || !hasDrawer}
        title={
          hasDrawer
            ? "Open cash drawer (via drawer device or receipt printer kick port)"
            : "Register a Cash drawer or Printer under Devices, then run the device agent"
        }
        onClick={handleOpen}
      >
        {pending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Banknote className="mr-2 size-4" />
        )}
        {pending ? "Opening…" : "Open drawer"}
      </Button>
      {!hasDrawer && (
        <p className="text-xs text-muted-foreground">
          Register a drawer or printer under Devices
        </p>
      )}
      {message && (
        <p
          className={cn(
            "text-xs",
            message.type === "error" ? "text-destructive" : "text-green-600"
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
