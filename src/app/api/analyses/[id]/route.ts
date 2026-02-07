import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAnalysis } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userEmail = request.cookies.get("user_email")?.value;
  if (!userEmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { env } = await getCloudflareContext();
  const db = (env as unknown as Record<string, unknown>).DB as D1Database | undefined;
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id } = await params;
  const analysis = await getAnalysis(db, id, userEmail);

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return NextResponse.json(analysis);
}
