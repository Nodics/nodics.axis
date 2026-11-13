# Axis App Implementation

This source README documents the frontend workspace renderer and its tests.
See [the root README](../../README.md#documentation) for backend-owned product
guides. Owner descriptors below are consumed contracts, not frontend business
authority.

The desktop header visibly names the selected environment and qualified
Enterprise, with an explicit code fallback. Its bounded text can truncate while
the accessible label and information panel retain the complete current context.
Compact layouts keep that information action available. Composition Site and
Catalog remain separate technical detail. This is read-only presentation of the
existing owner projection; it adds no switching or navigation authority.

Authenticated unknown or non-admitted URLs retain their requested location and
use the existing neutral Page unavailable recovery inside the shell. They do not
silently redirect to the dashboard, infer a permission reason, disclose another
module's existence or fetch domain data. Return to dashboard follows the current
backend composition's default authenticated page. Public and locked requests
retain the existing sign-in and lock guards; admitted child routes still render
their owner workspace. The parameterized restoration cases in
`test/app/employeeLoginJourney.test.tsx` protect these boundaries. Add destinations
through authorized backend navigation metadata, never a second frontend map.

Dedicated guarded routes use that same recovery instead of maintaining private
redirect fallbacks. An exact authorized content fragment can open its focused
workspace without permission to the full content dashboard. Fragment selection
uses the existing owning CMS navigation item, including its availability and
feature-state guards; an unadmitted fragment cannot borrow that grant. Base
workspace admission, original request scope and owner data permissions remain
unchanged. The same integration matrix covers admitted fragments, absent parent
routes, unknown fragments and each dedicated guarded destination.

Unlock checks the retained location against the freshly authenticated navigation
before restoring private record queries or fragments. A changed actor/scope or
removed route admission retires that location to the composition's dashboard.
The existing lock-return privacy tests protect this deliberate authentication
boundary; ordinary unavailable-page recovery still explains the requested URL.

## Backend Operations Workspace

Required listing filters are an input state: no initial owner read is sent until
the declared filters are valid. Optional `minimumLength` on string fields is
bounded to 1–4000 and cannot exceed `maximumLength`. Apply/Search shows field-local
errors; a valid empty array is distinct from an invalid owner list or denial.
POST listings remain explicit reads and are never replayed after a form write.
Generic workspace requests use the existing bounded `requestTimeoutMs` for both
fetch and response parsing. A timed-out read is retryable by the user; a submitted
command remains uncertain and requires existing owner inspection. No automatic
retry or larger timeout is introduced.
Public Profile workspace discovery also consumes the runtime parser’s shared
maximum timeout. A valid deployment timeout must not be rejected by an obsolete
client-specific ceiling; invalid/non-integral values still refuse before fetch.
Discovery cancellation remains a read cancellation, never a submitted-command
retry. See the registration connection tests for the six-minute deployment case.

Listing evidence and filters retire on employee, tenant, Enterprise, project,
connection or section-contract changes. Equivalent metadata keeps current filters.
Profile's Customer directory supplies only its existing name/reference projection;
this generic renderer adds no identity CRUD or account authority. Protect the
behavior with `test/app/backendWorkspaceBoundedListing.test.tsx` and the existing
workspace/field validation tests. Customize labels, limits, columns and endpoints
in the owning backend descriptor; preserve original request identity and privacy.

The generic placeholder distinguishes backend `featureState: DISABLED` from an
active capability with an unsupported renderer. Runtime `UP` is not capability
readiness. The current navigation DTO has no owner availability-reason field;
Axis uses generic readiness copy, not inferred domain prerequisites or commands.

The authorized BackOffice navigation descriptor owns workspace layout, fixed API
paths and owner-role selectors. Axis never infers Media or another domain's API
prefix. Declared workspaces take precedence over legacy Media catch-all routes;
non-workspace upload routes retain their existing implementation. Generic
workspaces remount by navigation identity, preventing sibling-route drafts and
tab selections from carrying over. Missing Profile descriptors do not borrow an
unrelated workspace. Default tabs remain owner metadata, not browser mappings.

## Workspace Header

During a runtime outage, authorized navigation with unavailable or unknown health
remains visible and disabled even when BackOffice projects `featureState: DISABLED`.
This preserves the user's workspace map; healthy disabled features and hidden
entries remain omitted. The rail and route guards still prevent execution.
`test/app/shell/shellNavigation.test.ts` protects these distinct states alongside
the disabled-control checks in `NavigationRail.test.tsx`.

The business title and owner description lead the header. Renderer identity and
contract version remain available in a collapsed, native `Technical details`
disclosure, following the recovery screen's diagnostic pattern. Expanding it
requires no request, changes no owner metadata and does not reset form state.
Keep business help/documentation separate from implementation diagnostics.

## Form Validation

The generic renderer projects visible-field `required` and `EMAIL` metadata into
field-local messages before submission. An invalid submission focuses the first
invalid field, retains entered values, and makes no command request. Editing a
field rechecks its existing error without clearing unrelated input. Hidden and
idempotency fields are not editable validation targets.

Native browser email syntax checking is presentation assistance, not admission
authority: the backend still validates identity, business rules and permissions.
Do not copy enterprise-specific validation or authorization into the renderer.
Wrapped form rows must leave room for floating labels and error helpers at every
supported viewport. Project descriptors remain the source of field names, types,
labels and required flags.

Generic form fields use content-height full-width rows below the theme's `md`
breakpoint. Their wrappers and fieldsets must be shrinkable: a desktop flex basis
must not become a mobile row height, and native fieldset intrinsic width must not
clip controls. At `md` and above the existing wrapping 240px flex basis remains.
Custom themes may change breakpoints without changing owner descriptors, field
order, values or command authority. `backendWorkspaceFieldValidation.test.tsx`
guards these responsive CSS contracts; browser geometry acceptance remains a
separate check.

The shared workspace grid uses `minmax(0, 1fr)`, not an auto-minimum column.
Workspace stacks and section surfaces are shrinkable, and listing minimum widths
remain inside a width-bounded horizontal scroller. A wide listing must never
expand sibling form controls or the page. The combined listing/form render in
`BackendOperationsWorkspaceRoutePage.test.tsx` protects that container chain;
the 720px table minimum remains unchanged for desktop scanning.

## Read-Only Row Handoff

Acknowledged form mutations invalidate mounted GET listings in the same workspace
through their existing loader, preserving edited filters and authorized endpoints.
Enterprise creation must first pass its matching owner-record acknowledgement.
Failed, uncertain, late or retired-context replies do not invalidate listings.
Older in-flight listing replies cannot replace a newer refresh. Refresh failure
is a listing error, not failure of the completed command; explicit Refresh retries
only the read. Non-GET listings are not automatically replayed. No polling,
command retry, optimistic inserted row or cross-workspace cache authority is added.

A listing section may declare an inert navigation action:

```json
{
  "rowNavigation": {
    "label": "Inspect publication",
    "route": "/media/publication",
    "parameters": { "mediaCode": "code" }
  }
}
```

The target must be an available same-module route in the authenticated catalogue.
Parameter keys map to bounded string fields in the listed row. Opening a link
does not execute row command metadata or submit a mutation. A project customizes
labels, route and field mapping through its backend descriptor, not a frontend
domain registry.

A form section can resolve current owner evidence before accepting submission:

```json
{
  "readSource": {
    "endpoint": { "method": "GET", "path": "/nodics/media/v0/library/{mediaCode}" },
    "parameter": "mediaCode",
    "fields": { "mediaCode": "code", "versionId": "versionId" },
    "commandId": "requestPublication",
    "unavailableMessage": "Current source prerequisites are not satisfied."
  }
}
```

Only a parameterized GET is accepted. Bound path parameters do not become query
parameters; the canonical Media inspection requires an empty query/body. API
paths stay fixed by the descriptor and use the discovered owner connection.
Mapped TEXT fields are cleared before inspection, populated only from fresh
identity-matched evidence, then disabled even when the owner command is ineligible.
This separates inspectable source identity from publication eligibility. Wrong
identity or malformed source fields remain blank. Incoming version query parameters never confer authority.
The owner must return exactly one matching command ID/method whose mapped fields
equal inspected fields, including exact version. Returned command paths are never
executed. Failure, wrong identity/version, missing eligibility or unresolved
prerequisites keep submission disabled and show the owner error. Explicit Refresh
inspection permits recovery; no automatic POST, approval or activation occurs.
Success requires another explicit inspection before a subsequent command.
An uncertain command acknowledgement also disables submission until explicit
inspection. Refresh preserves the original idempotency reference for the same
source after uncertainty; it never creates a new operation key to replay an
unconfirmed write. A confirmed successful command or a different source gets a
fresh reference on the next inspection.
IDEMPOTENCY fields display their generated reference as a read-only text field
using the owner-provided label. Operators can record the exact request identity
for recovery without editing it. HIDDEN fields remain hidden; displaying a
reference does not authorize retries or alter the inspection gates.

Backend validators must preserve these descriptors before a module publishes
them. This extension is inert presentation support, not an authorization grant.
Owner POST still rechecks permissions, current source version and workflow gates.

An optional `readSource.unavailableMessagePath`, for example
`publicationReadiness.message`, selects a plain dotted owner diagnostic path.
The descriptor rejects prototype/constructor segments and bounds the path to 256
characters. After fresh mapped identity matches, an ineligible command may show
only a nonempty scalar string of at most 512 characters without control characters.
Objects, oversized text and mismatched identity retain the fixed fallback.
Messages render as text, never HTML, and never enable submission or alter authority.
Primary identity is verified before requiring all mapped command fields. When
the owner returns a matching code but a null/unavailable exact version, Axis
displays only the verified code plus the bounded owner reason. The version stays
blank and frozen, and the command remains disabled. No URL/default version is
substituted and no owner eligibility or qualification is inferred.

## Session Expiry

Generic backend-operation workspaces render only at their admitted normalized
navigation pathname, with active/preview state and available owner health. A
missing child URL must not reuse an authorized parent's form or directory.
Axis shows a generic Page unavailable message and a dashboard action without
calling the parent workspace's owner. Declared workbench record routes and native
detail routes retain their existing matching contracts; query and fragment state
on an exact generic route remain usable. Keep mounted route and lock-return
coverage in `test/app/screenLockReturnJourney.test.tsx`.

Recent navigation and favourites use bounded module/item identifiers in a
versioned local preference key scoped to the non-secret employee login identity,
tenant, enterprise and canonical environment set. They contain no token, record
URL, query, credential or command. Missing ownership disables persistence;
unowned legacy browser-wide preferences are ignored. Context replacement retires
the old preference view during render and never copies it into the next owner's
storage. Returning employees recover only their own context's preferences.
Fresh authorized navigation still filters every shortcut. Storage denial or quota
failure leaves authorized navigation usable. Keep mounted owner-change coverage
in `test/app/shell/AppShell.test.tsx` and key/bounds coverage in
`test/app/shell/navigationPreferences.test.ts` when customizing this presentation.

Screen lock takes precedence over initialization recovery and loading. A stale
NOT_READY/UNAVAILABLE admission or pending legacy setup read must not mask Unlock
with a recovery action that cannot run while locked. Unlock retains Profile
authentication and a fresh authenticated bootstrap before restoring a route;
unready fresh admission still gates the unlocked workspace. No setup/import/
approval is bypassed or retried. `test/app/screenLockReturnJourney.test.tsx` covers
denied, unavailable and loading snapshots, pending unlock bootstrap, fresh READY
restoration and fresh UNAVAILABLE followed by explicit status refresh.

Unlock also admits one explicit attempt at a time through Profile authentication
and BackOffice admission. The managed form exposes `aria-busy`, disables its
submit button and shows a progress icon without changing CMS-owned captions.
Failures allow an explicit retry; session replacement retires the pending attempt.
Custom renderers consume `employeeUnlockPending` and preserve the App guard.
The lock-form and screen-lock return tests cover duplicate submission and denial.

A live unlock by the same employee, Enterprise and tenant restores the exact
relative record location, including its query and fragment, from App memory.
The stored screen-lock marker keeps its existing restricted path and declared
enterprise tab; arbitrary detail queries, fragments and credentials are not added
to storage. Reloading the lock-screen entry therefore uses that restricted marker.
An explicit internal record link opened while already locked is a new entry:
restoration retains its validated query/fragment in memory for the subsequent
same-context unlock. Auth/public entries still use the restricted marker, and
no arbitrary URI is added to storage. Fresh login, expiry, sign-out, context
change or lost route admission retires the private return context. The fresh authenticated bootstrap still decides whether the
destination can render; retaining a reference never grants access or replays work.
This preserves record navigation, not general unsaved form state. Extend
`screenLockReturnLocation` only as an inert local-location projection and retain
the App admission checks. The lock-return tests cover exact detail restoration,
storage privacy, locked explicit-entry links, marker fallback, changed employee/tenant and removed route permission.

Employee password login is single-flight across Profile authentication and
BackOffice bootstrap. App admits the attempt synchronously, not just by disabling
the button after a render. Both managed and bundled login forms expose busy state
and a progress icon while retaining their existing captions. No sign-in retries
automatically. A current failure releases the form for an explicit retry.

Logout, changed login context, router navigation, session replacement/expiry and
unmount retire the attempt. Router location identity includes pathname, search,
hash and state changes, including a new entry at the same path; retirement runs
before paint. Returning to sign-in requires a fresh explicit submission.
Late success or failure cannot issue a dependent bootstrap request,
install/clear authority, clear queries or navigate. This is client response
admission, not server-side cancellation or revocation of an HttpOnly cookie that
Profile may already have issued. Profile retains session/cookie authority.
Customize managed captions through existing CMS properties and presentation
through the two existing renderers; preserve the App-owned guard and retirement.
`test/app/employeeLoginRace.test.tsx` covers deferred responses at both boundaries,
rapid submit, logout, newer authority and unmount using synthetic owner responses.
Route-departure regressions cover both response phases, success/failure, managed
and bundled forms, query changes and same-enterprise sign-in state changes.

Generic owner requests attach the current admission generation to their private
HTTP 401 signal. App invalidates only the exact issued token and generation;
an older response cannot clear a newer login, including a reused token. Admissions
use monotonically increasing generations and native workspaces remount for each
admission. HTTP 403 stays an owner permission error, not a sign-out instruction.
No response-body text determines session expiry.

Confirmed expiry clears authenticated queries, owner evidence and unmounted
drafts. The login handoff retains only the relative pathname, never query values,
fragments, form values or credentials. Manual sign-in returns to that safe path;
the authenticated login-route redirect uses the same validated return path.
There is no automatic login, logout, renewal or mutation replay. Contributors
must preserve both request-identity checks when extending this scoped transport;
this is not a global interceptor for unrelated clients.

## Verification Cases

`test/app/BackendOperationsWorkspaceRoutePage.test.tsx` covers authorized row
links, empty-query inspection, frozen exact versions, mismatched proofs, failed
reads and explicit submission. `test/app/employeeLoginJourney.test.tsx` covers
Media catch-all precedence, staged owner selection, read/write 401 recovery,
403 preservation and a deferred old 401 after fresh sign-in with the same token.
`test/auth/employeeSessionEvents.test.ts` covers bounded private signals;
`test/auth/employeeAuthClient.test.ts` covers same-millisecond admission identity.
Existing upload source
remains unchanged. Live responsive/browser acceptance belongs to the shared
session; jsdom tests do not certify live prerequisites or publication outcomes.

For a multi-tab owner workspace, an explicit valid tab selector takes precedence. Otherwise a query parameter declared by a form readSource opens that form’s tab for fresh owner inspection. With no bound record, the owner’s default tab can provide its existing listing/picker. This performs no submission and adds no command authority.

Backend-operations forms accept bounded owner-declared `resultSummary` fields and an inert `resultNavigation` handoff. Render only own scalar acknowledgement values and link only to the current authorized local route with complete flat query mappings. Equivalent metadata refresh preserves the completed source-bound command hold and receipt; explicit fresh inspection remains necessary for another intent. Actor or source changes retire the receipt. Neither metadata nor navigation executes an operation or expands access.

Runtime Dashboard health totals remain unknown after a failed read. Successful zero observations stay distinct from unavailable evidence; retained values are marked as last known. Runtime participation lists reported server identities, and planned versus unavailable navigation stays distinct. The page does not infer load balancers, node allocation, or host metrics absent from owner contracts.

Content and Publishing metric counts bind to an exact advertised runtime role. Source authoring, manifests, requests and audit use WCMS Staged; target pointers and receipts require WCMS Online schema evidence. Ambiguous or missing origins remain unavailable. Server names never select authority, and an empty response from another owner is not a substitute. Schema Workbench headers use a page heading unless an owner header already supplies one.

Grid settings can reset columns to the current owner defaults, preserving fixed selection and action controls and excluding unavailable fields. This changes presentation preferences only. Metric drilldowns require an available admitted navigation destination independently of a successful schema count; a readable count does not create a page or grant access to a disabled view.

## Shell utility controls

The header shows implemented browser utilities and the authorized Assistant
shortcut. It does not invent a personal task count, notification result or
Profile destination. Personal inbox/task shortcuts require an owner-admitted
workspace and actual service evidence before they can be introduced. Use the
backend navigation contribution for business destinations; do not add a second
shell route registry.

The employee menu exposes the existing appearance toggle at every breakpoint,
plus lock and sign-out only when their callbacks are available. Theme changes
remain browser presentation preferences; they do not change tenant, permissions
or owner state. `test/app/shell/AppShell.test.tsx` checks the absent placeholders,
actual appearance action and session callbacks. Projects may customize theme
tokens and the existing shell component while preserving these boundaries.

## Editorial publication withdrawal

The article detail reuses the exact-source nPublish inspection client before
calling its existing authorized Editorial lifecycle action. Prepare is read-only;
confirmation submits the inspected publication reference and concurrency revision,
including zero. Article revision is not publication revision. Wrong root/domain,
source-version drift, missing/ambiguous source and inspection denial hold the
command. The UI does not infer Online state from a stored reference.

After any command attempt, explicit inspection is required before another intent.
A confirmed withdrawn request may reconcile the same article status through the
owner; an uncertain acknowledgement is never displayed as success. Actor, tenant,
enterprise, article and source changes retire private evidence and late results.
The shared Workbench pending indicator describes only an in-flight mutation.
Projects customize the existing typed component/theme and backend labels, keeping
nPublish transition/CAS and Editorial pointer correlation in the backend.
`test/operations/editorial/EditorialWithdrawalAction.test.tsx` protects preparation,
confirmation, mismatches, zero, acknowledgement loss and context retirement.

The compact mobile toolbar uses the approved reverse Nodics mark in dark mode
and the forward mark in light mode. The vector, proportions and brand colors
remain the root brand contract; customize theme selection rather than redrawing
the glyph. Native mobile/theme verification protects actual surface contrast.

Default/primary MUI links on Light surfaces use the composed theme's primary
text color and a matching underline. Gold remains the primary action fill and
focus accent. Dark mode, explicit semantic/custom colors and inherited links
retain their existing palette behavior. Customize text through the composed
theme rather than capturing a default Charcoal value. The shared theme tests
check contrast on both Light surfaces, project text overrides and color isolation;
native documentation links verify the effective MUI rendering.

Semantic status hues keep their approved base tokens. Dark mode derives ordered
light/main/dark tints centrally in `createAxisTheme`, with Charcoal foregrounds on
contained semantic actions. The darkest hover tint still supports readable button
text; charts, indicators and semantic text use the same palette across workspaces.
Light semantic hues and the Gold/Charcoal brand identity remain unchanged. Never
fork per-feature status colours to compensate for the shared palette.

Safe customization uses the composed MUI theme while preserving contrast on actual
canvas/paper surfaces and normal/hover action fills. `axisTheme.test.ts` checks all
four semantic families in both modes, including retained Light base tokens and
existing brand/link/focus behavior. Native dashboard dark/mobile review remains a
separate live check; a palette unit test does not qualify the whole application.

Workspace documentation actions use the composed text foreground for contrast
on both Light and Dark surfaces. The Gold signature remains a brand fill/mark;
it is not forced onto a functional help icon over a white surface. Existing owner
links, accessible names, focus targets and new-tab behavior remain unchanged.
Customize the composed theme rather than per-workspace colors.

Capability admission applies before native, CMS-designer and generic route
branches. A healthy module does not make a disabled/hidden capability executable.
Hidden entries use generic unavailable recovery; disabled or unavailable entries
retain owner status, read-only availability recovery and the owner-provided
dashboard route. This also prevents disabled Documentation Designer child URLs
from inheriting an executable parent editor. Schema-workbench connection admission
independently requires Active/Preview state. No owner configuration is activated
or inferred by these presentation guards. Preserve the mounted native-state,
workbench-state and exact-child regressions in the app tests.

Inside Documentation Designer, BackOffice discovers documentation areas and
Staged CMS admits the signed-in employee to each exact Site/Catalog pair through
the saved-page list. The first admitted area in catalogue order is selected by
default. Multiple products sharing that pair use the same owner result. A denied
area is omitted, and other check failures offer a read-only retry. Projects can
register their own documentation areas through the BackOffice contract while
Staged CMS retains permissions and draft ownership. See the owner-admission
regression in `test/operations/documentationManagement/DocumentationManagementRoutePage.test.tsx`.

CMS route delivery carries the current private employee session generation to
the existing App-owned HTTP401 signal. A rejected locked-page request must
retire only the matching session and show normal sign-in, rather than trapping
the employee behind CMS recovery. Public requests and403 permission denials do
not expire a session; aborted/late requests cannot expire the next actor.

CmsRoutePage binds ready/error state to an opaque in-memory identity covering
actor generation, token replacement, Enterprise, Site, owner endpoint, path,
language and channel. It immediately renders loading when that scope changes,
and ignores results from aborted requests even when a transport ignores abort.
No old actor's CMS page remains visible while the replacement is pending.
Keep this lifecycle in Axis; no customer config or backend identity replacement.
See cmsClient and CmsRoutePage retirement tests plus the native locked-session
reauthentication check.

If secure sign-out fails during a CMS/network outage, the recovery screen keeps the original secure sign-out callback and error guidance available. Retry follows the owner logout protocol; it does not discard a still-live server session or expose the locked workspace.

Secure logout requires the Profile browser owner's explicit
`SUC_AUTH_00000` envelope with `result: true`. HTTP success alone, an empty or
malformed response, and contradictory failure envelopes retain the existing
locked recovery path; they never clear the employee session or replay logout.
The client regression covers these uncertain responses alongside confirmed
revocation and already-absent-session acknowledgement.

## Source-owned session recovery guidance

`backofficeAxisPolicy.sessionRecoveryPresentation` supplies bounded inert
`lockedMessage` and `expiredMessage` text through the effective Axis policy. The
Framework defaults distinguish saved records and explicit checkpoints from
unretained edits, and explain that an already submitted action may complete.
Axis must hide protected data during lock/expiry, retain only the admitted return
context and never replay a write after reauthentication. The presentation is
resolved from layered source configuration, not copied into persisted policy
updates. Older policy snapshots may omit it; malformed supplied text fails closed.
Later layers may customize wording without changing authentication authority.

## Business and composition context

The shell leads with Profile’s current Enterprise display name, falling back to
the exact Enterprise code if unavailable. It does not humanize a code as a known
business name. Environment remains deployment context. Storage tenant and Axis
composition Site/Catalog are separate technical details and do not select business
records. Workspace-specific site/catalog selectors retain their original owning
contracts, query scopes and draft retirement. No global business switch or cross-
Enterprise authority is inferred from the header.

Initialization recovery likewise discards private search/fragment input before
returning to an interrupted plain path. If that destination is absent from fresh
admission, the shared neutral recovery explains it without rendering its owner
workspace. The initialization-admission tests verify both the retained safe path
and the discarded private inputs; no initialization command is replayed.

Saved schema detail objects and arrays render as complete, scrollable read-only text inside their already admitted fields. They are not inferred relationships or executable HTML. Grid summaries remain concise; declared relationships retain their owner resolver and depth limits. Customize field presentation through the effective owner schema; do not expose undeclared or forbidden fields to make a detail view richer. The WorkbenchRecordDetail regression covers structured inspection, exact false/zero values, inert markup, undeclared fields and read-only actions. Native acceptance also checks saved values and narrow-screen wrapping.

### Localized shell and workflow presentation

The Localization owner supplies approved EN/AR workflow messages. Axis applies document and MUI theme direction together through the shared locale style boundary, using direction-specific Emotion caches. Locale changes preserve mounted authoring state. Framework modules own reusable messages; project-specific wording extends the owner contribution rather than introducing a frontend dictionary. Dashboard and navigation fallback translations use an approved source-text witness, so changed CMS-authored content is never overwritten by an obsolete default. Structured owner errors preserve their safe message keys and exposure; unavailable transport uses bounded client fallbacks.

Keyboard navigation retains list semantics and current-page state, and the navigation drawer is an accessible complementary landmark. Verify the localization context, dashboard localization, API error, navigation and Setup route tests; browser acceptance additionally covers RTL dialogs, owner-denied actions, reflow and delayed commands.

Lock-screen errors use the same generic browser transport classification as sign-in,
with unlock-specific recovery copy. Profile denial messages remain unchanged and
only an explicit user submission retries the credential check.
