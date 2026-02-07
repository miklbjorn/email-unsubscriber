# ADR 003: User identification for analysis history

## Decision
Use Gmail profile API (`users/me/profile`) to get user email during OAuth callback. Store email in httpOnly session cookie (30-day expiry) for history access.

## Context
Need to associate saved analyses with a specific user so they can only see their own history. The app already has `gmail.readonly` scope which grants access to the profile endpoint — no additional OAuth scope needed.

## Alternatives considered
- **Add `email` OAuth scope**: Extra consent prompt for something we can already get.
- **Cloudflare Access headers**: Would work in production but not in local dev.
- **No user tracking**: Would expose all analyses to all users.

## Consequences
- User must re-authenticate (OAuth) to establish identity; cookie persists for 30 days for history browsing.
- D1 save is best-effort — if DB is unavailable the analysis still works, just isn't persisted.
- **Update**: Cookie is now HMAC-signed to prevent tampering (see ADR 004).
