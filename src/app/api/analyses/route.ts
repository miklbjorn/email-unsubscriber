import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listAnalyses } from "@/lib/db";
import { getSessionEmail } from "@/lib/session";

export async function GET(request: NextRequest) {
  const userEmail = await getSessionEmail(request);
  if (!userEmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { env } = await getCloudflareContext();
  const db = (env as unknown as Record<string, unknown>).DB as D1Database | undefined;
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const analyses = await listAnalyses(db, userEmail);
  return NextResponse.json(analyses);
}
