# Authenticated Catalogue Observation

BackOffice owns module registration, availability, permissions and navigation.
Axis consumes authenticated bootstrap GET responses; it never predicts missing
modules, constructs a menu from runtime names, or promotes disabled/hidden entries.

Runtime registration is asynchronous after traffic startup. A successful initial
bootstrap can therefore contain only healthy entries while a later runtime is
wholly absent. Healthy navigation is not proof that registration is complete.
`useNavigationAvailabilityRecovery` observes the existing authenticated catalogue
every 30 seconds while its unlocked authenticated scope is active. This remains
read-only observation of the backend authority, not a client registry or readiness
gate. Healthy time does not exhaust future outage recovery: a later outage starts
its own `publicDiscoveryRetryWindowMs` (default five minutes, maximum ten).
Returned unavailable snapshots and page changes do not reset that deadline.
A healthy response clears the outage window. Exhausted or permanently refused
reads require explicit refresh; a successful refresh resumes normal observation.

Unavailable published entries retain sequential 1/2/4/8/10-second recovery.
Transient HTTP failures retain the existing cooldown/backoff behavior. Permanent
denials or invalid responses stop observation; no login, approval, publication,
registration or other command is retried. Lock, logout, context transition and
unmount retire pending replies through the existing authenticated scope guard.
The frontend adds navigation only from a fresh authorized response.

Customization remains in public runtime configuration for the bounded window
and in BackOffice for menu/permission/availability metadata. Do not customize
discovery by adding expected-module lists or a default bearer fallback.

Focused source validation:

```sh
npx vitest run test/bootstrap/navigationAvailabilityRecovery.test.tsx test/app/AxisBootstrap.test.tsx
```

These memory-only tests cover absent late registration, returned-snapshot and
page-change stability, disabled/hidden entries, cooldown, permanent denials,
scope retirement, delayed outages and bounded failure recovery. They are not
installed/browser evidence.

## Online documentation guides

The shell and reader share an employee-scoped query to the authorized Online CMS
connection. Imported navigation supplies each menu item's identity, label, route,
and order. CMS supplies the published topic's Site, locale, channel and exact path.
The authenticated bootstrap's documentation sources are management metadata.

Backend-operations forms accept bounded owner-declared `resultSummary` fields and an inert `resultNavigation` handoff. Render only own scalar acknowledgement values and link only to the current authorized local route with complete flat query mappings. Equivalent metadata refresh preserves the completed source-bound command hold and receipt; explicit fresh inspection remains necessary for another intent. Actor or source changes retire the receipt. Neither metadata nor navigation executes an operation or expands access.

## Optional operational diagnostic report

`loadAuthenticatedBootstrap` requests `includeOperationalReadiness=false` on the
existing secured BackOffice bootstrap. This omits only its optional diagnostic
sweep. Fresh documentation publication, functional availability, employee policy
and Axis initialization admission still gate entry. Deploy the owning backend
projection before relying on improved latency; older full responses remain valid.
A version-1 `operationalReadinessObservation` capability is inert and strictly
validated. It cannot replace a report or make an unverified application ready.

`loadOperationalReadiness` explicitly requests the existing full bootstrap,
validates its usual contracts and binds the report to the current tenant and exact
BackOffice connection. Cancellation reaches the HTTP read; a late success after
cancellation is refused. No redirects, credential cookies, implicit retries or
commands are added. Changed source requires catalogue refresh.

`useOperationalReadinessObservation` serves only opened diagnostic views using
the caller's opaque actor/tenant/Enterprise/project/owner scope, including runtime
bootstrap endpoint and client contract version. It cancels hidden observations,
disables poll/focus/reconnect/retry sweeps, and withholds report data during a new
read or failure. The shared shell inspector is available only when BackOffice supplies its complete bounded presentation. It starts the same report only when explicitly opened, shows owner next actions and a collapsible persisted receipt/build identity, and cancels hidden observations. The shell retains the completed observation across workspace navigation and reopening so the same timestamp and receipt can be compared. Explicit Refresh obtains a new observation; any actor, tenant or owner change retires it. No action authority is inferred from the receipt. Technical Overview consumes one report. A legacy CMS summary
requests a report only when its visible sections include operational evidence;
Applications without that section does not start the diagnostic sweep.

Customize presentation through CMS or owner contract extensions; retain transport,
source binding and admission gates. Do not add client readiness calculations or
make the projection flag a security setting. Bootstrap and dashboard tests cover
strict capability parsing, non-ready admission, cancellation/source refusal,
loading/failure/manual recovery, CMS selection and duplicate-read exclusion.
These source checks do not prove live latency or grant business execution rights.

## Public invited-registration availability

The optional existing Profile public feature projection is validated as a bounded
v1 boolean observation. Only an explicit `invitedEmployeeRegistration: true`
permits entry discovery; omitted or false flags do not create a registration
entry. Unsupported/malformed Profile observations fail validation. Other module
feature observations create no frontend registry or navigation authority. The
public sign-in then uses the existing Profile workspace GET for current admission
and copy. The observation itself never starts email or grants registration.
`test/bootstrap/publicBootstrap.test.ts` protects this optional contract.

Navigation parsing preserves the owner's optional `requiredPermissions` list in
both effective and catalogue projections. It is inert round-trip metadata for
governed navigation Preview/draft payloads; Axis never uses it to grant access or
recreate the owner's permission filter. Malformed lists refuse. Omitting these
fields from a current candidate incorrectly changes protected inherited alias
metadata. Keep the native owner/DTO round-trip regression in `publicBootstrap`
tests and preserve backend enforcement.

## Current Enterprise display

The application observes Profile’s existing `/identity/scopes/me` self-read once
per original employee/tenant/Enterprise/owner scope. Only the exact Enterprise
code and plain display name are retained for presentation. No directory grant,
role map, scope selector, automatic retry or credential storage is introduced.
Changed credentials, context, owner, lock and unmount cancel obsolete reads; late
responses and refreshing/failed observations cannot display a former name.
Names do not enter query keys. Original identifiers continue to bind all requests.
Absent names use the exact code rather than an inferred business name.

Customize the name in Profile’s canonical Enterprise record. Renderer extensions
consume the display-only context; never substitute a name into API scope or infer
permissions from the self-read. Parser, transport, cancellation and shell tests
are in `currentEnterpriseDisplay.test.ts`, `useCurrentEnterpriseDisplay.test.tsx`
and `AppShell.test.tsx`. Existing native owner requests may supply the current
session generation to signal HTTP 401 to App; HTTP 403 stays a local denial.
