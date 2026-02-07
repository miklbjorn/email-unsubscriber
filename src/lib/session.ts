import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "session";

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Create a signed session value: base64(hmac) + "." + email
 */
export async function createSessionValue(
  email: string,
  secret: string,
): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(email),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${sigB64}.${email}`;
}

/**
 * Verify a signed session value and return the email, or null if invalid.
 */
async function verifySessionValue(
  signed: string,
  secret: string,
): Promise<string | null> {
  const dotIndex = signed.indexOf(".");
  if (dotIndex === -1) return null;

  const sigB64 = signed.slice(0, dotIndex);
  const email = signed.slice(dotIndex + 1);

  let sigBuffer: ArrayBuffer;
  try {
    const raw = atob(sigB64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    sigBuffer = bytes.buffer as ArrayBuffer;
  } catch {
    return null;
  }

  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBuffer,
    new TextEncoder().encode(email),
  );

  return valid ? email : null;
}

/**
 * Extract and verify the user email from the signed session cookie.
 * Returns the email if valid, null otherwise.
 */
export async function getSessionEmail(
  request: NextRequest,
): Promise<string | null> {
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  const { env } = await getCloudflareContext();
  const secret = (env as unknown as Record<string, string>)
    .GOOGLE_CLIENT_SECRET;
  if (!secret) return null;

  return verifySessionValue(cookie, secret);
}

export { COOKIE_NAME };
