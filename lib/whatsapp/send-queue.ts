import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppSessionManager } from "@/lib/whatsapp/session-manager";

/** Randomized delay between outbound sends (account safety). */
export const SEND_GAP_MIN_MS = 10_000;
export const SEND_GAP_MAX_MS = 15_000;

/** Hard caps to reduce ban risk. */
export const MAX_QUEUE_SIZE = 500;
export const MAX_SENDS_PER_HOUR = 180;
export const MAX_SENDS_PER_DAY = 800;
/** Same customer number cannot be messaged again within this window. */
export const SAME_PHONE_COOLDOWN_MS = 60_000;

export type QueuedSendJob = {
  id: string;
  organizationId: string;
  normalizedPhone: string;
  body: string;
};

export type WhatsAppQueueStats = {
  pending: number;
  processing: boolean;
  paused: boolean;
  lastSendAt: string | null;
  nextGapSeconds: number | null;
  estimatedWaitSeconds: number;
  gapSeconds: [number, number];
  sendsLastHour: number;
  sendsToday: number;
  limits: {
    maxQueue: number;
    maxPerHour: number;
    maxPerDay: number;
    samePhoneCooldownSeconds: number;
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomGapMs() {
  return (
    SEND_GAP_MIN_MS + Math.floor(Math.random() * (SEND_GAP_MAX_MS - SEND_GAP_MIN_MS + 1))
  );
}

function startOfLocalDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

class WhatsAppSendQueue {
  private queue: QueuedSendJob[] = [];
  private queuedIds = new Set<string>();
  private running = false;
  private paused = false;
  private lastSendAt = 0;
  private lastPhoneAt = new Map<string, number>();
  private sendTimestamps: number[] = [];
  private hydrated = false;
  private nextGapMs: number | null = null;
  /** In-memory status so UI updates even if DB write is delayed / blocked by RLS */
  private statusOverrides = new Map<string, "SENT" | "FAILED">();

  getStatusOverrides(): Record<string, { status: "SENT" | "FAILED" }> {
    const out: Record<string, { status: "SENT" | "FAILED" }> = {};
    for (const [id, status] of this.statusOverrides) {
      out[id] = { status };
    }
    return out;
  }

  getStats(): WhatsAppQueueStats {
    const now = Date.now();
    this.pruneTimestamps(now);
    const pending = this.queue.length;
    const avgGap = (SEND_GAP_MIN_MS + SEND_GAP_MAX_MS) / 2;
    // First message also waits a full gap; later ones wait from lastSendAt
    const sinceLast = this.lastSendAt
      ? Math.max(0, avgGap - (now - this.lastSendAt))
      : pending > 0
        ? avgGap
        : 0;
    const estimatedWaitSeconds = Math.round(
      (sinceLast + Math.max(0, pending - 1) * avgGap) / 1000
    );

    return {
      pending,
      processing: this.running,
      paused: this.paused,
      lastSendAt: this.lastSendAt ? new Date(this.lastSendAt).toISOString() : null,
      nextGapSeconds: this.nextGapMs != null ? Math.round(this.nextGapMs / 1000) : null,
      estimatedWaitSeconds,
      gapSeconds: [SEND_GAP_MIN_MS / 1000, SEND_GAP_MAX_MS / 1000],
      sendsLastHour: this.sendTimestamps.filter((t) => now - t < 3_600_000).length,
      sendsToday: this.sendTimestamps.filter((t) => t >= startOfLocalDay()).length,
      limits: {
        maxQueue: MAX_QUEUE_SIZE,
        maxPerHour: MAX_SENDS_PER_HOUR,
        maxPerDay: MAX_SENDS_PER_DAY,
        samePhoneCooldownSeconds: SAME_PHONE_COOLDOWN_MS / 1000,
      },
    };
  }

  private pruneTimestamps(now = Date.now()) {
    const dayStart = startOfLocalDay();
    this.sendTimestamps = this.sendTimestamps.filter((t) => t >= dayStart || now - t < 3_600_000);
  }

  private assertRateLimits(normalizedPhone: string) {
    const now = Date.now();
    this.pruneTimestamps(now);

    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error(
        `Send queue is full (${MAX_QUEUE_SIZE}). Wait for messages to deliver, then try again.`
      );
    }

    const hourCount = this.sendTimestamps.filter((t) => now - t < 3_600_000).length;
    if (hourCount >= MAX_SENDS_PER_HOUR) {
      throw new Error(
        `Hourly safety limit reached (${MAX_SENDS_PER_HOUR}/hour). Try again later to protect the WhatsApp account.`
      );
    }

    const dayCount = this.sendTimestamps.filter((t) => t >= startOfLocalDay()).length;
    if (dayCount >= MAX_SENDS_PER_DAY) {
      throw new Error(
        `Daily safety limit reached (${MAX_SENDS_PER_DAY}/day). Resume tomorrow to protect the account.`
      );
    }

    const lastPhone = this.lastPhoneAt.get(normalizedPhone) ?? 0;
    const phoneInQueue = this.queue.some((j) => j.normalizedPhone === normalizedPhone);
    if (phoneInQueue) {
      throw new Error(
        "A message to this number is already queued. Wait until it sends before queueing another."
      );
    }
    if (lastPhone && now - lastPhone < SAME_PHONE_COOLDOWN_MS) {
      const waitSec = Math.ceil((SAME_PHONE_COOLDOWN_MS - (now - lastPhone)) / 1000);
      throw new Error(
        `Same-number cooldown: wait ${waitSec}s before messaging this customer again.`
      );
    }
  }

  async hydrateFromDatabase() {
    if (this.hydrated) return;
    this.hydrated = true;

    const admin = tryCreateAdminClient();
    if (!admin) return;

    const { data } = await admin
      .from("whatsapp_messages")
      .select("id, organization_id, phone, body, metadata, created_at")
      .eq("direction", "OUTBOUND")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(MAX_QUEUE_SIZE);

    for (const row of data ?? []) {
      if (this.queuedIds.has(row.id)) continue;
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const normalized =
        typeof meta.normalized_phone === "string"
          ? meta.normalized_phone
          : row.phone.replace(/\D/g, "");
      if (!normalized || !row.body) continue;

      this.queue.push({
        id: row.id,
        organizationId: row.organization_id,
        normalizedPhone: normalized,
        body: row.body,
      });
      this.queuedIds.add(row.id);
    }

    if (this.queue.length > 0) {
      this.ensureWorker();
    }
  }

  /**
   * Enqueue after the PENDING row is already inserted in DB.
   * Returns 1-based queue position.
   */
  enqueue(job: QueuedSendJob): { position: number; estimatedWaitSeconds: number } {
    this.assertRateLimits(job.normalizedPhone);

    if (this.queuedIds.has(job.id)) {
      const position = this.queue.findIndex((j) => j.id === job.id) + 1;
      return { position: Math.max(1, position), estimatedWaitSeconds: this.getStats().estimatedWaitSeconds };
    }

    this.queue.push(job);
    this.queuedIds.add(job.id);
    this.ensureWorker();

    const stats = this.getStats();
    return {
      position: this.queue.length,
      estimatedWaitSeconds: stats.estimatedWaitSeconds,
    };
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.ensureWorker();
  }

  ensureWorker() {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  private async loop() {
    try {
      while (this.queue.length > 0) {
        if (this.paused) {
          await sleep(2000);
          continue;
        }

        const manager = getWhatsAppSessionManager();
        if (!manager.isConnected()) {
          await sleep(4000);
          continue;
        }

        const job = this.queue[0];
        if (!job) break;

        const gap = randomGapMs();
        this.nextGapMs = gap;
        // Every delivery waits 10–15s (including the first) for account safety
        const wait =
          this.lastSendAt > 0
            ? Math.max(0, this.lastSendAt + gap - Date.now())
            : gap;
        if (wait > 0) {
          await sleep(wait);
        }

        // Re-check after wait
        if (this.paused || !manager.isConnected()) {
          continue;
        }
        if (this.queue[0]?.id !== job.id) {
          continue;
        }

        // Rate-limit check before dequeue (keep jobs PENDING)
        const nowCheck = Date.now();
        this.pruneTimestamps(nowCheck);
        const hourCount = this.sendTimestamps.filter((t) => nowCheck - t < 3_600_000).length;
        const dayCount = this.sendTimestamps.filter((t) => t >= startOfLocalDay()).length;
        if (dayCount >= MAX_SENDS_PER_DAY) {
          this.paused = true;
          this.nextGapMs = null;
          await sleep(60_000);
          continue;
        }
        if (hourCount >= MAX_SENDS_PER_HOUR) {
          this.nextGapMs = null;
          await sleep(60_000);
          continue;
        }

        this.queue.shift();
        this.queuedIds.delete(job.id);
        const usedGapMs = this.nextGapMs;
        this.nextGapMs = null;

        try {
          const result = await manager.sendText(job.normalizedPhone, job.body);
          const now = Date.now();
          this.lastSendAt = now;
          this.lastPhoneAt.set(job.normalizedPhone, now);
          this.sendTimestamps.push(now);
          await this.markSent(job.id, result.messageId, usedGapMs);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Send failed";
          await this.markFailed(job.id, message);
        }
      }
    } finally {
      this.running = false;
      this.nextGapMs = null;
      // New jobs may have arrived while finishing
      if (this.queue.length > 0 && !this.paused) {
        this.ensureWorker();
      }
    }
  }

  private async markSent(id: string, baileysMessageId?: string, gapMs?: number | null) {
    this.statusOverrides.set(id, "SENT");

    const admin = tryCreateAdminClient();
    if (!admin) {
      console.error(
        "[whatsapp-queue] SUPABASE_SERVICE_ROLE_KEY missing — status stays local until key is set"
      );
      return;
    }

    const { data: existing } = await admin
      .from("whatsapp_messages")
      .select("metadata")
      .eq("id", id)
      .maybeSingle();

    const metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      source: "baileys_queue",
      baileys_message_id: baileysMessageId ?? null,
      sent_at: new Date().toISOString(),
      queued: true,
      gap_ms: gapMs ?? null,
    };

    const { error } = await admin
      .from("whatsapp_messages")
      .update({ status: "SENT", metadata })
      .eq("id", id);

    if (error) {
      console.error("[whatsapp-queue] Failed to mark SENT:", error.message);
    }
  }

  private async markFailed(id: string, errorMessage: string) {
    this.statusOverrides.set(id, "FAILED");

    const admin = tryCreateAdminClient();
    if (!admin) {
      console.error(
        "[whatsapp-queue] SUPABASE_SERVICE_ROLE_KEY missing — status stays local until key is set"
      );
      return;
    }

    const { data: existing } = await admin
      .from("whatsapp_messages")
      .select("metadata")
      .eq("id", id)
      .maybeSingle();

    const metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      source: "baileys_queue",
      error: errorMessage,
      failed_at: new Date().toISOString(),
      queued: true,
    };

    const { error } = await admin
      .from("whatsapp_messages")
      .update({ status: "FAILED", metadata })
      .eq("id", id);

    if (error) {
      console.error("[whatsapp-queue] Failed to mark FAILED:", error.message);
    }
  }
}

const globalForQueue = globalThis as unknown as {
  __salonWhatsAppSendQueue?: WhatsAppSendQueue;
};

export function getWhatsAppSendQueue(): WhatsAppSendQueue {
  if (!globalForQueue.__salonWhatsAppSendQueue) {
    globalForQueue.__salonWhatsAppSendQueue = new WhatsAppSendQueue();
  }
  return globalForQueue.__salonWhatsAppSendQueue;
}
