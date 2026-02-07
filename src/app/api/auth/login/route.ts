import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateCodeVerifier, generateCodeChallenge, buildAuthUrl } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext();
  const clientId = (env as unknown as Record<string, string>).GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  const authUrl = buildAuthUrl({ clientId, redirectUri, codeChallenge, state });

  const response = NextResponse.redirect(authUrl);

  const isSecure = new URL(request.url).protocol === "https:";

  response.cookies.set("pkce_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
