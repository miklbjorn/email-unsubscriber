import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { exchangeCodeForToken } from "@/lib/oauth";
import { fetchMessageIds, fetchAllMessageHeaders } from "@/lib/gmail";

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

    // Fetch message IDs from Gmail for the date range
    const messageIds = await fetchMessageIds(
      tokenData.access_token,
      after,
      before,
    );

    // Fetch headers for all messages (concurrency-limited)
    const messageHeaders = await fetchAllMessageHeaders(
      tokenData.access_token,
      messageIds,
    );

    // In future issues (5-6), headers will be analyzed and results displayed.
    // For now, redirect with counts.
    const unsubscribableCount = messageHeaders.filter(
      (h) => h.listUnsubscribe !== null,
    ).length;

    const resultParams = new URLSearchParams({
      auth: "success",
      totalMessages: String(messageIds.length),
      unsubscribable: String(unsubscribableCount),
    });

    const response = NextResponse.redirect(`${origin}?${resultParams}`);

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
