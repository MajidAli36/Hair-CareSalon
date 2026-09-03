import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("organizations").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { status: "degraded", db: "error", timestamp: new Date().toISOString() },
        { status: 503 }
      );
    }
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "unconfigured", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
