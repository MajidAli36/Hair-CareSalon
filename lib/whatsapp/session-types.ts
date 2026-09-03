export type WhatsAppLinkStatus = "idle" | "connecting" | "qr" | "connected";

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

export type WhatsAppLinkState = {
  status: WhatsAppLinkStatus;
  qr: string | null;
  phone: string | null;
  error: string | null;
  queue?: WhatsAppQueueStats;
};
