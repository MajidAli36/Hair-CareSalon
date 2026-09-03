import fs from "fs/promises";
import path from "path";
import pino from "pino";
import type { WASocket } from "@whiskeysockets/baileys";
import type { WhatsAppLinkState, WhatsAppLinkStatus } from "@/lib/whatsapp/session-types";

export type { WhatsAppLinkState, WhatsAppLinkStatus } from "@/lib/whatsapp/session-types";

type BaileysModule = typeof import("@whiskeysockets/baileys");

const AUTH_DIR = path.join(process.cwd(), ".whatsapp-session");
const logger = pino({ level: "silent" });

async function hasSavedSession(): Promise<boolean> {
  try {
    await fs.access(path.join(AUTH_DIR, "creds.json"));
    return true;
  } catch {
    return false;
  }
}

class WhatsAppSessionManager {
  private sock: WASocket | null = null;
  private status: WhatsAppLinkStatus = "idle";
  private qr: string | null = null;
  private phone: string | null = null;
  private error: string | null = null;
  private starting = false;
  private shouldReconnect = true;
  private baileys: BaileysModule | null = null;

  getState(): WhatsAppLinkState {
    return {
      status: this.status,
      qr: this.qr,
      phone: this.phone,
      error: this.error,
    };
  }

  isConnected(): boolean {
    return this.status === "connected" && !!this.sock;
  }

  private async loadBaileys(): Promise<BaileysModule> {
    if (!this.baileys) {
      this.baileys = await import("@whiskeysockets/baileys");
    }
    return this.baileys;
  }

  /** Resume only if local session files exist (after server restart). */
  async resumeIfSaved(): Promise<WhatsAppLinkState> {
    if (this.status !== "idle" || this.starting) {
      return this.getState();
    }
    if (!(await hasSavedSession())) {
      return this.getState();
    }
    return this.start();
  }

  async start(): Promise<WhatsAppLinkState> {
    if (this.status === "connected" && this.sock) {
      return this.getState();
    }
    if (this.starting) {
      return this.getState();
    }

    this.starting = true;
    this.shouldReconnect = true;
    this.error = null;

    try {
      await this.openSocket();
    } catch (err) {
      this.status = "idle";
      this.error = err instanceof Error ? err.message : "Failed to start WhatsApp link";
      this.sock = null;
    } finally {
      this.starting = false;
    }

    return this.getState();
  }

  private async openSocket() {
    const baileys = await this.loadBaileys();
    await fs.mkdir(AUTH_DIR, { recursive: true });

    const { state, saveCreds } = await baileys.useMultiFileAuthState(AUTH_DIR);
    const { version } = await baileys.fetchLatestBaileysVersion();

    this.status = this.status === "connected" ? "connected" : "connecting";
    this.qr = null;

    const sock = baileys.default({
      version,
      auth: {
        creds: state.creds,
        keys: baileys.makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });

    this.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = qr;
        this.status = "qr";
        this.error = null;
      }

      if (connection === "open") {
        this.status = "connected";
        this.qr = null;
        this.error = null;
        const rawId = sock.user?.id ?? "";
        this.phone = rawId.split(":")[0] || rawId.split("@")[0] || null;
      }

      if (connection === "close") {
        const boom = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const code = boom?.output?.statusCode;
        const loggedOut = code === baileys.DisconnectReason.loggedOut;

        this.sock = null;
        this.phone = null;
        this.qr = null;
        this.status = "idle";

        if (loggedOut) {
          this.shouldReconnect = false;
          this.error = "WhatsApp was logged out on the phone. Scan the QR again to reconnect.";
          void this.clearAuthDir();
          return;
        }

        if (this.shouldReconnect) {
          this.status = "connecting";
          this.error = "Connection lost — reconnecting…";
          setTimeout(() => {
            void this.openSocket().catch((err) => {
              this.status = "idle";
              this.error = err instanceof Error ? err.message : "Reconnect failed";
            });
          }, 2500);
        }
      }
    });
  }

  async logout(): Promise<WhatsAppLinkState> {
    this.shouldReconnect = false;
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch {
      // Session may already be dead — still clear local auth.
    }

    this.sock = null;
    this.qr = null;
    this.phone = null;
    this.status = "idle";
    this.error = null;
    await this.clearAuthDir();
    return this.getState();
  }

  async sendText(normalizedPhone: string, text: string): Promise<{ messageId?: string }> {
    if (!this.sock || this.status !== "connected") {
      throw new Error("Salon WhatsApp is not linked. Scan the QR code first.");
    }

    const jid = `${normalizedPhone}@s.whatsapp.net`;

    try {
      const results = await this.sock.onWhatsApp(normalizedPhone);
      const exists = results?.[0]?.exists;
      if (exists === false) {
        throw new Error("That phone number is not registered on WhatsApp.");
      }
      const resolvedJid = results?.[0]?.jid ?? jid;
      const sent = await this.sock.sendMessage(resolvedJid, { text });
      return { messageId: sent?.key?.id ?? undefined };
    } catch (err) {
      if (err instanceof Error && err.message.includes("not registered")) {
        throw err;
      }
      const sent = await this.sock.sendMessage(jid, { text });
      return { messageId: sent?.key?.id ?? undefined };
    }
  }

  private async clearAuthDir() {
    try {
      await fs.rm(AUTH_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

const globalForWa = globalThis as unknown as {
  __salonWhatsAppManager?: WhatsAppSessionManager;
};

export function getWhatsAppSessionManager(): WhatsAppSessionManager {
  if (!globalForWa.__salonWhatsAppManager) {
    globalForWa.__salonWhatsAppManager = new WhatsAppSessionManager();
  }
  return globalForWa.__salonWhatsAppManager;
}
