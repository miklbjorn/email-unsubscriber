# ADR 004: HMAC-signed session cookie

## Decision
Sign the session cookie with HMAC-SHA256 using `GOOGLE_CLIENT_SECRET` as the key. The cookie value is `base64(hmac) + "." + email`. API routes verify the signature before trusting the user identity.

## Context
The previous implementation stored the user email in a plain httpOnly cookie. While httpOnly prevents JS access, a user could still edit the cookie value in their browser to impersonate another user and view their analysis history.

## Approach
- `src/lib/session.ts` provides `createSessionValue` (sign) and `getSessionEmail` (verify) helpers
- Uses Web Crypto `HMAC` with `SHA-256` — available in both Cloudflare Workers and Node.js
- `GOOGLE_CLIENT_SECRET` is reused as the signing key (already a server-side secret, never committed)
- Cookie renamed from `user_email` to `session` to avoid confusion with the old unsigned format

## Alternatives considered
- **Cloudflare Access JWT**: Production-only, no local dev support without extra setup.
- **Separate signing secret**: Extra env var for no real benefit — client secret is already a strong secret.
- **Encrypted cookie**: Signing is sufficient here — the email address isn't sensitive, we just need tamper-proofing.

## Consequences
- Existing unsigned `user_email` cookies from before this change will be silently rejected (user re-authenticates on next analysis).
- If `GOOGLE_CLIENT_SECRET` rotates, all sessions are invalidated (acceptable — users just re-auth).
