# Setup And Accelerators Operations

Setup & Accelerators renders BackOffice-owned application capability readiness.
Axis must not infer setup dependencies, publication state, approval state, or
repair operations from local page logic.

## Setup Progress And Recovery

The owner status supplies the journey: planned/not imported, preparing/importing,
awaiting reviewer decision, Online ready, or an unavailable prerequisite. Axis
polls GET status only during importing, preparation RUNNING, capability PREPARING
or publication ACTIVATING. Stable IMPORTED and human-waiting PUBLICATION_PENDING
states do not poll. Progress reads back off from two seconds to thirty seconds
and stop after five minutes; focus/reconnect does not initiate another read.
Permanent read failures stop polling and disable mutations from cached status.
Status GET HTTP 429 responses carry typed, bounded Retry-After cooldowns (five
seconds to five minutes, default thirty seconds). An owner-projected
READINESS_RATE_LIMITED blocker also pauses refresh for thirty seconds. Only
already-observed progress may resume GET observation within its original window;
unknown/stable states require an explicit refresh after cooldown. No browser-owned
dependency sequence, automatic POST retry, approval or grant is permitted.

Only `allowedActions: INITIALIZE` exposes initialization. Preparation needs do
not grant this action. An available, supported backend repair is a separate
explicit action with its declared confirmation. Imported content offers Submit
for review rather than another import. While any mutation or that row's status
read is pending, mutating controls are disabled. Approval reads the existing
Process task once; a missing task never silently replays initialization or
executes a repair. A changed publication identity/revision must be reviewed again.

After an uncertain mutation response, invalidate status through GET only. Clear
the old operation error only when a newer owner response confirms that operation's
requested state transition; do not parse timeout wording or treat an unrelated
CURRENT release as success. Otherwise preserve the failure and explicit recovery.

Required Media readiness belongs to the backend readiness owner. It must report
missing/unknown activation through existing business status, blockers and next
action; a CMS Online receipt alone cannot certify Media. Axis also rejects a
contradictory ONLINE label when readiness is not READY or an ERROR, BLOCKED, or
REPAIR_REQUIRED blocker remains. INFO and WARNING alone do not negate Online.
Read-only detail expansion remains available during stale/error reads; mutating
commands stay blocked until authoritative status is available again.
Media publication UI belongs to its owning native workspace, not setup-owned
grants, guessed proof fields or automatic approvals.

Media-owned blockers with an explicit asset projection are grouped into one
inspection table, retaining every media reference, pinned source version and
owner status. Other blockers remain separate. Details retain repair diagnostics.
The owner handoff must declare Media ownership, matching mediaCode, inert
inspection flags and a valid workspace; its route and workspace must match exactly
one current ACTIVE authorized Media navigation entry with an available matching
connection. Missing, disabled or inconsistent metadata exposes no executable
fallback, and no generic Publishing route is guessed for Media repairs.

The existing handoff carries only mediaCode, not a historical-version selector.
The destination's readSource therefore inspects current Media metadata. The table's
pinned version describes the CMS dependency; it is not a claim that current-version
inspection selects that immutable historical source. Exact-version source drift
requires Media/CMS owner resolution; Setup never sends the projected publication
POST, substitutes versions or approves Media. Reviewer eligibility and business
task context must be projected by Process before Axis can render those decisions.

Available REFRESH_READINESS descriptors bind only confirmation-free
`applicationInitialization.status` to explicit GET refresh. They never invoke
preparation or make unavailable mutations executable. Shared readiness metadata
does not infer another workspace from prose for refresh or import-history actions.

Failed Import preparation consumes bounded owner `groupReceipts`, per-step
`releaseReceipt` and `operationFailure` metadata only. Raw causes, records and
provider diagnostics are not copied into the status DTO. An Import failure takes
priority over registry or mutating repair commands. Review import history consumes
the published `repair.handoff` or `operationFailure.historyHandoff` only: version
1, owner import, action REVIEW_IMPORT_HISTORY, available, readOnly true and
automaticExecution false. Its route contains only area=history and its exact
importInstance. Axis rechecks both the authorized navigation pathname and that
instance's server/runtime-role identity; mismatched, absent or unavailable
descriptors never fall back to a guessed route. Flat repair.route must agree with
handoff.route. An explicitly unavailable repair remains inert. Historical run identifiers
remain explicitly historical, not current-attempt proof. See
[scoped Import history](../importExport/README.md#scoped-failure-inspection).
An operation-returned failure receipt remains read-only diagnostic evidence when
the immediate GET omits that transient attempt field. It is scoped to the latest
operation's profile, never merged into allowed actions or permissions, and clears
only when fresh owner steps confirm every involved release CURRENT on the exact
target. It takes priority over generic Process/Publishing guidance. A read-only
history link remains available during a later failed status read when its target
still resolves in the authenticated catalogue; writes remain blocked.
`MEDIA_DEPENDENCIES_PENDING` is supported readiness, not Online or a new action.

## Customize Safely

Backend contributors supply profile metadata, allowed actions, status and inert
repair descriptors through BackOffice. Frontend contributors may customize the
existing row rendering or typed client's transport presentation; for example,
render a different caption for an owner-declared preparation repair without
adding a new operation or deriving permission from preparation steps. Preserve
explicit confirmations, owner identity, GET-only observation and no replay.
The focused route/client tests protect these boundaries; live UI acceptance is
separate from jsdom tests.

Dashboard reviews render the owner's inert `setupPlan` contract. The
`?profile=<code>` entry opens only that authorized catalogue offering. Technical
details stay collapsed unless explicitly expanded; their state uses the `expanded`
query parameter. Unknown codes do not fall back to a different offering. All
applications clears the focus. Categories are discovered from profile metadata,
including future categories; never add an accelerator-name switch in Axis.
This focused navigation is not durable setup intent or automatic activation.
See [dashboard contributor guidance](../../dashboard/README.md).

Capability blockers may include backend-declared `repair` metadata. Axis may
render an executable repair action only when all of these are true:

- the backend marks the repair as available;
- the operation is one of the governed operations supported by this client;
- the action is sent back to BackOffice, not implemented in the browser.

An explicitly unavailable diagnostic (`available: false`) may omit `operation`,
as in `READINESS_VALIDATION_BLOCKED` / `REVIEW_SETUP_PREREQUISITES`. The parser
retains its required action/label and owner evidence, representing absent
operation internally as an empty value rather than inventing a command.
Enabled repairs still require a nonempty operation, except the existing
validated read-only import-history handoff. Missing availability, malformed
actions and supplied blank/null operations do not qualify for this exception.

For the explicit `REVIEW_SETUP_PREREQUISITES` diagnostic, the recovery summary
may offer its configured label as a read-only Import workspace link. The existing
authorized history resolver binds the owner-declared server/runtime role to one
current Import connection and navigation item; missing, disabled, ambiguous or
conflicting evidence disables the link instead of guessing Module Registry.
The destination is target history, not a claim of failed-attempt evidence or a
preselected release. Individual release inspection uses the Import workspace's
existing tabs and explicit controls. No repair is enabled or executed by this
link, and module/runtime admission blockers retain their existing precedence.

Currently executable repairs:

- `applicationInitialization.prepareCapability`
- `applicationInitialization.reconcileApproval`

When BackOffice returns `preparationOperation` evidence, Axis may render it as
compact before/after setup evidence. Axis must not derive that evidence from
release lists or import files.

Source repairs, runtime repairs, publishing-only repairs, and module registry
repairs remain operator guidance until their owning backend exposes an
executable governed operation.

When changing this area, validate:

```bash
npx vitest run test/operations/setupAccelerators/api/applicationInitializationClient.test.ts
npx vitest run test/operations/setupAccelerators/SetupAcceleratorsRoutePage.test.tsx
npm run typecheck
```
