import { SYNCOPS } from "@/lib/print/syncops";

type SyncOpsCreditProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function SyncOpsCredit({ className = "", variant = "dark" }: SyncOpsCreditProps) {
  const colors =
    variant === "light"
      ? "text-stone-400 hover:text-stone-600"
      : "text-stone-500 hover:text-stone-300";

  return (
    <p className={`text-xs ${colors} ${className}`}>
      {SYNCOPS.label} ·{" "}
      <a href={`tel:${SYNCOPS.phone.replace(/\s/g, "")}`} className="underline-offset-2 hover:underline">
        {SYNCOPS.phone}
      </a>
      {" · "}
      <a
        href={SYNCOPS.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        syncops.tech
      </a>
    </p>
  );
}
