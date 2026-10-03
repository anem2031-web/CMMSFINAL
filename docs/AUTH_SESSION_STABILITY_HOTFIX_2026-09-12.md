# Auth Session Stability Hotfix — 2026-09-12

## Why this hotfix exists

During PM V2 Phase 2 manual acceptance, the application began presenting repeated logout/login behavior. Inspection found a cross-cutting authentication weakness outside PM V2: `createContext()` collapsed every `sdk.authenticateRequest()` failure into `user = null`. A transient DB/OAuth dependency error could therefore become the same `UNAUTHORIZED` response used for a genuinely missing/invalid session, and the client globally redirected to `/login`.

The session token itself remains long-lived (one year); this hotfix does not shorten or extend session duration.

## Changes

- Added a typed `SessionAuthenticationError` for definitive session failures only.
- DB/OAuth dependency failures are no longer converted into a fake authentication failure.
- tRPC context records dependency authentication failure separately.
- Protected procedures return a retryable server error for dependency failure instead of `UNAUTHORIZED`.
- `auth.me` also surfaces the dependency failure instead of returning false `null`.
- The global client redirect now requires both the canonical `UNAUTHORIZED` tRPC code and canonical unauthenticated message.
- `useAuth` does not redirect while `auth.me` itself has errored.
- `DashboardLayout` shows a small retry state instead of the Login screen when session verification is temporarily unavailable.
- Protected non-tRPC HTTP/export routes return HTTP 503 for dependency authentication failures instead of 401.
- Removed `lastSignedIn` writes from every authenticated API request. It remains updated by the actual local login and OAuth callback flows.

## Safety / scope

- Cross-cutting authentication hotfix; not PM V2 business logic.
- No database schema change.
- No SQL.
- No cookie/session-duration change.
- No role/permission expansion.
- No Phase 3 work.

## Automated regression

Run:

```bash
node server/tests/auth-session-stability.node.mjs
```

Expected: `Auth session stability hotfix regression: PASS`.

The changed TS/TSX files also pass isolated TypeScript syntax transpilation.

## Manual acceptance

One test only: stay signed in and use the application normally across multiple PM V2 tab changes/refreshes. Expected: no spontaneous jump to Login. If a temporary authentication dependency failure occurs, the application should show `تعذر التحقق من الجلسة مؤقتًا` with `إعادة المحاولة` rather than treating it as logout.
