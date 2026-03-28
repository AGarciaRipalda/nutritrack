# Security Review Report

Static application security review of the Metabolic project performed on 2026-03-28. This review covers the FastAPI backend in `nutrition_assistant`, the Next.js frontend in `nutrition_frontend`, and the native iOS/Capacitor mobile client code present in the repository. This is a code audit, not a live penetration test.

## Executive Summary

The project has multiple authentication and trust-boundary failures. The most serious issue is a fallback JWT secret hardcoded in the backend; if production ever runs without an explicit secret, an attacker can forge valid bearer tokens. That risk compounds with a second backend issue: token claims are trusted directly without reloading the user from storage, and those claims are then used as filesystem path components in the JSON fallback storage layer without normalization or traversal checks.

The frontend and iOS client currently implement local "demo" sessions instead of real server-backed authentication. That means the user interface can be made to appear logged in without proving identity to the backend. On its own this is a broken auth design; combined with the backend token weaknesses, it materially increases the chance of insecure production wiring.

## Critical

### MBP-001: Insecure default JWT signing key and excessive token lifetime

- Severity: Critical
- Files:
  - `nutrition_assistant/auth.py:27`
  - `nutrition_assistant/auth.py:28`
  - `nutrition_assistant/auth.py:73`
  - `nutrition_assistant/auth.py:83`

The backend accepts a default secret when `JWT_SECRET_KEY` is not set:

- `SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "metabolic-dev-secret-change-in-production")`

It also defaults to `JWT_EXPIRE_HOURS=720`, which means bearer tokens can remain valid for 30 days.

Impact:
- If the environment variable is missing or misconfigured, anyone who knows the default can mint valid JWTs for arbitrary users.
- Long-lived tokens significantly increase the blast radius of leakage or theft.

Recommendation:
- Refuse to start unless a strong secret is explicitly configured in production.
- Rotate the current signing key before rollout if there is any chance this default has been used.
- Reduce access token lifetime to a short window and add refresh-token rotation if long sessions are required.

### MBP-002: User identity is trusted directly from token claims with no backend revalidation

- Severity: Critical
- Files:
  - `nutrition_assistant/auth.py:169`
  - `nutrition_assistant/auth.py:176`

`get_current_user()` accepts the JWT, extracts `sub` and `email`, and returns them directly as the authenticated user object. There is no lookup in persistent storage, no disabled/deleted-user check, and no revocation/version check.

Impact:
- A forged token immediately becomes an accepted identity if the signature validates.
- Deleted, suspended, or changed accounts remain usable until token expiration.
- This weakens incident response because there is no server-side kill switch for existing tokens.

Recommendation:
- Load the user from the database on every authenticated request or enforce a token version / revocation check.
- Reject tokens for non-existent or disabled accounts.

## High

### MBP-003: JWT `sub` is used as a filesystem path component without traversal protection

- Severity: High
- Files:
  - `nutrition_assistant/storage.py:46`
  - `nutrition_assistant/storage.py:55`
  - `nutrition_assistant/exercise_history.py:26`
  - `nutrition_assistant/exercise_history.py:34`
  - `nutrition_assistant/workout_store.py:36`

Several JSON fallback storage helpers build user-specific directories with `DATA_DIR / user_id`, where `user_id` comes from authentication context. There is no normalization, allowlist, or boundary check on this value.

Impact:
- If an attacker can control `sub` in a valid token, path traversal such as `../../...` may redirect reads/writes outside the intended per-user directory.
- This is especially dangerous when chained with MBP-001 and MBP-002.

Recommendation:
- Never use raw identity strings as path segments.
- Convert user IDs to a strict server-generated format such as UUIDs.
- Resolve the final path and verify it stays inside the expected base directory before any file operation.

### MBP-004: Web authentication is only a localStorage demo session, not real backend auth

- Severity: High
- Files:
  - `nutrition_frontend/app/login/page.tsx:15`
  - `nutrition_frontend/lib/auth.ts:9`
  - `nutrition_frontend/components/route-gate.tsx:28`
  - `nutrition_frontend/lib/api.ts:30`
  - `nutrition_frontend/lib/workout-api.ts:56`

The login page creates a local demo session and redirects to the dashboard without calling the backend login endpoint. Route protection also trusts localStorage state. API clients do not attach bearer tokens.

Impact:
- Any user can mark themselves as "logged in" in the browser.
- The web UI has no trustworthy authorization boundary.
- This creates a dangerous mismatch between what the UI suggests and what the backend actually enforces.

Recommendation:
- Replace demo-session logic with real authentication against `/auth/login`.
- Store auth in secure, server-verifiable session cookies or attach short-lived bearer tokens correctly.
- Treat client-side route gates as UX only, never as access control.

### MBP-005: iOS client also uses fake local auth and never sends bearer tokens

- Severity: High
- Files:
  - `nutrition_frontend/ios-native/Metabolic/Features/Auth/AuthManager.swift:13`
  - `nutrition_frontend/ios-native/Metabolic/Core/Network/APIClient.swift:14`

The iOS client writes a fake authenticated state into `UserDefaults` and the network client does not add an `Authorization` header to outgoing requests.

Impact:
- Mobile login is cosmetic rather than security-enforcing.
- Local device state, backups, or tampering can produce an "authenticated" UI without server proof.

Recommendation:
- Implement real backend login/token exchange.
- Store tokens in the iOS Keychain, not `UserDefaults`.
- Attach authorization credentials in the API client and centralize refresh/logout handling.

## Medium

### MBP-006: Cleartext HTTP is enabled for Android/Capacitor builds

- Severity: Medium
- Files:
  - `nutrition_frontend/capacitor.config.ts:7`
  - `nutrition_frontend/capacitor.config.ts:10`
  - `nutrition_frontend/lib/api.ts:6`
  - `nutrition_frontend/lib/workout-api.ts:32`

The mobile configuration sets `androidScheme: "http"` and `cleartext: true`. The frontend API defaults also point to `http://localhost:8000` when no public API URL is configured.

Impact:
- If this configuration reaches non-local environments, network traffic can be intercepted or modified.
- It normalizes insecure transport settings that are easy to forget in release builds.

Recommendation:
- Restrict cleartext HTTP to explicit local development builds only.
- Fail closed in release configurations unless HTTPS is configured.

### MBP-007: No visible rate limiting or brute-force controls on login endpoints

- Severity: Medium
- Files:
  - `nutrition_assistant/api.py:130`
  - `nutrition_assistant/api.py:136`

The backend exposes registration and login routes, but there is no visible rate limiting, credential stuffing protection, IP throttling, or account lockout mechanism in the code reviewed.

Impact:
- Password spraying and brute-force attempts are easier and cheaper for an attacker.

Recommendation:
- Add per-IP and per-account throttling on authentication routes.
- Add audit logging and alerting for repeated failures.

### MBP-008: API documentation and OpenAPI surface appear publicly exposed

- Severity: Medium
- Files:
  - `nutrition_assistant/api.py:2`
  - `nutrition_assistant/api.py:104`

The application banner explicitly references `/docs`, and the FastAPI app is instantiated with default documentation settings.

Impact:
- Attackers can enumerate endpoints, schemas, and models more easily.
- This reduces the cost of reconnaissance.

Recommendation:
- Disable public docs in production or protect them behind administrative authentication.

## Low

### MBP-009: No frontend security headers are visible in application config

- Severity: Low
- Files:
  - `nutrition_frontend/next.config.js:4`
  - `nutrition_frontend/vercel.json:1`

There is no visible repository-level configuration for CSP, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, or similar browser hardening headers.

Impact:
- Browser-side mitigations may be weaker than necessary.
- Some risk may already be handled at the CDN or reverse proxy layer, but that is not visible from this repository.

Recommendation:
- Add an explicit header policy in the app or deployment edge config.
- Verify CSP compatibility before rollout.

### MBP-010: Unauthenticated third-party food search endpoint can be abused for resource consumption

- Severity: Low
- Files:
  - `nutrition_assistant/api.py:1708`

`/food/search` performs outbound requests to OpenFoodFacts without authentication or visible throttling.

Impact:
- Attackers can generate avoidable outbound traffic and consume backend resources.
- This is not general SSRF because the hostname is hardcoded, but it is still an abuse surface.

Recommendation:
- Add caching and rate limiting.
- Consider requiring auth if anonymous search is not a product requirement.

## Informational

### MBP-011: Some exercise-library endpoints are public by design

- Severity: Informational
- Files:
  - `nutrition_assistant/api.py:1792`
  - `nutrition_assistant/api.py:1797`
  - `nutrition_assistant/api.py:1802`

These endpoints expose exercise metadata without authentication. This is only a finding if the dataset is intended to be private.

## Remediation Priorities

1. Remove the fallback JWT secret, rotate credentials, and shorten token lifetime.
2. Rework authentication so backend identity is authoritative and revocable.
3. Sanitize or redesign filesystem storage keys so user identity cannot influence paths directly.
4. Replace demo auth in web and mobile clients with real authenticated sessions.
5. Add rate limits and production-safe transport/header hardening.

## Scope Notes

- This review was limited to source code present in the repository.
- No live exploitation, infrastructure validation, dependency CVE sweep, or runtime configuration audit was performed.
- Reverse proxies, WAF/CDN headers, secret stores, and deployment-time environment variables were not directly verified.
