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
│                      │        │    runs analysis, saves to   │
│                      │        │    D1 — token never sent     │
│                      │        │    to browser)               │
│                      │◀──────▶│ - GET /api/analyses          │──▶ D1
└──────────────────────┘        └──────────────────────────────┘
```

## Auth flow
1. User picks a date range (default: last 30 days) and clicks "Analyze Inbox"
2. `GET /api/auth/login?after=...&before=...` — stores PKCE verifier + date range in httpOnly cookies, redirects to Google consent screen
3. Google redirects back to `GET /api/auth/callback` with auth code
4. Server validates state, exchanges code for access token, reads date range from cookies
5. Server fetches all message IDs from Gmail for the date range (paginated)
6. Server runs analysis with the token, then discards it
7. Analysis is saved to D1 and the user is redirected with `analysis_id`
8. Browser fetches `/api/analyses/:id` and renders results — token never leaves the server

### Key files
- `src/lib/oauth.ts` — PKCE helpers, auth URL builder, token exchange
- `src/lib/gmail.ts` — Gmail API utilities (message list fetching with pagination, header fetching with concurrency control, user profile)
- `src/lib/analysis.ts` — analysis logic: From/List-Unsubscribe header parsing, sender grouping, stats computation
- `src/lib/db.ts` — D1 database operations: save, list, and get analyses (user-scoped)
- `src/lib/session.ts` — HMAC-signed session cookie: create, verify, extract user email
- `src/app/api/auth/login/route.ts` — initiates OAuth, sets cookies (PKCE + date range), redirects to Google
- `src/app/api/auth/callback/route.ts` — validates state, exchanges code, fetches messages, runs analysis, saves to D1, sets user session
- `src/app/api/analyses/route.ts` — list past analyses for the authenticated user
- `src/app/api/analyses/[id]/route.ts` — get a single analysis with senders
- `src/app/analyze-form.tsx` — client component with date range picker
- `src/app/analysis-results.tsx` — client component: overview stats, sortable sender list, unsubscribe links
- `src/app/analysis-by-id.tsx` — client component: fetches analysis by id and renders results
- `src/app/analysis-history.tsx` — client component: fetches and displays past analyses list
- `src/app/history-page.tsx` — client component: orchestrates history list and detail view

## Analysis flow
1. Server calls `gmail.users.messages.list` with date filters (paginated)
2. Server calls `gmail.users.messages.get` for each message (metadata only, parallelized)
3. Server filters messages with `List-Unsubscribe` header, groups by sender
4. Results saved to D1
5. Client fetches analysis by id for display

## History
- Each analysis is saved to D1 during the OAuth callback before redirecting
- User email fetched from Gmail profile API during callback, stored in HMAC-signed httpOnly session cookie (see ADR 004)
- History API routes verify the cookie signature before trusting user identity — users can only see their own analyses
- D1 tables: `analyses` (metadata) and `analysis_senders` (per-sender rows)
- Migration: `migrations/0001_create_tables.sql`

## Key headers used
- `From` — sender identification
- `List-Unsubscribe` — unsubscribe URL or mailto link (RFC 2369)
- `List-Unsubscribe-Post` — indicates one-click unsubscribe support (RFC 8058)
