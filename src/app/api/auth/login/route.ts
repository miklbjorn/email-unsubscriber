import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateCodeVerifier, generateCodeChallenge, buildAuthUrl } from "@/lib/oauth";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext();
  const clientId = (env as unknown as Record<string, string>).GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const after = url.searchParams.get("after") ?? "";
  const before = url.searchParams.get("before") ?? "";

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  const authUrl = buildAuthUrl({ clientId, redirectUri, codeChallenge, state });

  const response = NextResponse.redirect(authUrl);

  const isSecure = url.protocol === "https:";
  const cookieOpts = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set("pkce_code_verifier", codeVerifier, cookieOpts);
  response.cookies.set("oauth_state", state, cookieOpts);
  response.cookies.set("analysis_after", after, cookieOpts);
  response.cookies.set("analysis_before", before, cookieOpts);

  return response;
}
