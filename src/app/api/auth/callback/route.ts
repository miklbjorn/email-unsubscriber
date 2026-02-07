import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { exchangeCodeForToken } from "@/lib/oauth";
import { fetchMessageIds, fetchAllMessageHeaders, fetchUserEmail } from "@/lib/gmail";
import { analyzeMessages } from "@/lib/analysis";
import { saveAnalysis } from "@/lib/db";
import { createSessionValue, COOKIE_NAME } from "@/lib/session";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = url.origin;

  // Handle user denial or other OAuth errors
  if (error) {
    return NextResponse.redirect(`${origin}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}?error=missing_code_or_state`);
  }

  // Validate state matches cookie to prevent CSRF
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${origin}?error=invalid_state`);
  }

  // Get PKCE code verifier from cookie
  const codeVerifier = request.cookies.get("pkce_code_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(`${origin}?error=missing_pkce_verifier`);
  }

  // Get date range from cookies
  const after = request.cookies.get("analysis_after")?.value ?? "";
  const before = request.cookies.get("analysis_before")?.value ?? "";

  const { env } = await getCloudflareContext();
  const envRecord = env as unknown as Record<string, string>;
  const clientId = envRecord.GOOGLE_CLIENT_ID;
  const clientSecret = envRecord.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}?error=oauth_not_configured`);
  }

  const redirectUri = `${origin}/api/auth/callback`;

  try {
    const tokenData = await exchangeCodeForToken({
      code,
      codeVerifier,
      redirectUri,
      clientId,
      clientSecret,
    });

    // Fetch user email and message data in parallel
    const [userEmail, messageIds] = await Promise.all([
      fetchUserEmail(tokenData.access_token),
      fetchMessageIds(tokenData.access_token, after, before),
    ]);

    // Fetch headers for all messages (concurrency-limited)
    const messageHeaders = await fetchAllMessageHeaders(
      tokenData.access_token,
      messageIds,
    );

    // Analyze headers: parse, group by sender, compute stats
    const analysis = analyzeMessages(messageHeaders);

    // Save to D1 (best-effort — don't fail the whole request if DB is unavailable)
    const db = (env as unknown as Record<string, unknown>).DB as D1Database | undefined;
    let analysisId: string | null = null;
    if (db) {
      try {
        analysisId = await saveAnalysis(db, {
          userEmail,
          dateRangeStart: after,
          dateRangeEnd: before,
          analysis,
        });
      } catch {
        // DB save failed — continue without saving
      }
    }

    // Encode full analysis as base64 JSON to pass via URL
    const analysisJson = JSON.stringify(analysis);
    const analysisBase64 = btoa(
      String.fromCharCode(...new TextEncoder().encode(analysisJson)),
    );

    const resultParams = new URLSearchParams({
      auth: "success",
      results: analysisBase64,
    });
    if (analysisId) {
      resultParams.set("analysis_id", analysisId);
    }

    const response = NextResponse.redirect(`${origin}?${resultParams}`);

    // Set signed session cookie for history access
    const isSecure = url.protocol === "https:";
    const sessionValue = await createSessionValue(userEmail, clientSecret);
    response.cookies.set(COOKIE_NAME, sessionValue, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Clear all OAuth and analysis cookies
    response.cookies.delete("pkce_code_verifier");
    response.cookies.delete("oauth_state");
    response.cookies.delete("analysis_after");
    response.cookies.delete("analysis_before");

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    return NextResponse.redirect(`${origin}?error=${encodeURIComponent(message)}`);
  }
}
