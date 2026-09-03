import { NextResponse } from "next/server";
import { requireMinimumRole, canUseWhatsApp } from "@/lib/auth/permissions";
import { getWhatsAppSessionManager } from "@/lib/whatsapp/session-manager";
import { getWhatsAppSendQueue } from "@/lib/whatsapp/send-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const allowed = await canUseWhatsApp();
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const manager = getWhatsAppSessionManager();
  const queue = getWhatsAppSendQueue();
  await manager.resumeIfSaved();
  await queue.hydrateFromDatabase();
  if (manager.isConnected()) {
    queue.ensureWorker();
  }

  return NextResponse.json({
    ...manager.getState(),
    queue: queue.getStats(),
  });
}

export async function POST(request: Request) {
  try {
    await requireMinimumRole("MANAGER");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const manager = getWhatsAppSessionManager();
  const queue = getWhatsAppSendQueue();
  const action = body.action ?? "start";

  if (action === "logout") {
    queue.setPaused(true);
    const state = await manager.logout();
    return NextResponse.json({ ...state, queue: queue.getStats() });
  }

  if (action === "start") {
    queue.setPaused(false);
    const state = await manager.start();
    return NextResponse.json({ ...state, queue: queue.getStats() });
  }

  if (action === "pause_queue") {
    queue.setPaused(true);
    return NextResponse.json({ ...manager.getState(), queue: queue.getStats() });
  }

  if (action === "resume_queue") {
    queue.setPaused(false);
    return NextResponse.json({ ...manager.getState(), queue: queue.getStats() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
