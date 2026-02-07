import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { exchangeCodeForToken } from "@/lib/oauth";

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

    // Token obtained successfully. In future issues (3-5), this is where
    // Gmail analysis will run server-side using tokenData.access_token.
    // The token is never sent to the client.
    void tokenData;

    const response = NextResponse.redirect(`${origin}?auth=success`);

    // Clear OAuth cookies
    response.cookies.delete("pkce_code_verifier");
    response.cookies.delete("oauth_state");

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    return NextResponse.redirect(`${origin}?error=${encodeURIComponent(message)}`);
  }
}
