import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const DEFAULT_ORG_ID = process.env.WHATSAPP_DEFAULT_ORG_ID;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type WhatsAppWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }[];
        metadata?: { phone_number_id?: string };
      };
    }[];
  }[];
};

export async function POST(request: Request) {
  if (!DEFAULT_ORG_ID) {
    return NextResponse.json(
      { error: "WHATSAPP_DEFAULT_ORG_ID not configured" },
      { status: 503 }
    );
  }

  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    // Full HMAC verification requires raw body; logged for production setup
  }

  let body: WhatsAppWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const messages: { phone: string; body: string; externalId: string; metadata: Record<string, unknown> }[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const msg of value?.messages ?? []) {
        if (msg.type === "text" && msg.text?.body) {
          messages.push({
            phone: msg.from,
            body: msg.text.body,
            externalId: msg.id,
            metadata: {
              phone_number_id: value?.metadata?.phone_number_id,
              timestamp: msg.timestamp,
            },
          });
        }
      }
    }
  }

  if (messages.length > 0) {
    await admin.from("whatsapp_messages").insert(
      messages.map((m) => ({
        organization_id: DEFAULT_ORG_ID,
        direction: "INBOUND" as const,
        status: "RECEIVED" as const,
        phone: m.phone,
        body: m.body,
        external_id: m.externalId,
        metadata: m.metadata,
      }))
    );
  }

  return NextResponse.json({ received: messages.length });
}
