# Employee Login, Recovery, Screen Lock, and Dashboard

Axis is an employee Back Office application. Customer credentials must not be
submitted to its login flow.

## Startup journey

1. Axis reads public deployment configuration from `/axis-config.json`.
2. Axis calls the BackOffice public bootstrap.
3. BackOffice returns only active Profile/CMS endpoints and Axis CMS
   composition identifiers.
4. Axis loads `/login` directly from CMS public delivery.
5. Axis sends entered employee credentials directly to Profile.
6. Axis keeps the returned access token in memory only. Profile stores the
   refresh credential in a scoped `HttpOnly` cookie that Axis cannot read.
7. Axis calls secured BackOffice bootstrap with the access token.
8. BackOffice returns the effective tenant-scoped Axis employee policy,
   authorized module catalogue, navigation contributions, compatibility,
   availability, and client-safe environment observations.
9. Axis constructs its shell from the local Dashboard route plus authorized
   module-owned navigation.
10. If authorized, Axis loads `/dashboard` from authenticated CMS delivery.

A customer login is never used as a fallback. Authentication or authorization
failure keeps the employee outside the dashboard and displays a safe message.

Password fields on login and lock-screen pages include an accessible show/hide
control so employees can verify local typing mistakes before submission.
Revealing a password changes only the current input presentation. Axis still
sends the value only to Profile, never stores it, and never exposes it through
BackOffice, CMS, URLs, logs, query cache, or browser storage.

## Password recovery

The public `/forgot-password` page uses the same responsive authentication
layout as login, with CMS-owned introduction, identifier label, placeholder,
action label, assistance, and legal text. Axis intentionally keeps submission
unavailable today because Profile does not yet expose an approved employee
self-recovery API.

Do not simulate success, send identifiers to BackOffice or CMS, or build a
frontend-only reset path. The future Profile contract must be anti-enumeration,
rate-limited, tenant-aware, auditable, and compatible with the existing OTP and
notification authorities before this form is connected.

## Idle screen lock

The secured bootstrap returns `axisPolicy` after employee authentication.
Version 1 supports `screenLockEnabled`, `idleTimeoutSeconds` from 60 through
86,400, the policy contract version and optimistic revision, and whether the
effective policy came from layered defaults or persistence.

Axis observes keyboard, pointer, touch, and wheel activity. Pointer movement is
throttled to one deadline update per second to avoid high-frequency work.
Background-tab timer throttling is handled by comparing the absolute deadline
when the page becomes visible again.

When the deadline passes, Axis:

1. records a bounded lock marker and same-application return path in
   `sessionStorage`;
2. replaces it with `/lock-screen`;
3. keeps tokens and the employee identifier in memory only;
4. hides protected application content;
5. asks only for the current employee password; and
6. sends that password directly to Profile.

A successful unlock receives fresh Profile tokens, reloads secured BackOffice
bootstrap and policy, removes the lock marker, and returns to the prior
protected route. A failed unlock stays locked and shows a safe authentication
error. “Not you? Sign out” clears the marker and local session, asks Profile to
revoke it, and returns to `/login`.

The marker contains only `locked: true` and a validated relative return path.
It never contains a password, access token, refresh token, employee identifier,
backend response, or authorization data. External, malformed, authentication,
and lock-screen return paths fall back to `/dashboard`.

The screen lock is presentation defense-in-depth. It never replaces bearer
expiry, revocation, Profile authentication, or target-module authorization.

On browser refresh, Axis reads only the non-secret CSRF cookie and calls the
Profile browser restore endpoint with credentials included. Profile requires
the exact allowed Origin and matching `X-CSRF-Token`, consumes the refresh
credential once, rotates it, and returns a replacement access token and
employee identifier. Axis then reloads the secured BackOffice bootstrap and
restores the lock gate before protected routing. A session that was locked
before refresh remains on `/lock-screen` until successful password
re-verification; refresh cannot silently return it to the dashboard. An
expired, revoked, replayed, or otherwise invalid session returns to the public
login experience.

## Logout

Axis sends the configured CSRF value to Profile, which revokes refresh state
and expires both browser-session cookies. Only after Profile confirms that
operation does Axis clear its in-memory access token and redirect to `/login`.
If Profile is unavailable, Axis keeps the secured session visible and reports
that logout was not completed; it never presents a false signed-out state while
an HttpOnly refresh session remains active. The existing short-lived access
token remains bounded by backend expiry and revocation policy.

## Configuration

The root `.env` contains only public deployment values:

```dotenv
AXIS_BACKOFFICE_BASE_URL=http://localhost:4300
AXIS_ENTERPRISE_CODE=default
AXIS_PROJECT_CODE=nodics.kickoff
AXIS_CLIENT_CONTRACT_VERSION=1
AXIS_REQUEST_TIMEOUT_MS=10000
AXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf
```

The CSRF cookie name is public protocol configuration and must equal Profile's
effective `profileBrowserSession.csrfCookieName`. Do not add Profile or CMS
URLs. BackOffice discovers them from module self-registration. Never place
passwords or tokens in `.env`, browser storage, URLs, logs, or query-cache keys.

## Failure behavior

- Invalid configuration uses static configuration recovery.
- BackOffice discovery failure uses static discovery recovery with retry.
- Missing Profile or CMS registration fails public bootstrap closed.
- CMS failure or incompatibility uses static CMS recovery with retry.
- Invalid employee credentials produce a safe login error.
- Missing BackOffice permission rejects the session before dashboard delivery.
- Direct `/dashboard` navigation attempts Profile-owned session restoration;
  absent or invalid refresh state redirects to `/login`.
- Direct `/lock-screen` navigation without an authenticated locked session
  redirects safely.
- Refreshing a locked session restores the lock marker and requires password
  verification before any protected route is rendered.
- Invalid or incompatible Axis policy rejects authenticated bootstrap.
- Persistent-policy read failure is handled by BackOffice using its safe
  configured default.

Employee password recovery is not yet a Profile capability. The CMS page may
explain the process, but Axis keeps submission disabled until Profile provides
a governed, enumeration-safe recovery contract.

## Customize and extend safely

Customize login, recovery, and lock-screen presentation through CMS component
properties and project-owned renderer composition. Add a new authentication
view only as a focused renderer with a typed logical-key registration while
continuing to use Profile's browser-session, CSRF, refresh, revocation, and
employee-only contracts.

Do not replace Profile authentication, store tokens in browser storage, embed
credentials in configuration, infer authorization from the UI, or implement
password recovery locally. Test valid and invalid credentials, customer-user
rejection, missing permissions, refresh restoration, locked-page refresh,
CSRF rejection, idle boundaries, logout revocation, malformed CMS properties,
responsive layout, and rollback of the project renderer registration.

## Verification

```bash
npm run verify
```

Tests cover low-disclosure discovery, policy validation, credential delivery
to Profile, HttpOnly refresh restoration, CSRF transport, secured bootstrap
bearer use, protected-route preservation after remount, invalid-session
fallback, CMS authentication pages, inactivity boundaries, activity deadline
reset, protected routing, and logout revocation.
