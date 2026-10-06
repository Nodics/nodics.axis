# Axis App Implementation

This source README documents the frontend workspace renderer and its tests.
See [the root README](../../README.md#documentation) for backend-owned product
guides. Owner descriptors below are consumed contracts, not frontend business
authority.

## Backend Operations Workspace

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
