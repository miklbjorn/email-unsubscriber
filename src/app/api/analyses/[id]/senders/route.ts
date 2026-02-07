import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { markSenderClicked } from "@/lib/db";

export async function PATCH(
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

  const body = (await request.json()) as { senderEmail?: string };
  if (!body.senderEmail) {
    return NextResponse.json({ error: "senderEmail is required" }, { status: 400 });
  }

  const { id } = await params;
  const updated = await markSenderClicked(db, id, body.senderEmail, userEmail);

  if (!updated) {
    return NextResponse.json({ error: "Not found or already clicked" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
