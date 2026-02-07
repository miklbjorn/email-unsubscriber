# Email Unsubscriber — Docs

## Overview
A single-page app that scans a Gmail inbox for bulk/newsletter emails and presents all unsubscribe links in one place. Built on Cloudflare Workers (Next.js via OpenNext).

## Architecture
```
Browser                          Cloudflare Worker (Next.js)
┌──────────────────────┐        ┌──────────────────────────────┐
│ React SPA            │        │ Next.js API routes           │
│ - OAuth flow trigger │───────▶│ - GET /api/auth/callback     │──▶ Google OAuth
│ - Results display    │◀───────│   (exchanges code for token, │
│                      │        │    runs analysis, returns    │
│                      │        │    results — token never     │
│                      │        │    sent to browser)          │
│                      │◀──────▶│ - GET /api/analyses          │──▶ D1
└──────────────────────┘        └──────────────────────────────┘
```

## Auth flow
1. User clicks "Sign in with Google" → hits `GET /api/auth/login`
2. Server generates PKCE code_verifier/challenge, stores verifier in httpOnly cookie
3. Server redirects to Google consent screen (scope: `gmail.readonly`, PKCE S256)
4. Google redirects back to `GET /api/auth/callback` with auth code
5. Server reads PKCE verifier from cookie, exchanges code for access token using client secret
6. Server runs Gmail analysis with the token, then discards it
7. Results returned to browser — token never leaves the server

### Key files
- `src/lib/oauth.ts` — PKCE helpers, auth URL builder, token exchange
- `src/app/api/auth/login/route.ts` — initiates OAuth, sets cookies, redirects to Google
- `src/app/api/auth/callback/route.ts` — validates state, exchanges code, triggers analysis

## Analysis flow
1. Server calls `gmail.users.messages.list` with date filters (paginated)
2. Server calls `gmail.users.messages.get` for each message (metadata only, parallelized)
3. Server filters messages with `List-Unsubscribe` header, groups by sender
4. Results returned to client for display
5. Results saved to D1 for history

## Key headers used
- `From` — sender identification
- `List-Unsubscribe` — unsubscribe URL or mailto link (RFC 2369)
- `List-Unsubscribe-Post` — indicates one-click unsubscribe support (RFC 8058)
