# Setup And Accelerators Operations

Setup & Accelerators renders BackOffice-owned application capability readiness.
Axis must not infer setup dependencies, publication state, approval state, or
repair operations from local page logic.

## Setup Progress And Recovery

Setup status GETs share a session/owner-scoped queue, including initial queries,
progress polls, manual refresh, invalidation and post-operation observation.
BackOffice projects `applicationReadinessScheduling` version 1 from its framework
`backofficeApplicationInitialization.browserReadiness` policy. Axis supplies no
default: absent policy fails status reads visibly without dispatch; malformed
policy rejects bootstrap. Deploy the backend projection before this client.
Manual refresh has priority, followed by the expanded profile; after the projected
priority burst, the oldest waiting read runs. Background profiles are not dropped
or starved, and catalogue totals stay complete. Queued queries count as Loading
status, never business Pending approval. No cached status enables commands while
its query is queued, fetching or failed. The queue retains no authority results.
Query cancellation aborts active HTTP reads, skips canceled queued work, and
unmount/principal changes reject old results. POSTs are never queued or retried.
Equivalent bootstrap DTO replacements retain the queue: lifetime depends on
effective connection identity/availability, employee token, enterprise and the
owner's scheduling values, not object references. Actual changes retire old
work; an absent scheduling contract still fails closed. Refresh cancellation
never makes retained readiness actionable: commands remain disabled until a
successful current status read. Route tests cover equivalent-bootstrap manual
reads and changed owner, session and scheduling boundaries.
After a command succeeds or fails, prioritize and invalidate only that profile's
exact status query. Preserve bootstrap refresh, but do not restart unrelated
profile reads or wait for a catalogue-wide sweep to settle the command.

Customize only the owning BackOffice layered policy (validated integers 1–16 for
`concurrency` and `priorityBurst`), not an Axis/customer default or timeout. This
is a page-session read bound, not a server-global admission or latency promise;
backend stages may still fan out within their own budget. Existing polling windows,
throttle cooldowns, strict owner parsers and fresh mutation guards remain intact.
Focused gates: `applicationStatusQueue.test.ts`, `SetupAcceleratorsRoutePage.test.tsx`,
`applicationInitializationClient.test.ts` and `test/bootstrap/publicBootstrap.test.ts`.

After a coordinated backend deployment, verify the authenticated bootstrap policy,
then open `/setup-accelerators?expanded=circa` once. Record status GET start/end,
peak in-flight count, expanded-profile completion time, full-catalogue completion,
loading/unavailable/business totals, and registry lease health. Check manual
refresh and an already-running profile's poll share the same limit; collapse or
filter must not discard unknown profiles or manufacture readiness. Compare the
same authenticated catalogue before/after without parallel diagnostic requests.
Source tests prove bounded scheduling, not real runtime latency or heartbeat recovery.

Profile rows render independently from their existing status queries. A slow or
failed profile never hides settled siblings or the authorized profile catalogue.
Initial reads show a named loading indicator on the affected row; background
refresh and route reentry retain cached evidence with a row-specific refreshing
indicator. Errors and explicit GET recovery stay on that row. Loading is query
state, never a fabricated backend readiness value. Commands remain disabled for
pending, fetching or failed owner reads, including when cached allowed actions
exist. The global BackOffice connection gate and mutation guard remain intact.
Summary business counters and the Needs action filter use only settled successful
reads. Pending/background reads appear separately as Loading status; failed reads
as Status unavailable. Neither missing data nor cached data under refresh/failure
is counted as current Online, Pending approval or Need attention evidence.

Customize loading/error presentation within the existing profile row, preserving
its accessible profile-specific indicator and responsive layout. Keep query keys,
owner status parsing, polling/cooldown and mutation policy unchanged. The route
regressions cover mixed pending/success/error reads, cached reentry, failed refresh,
manual recovery and absent connection admission; browser/live acceptance is separate.

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
CMS Approve and Reject also require the owner's approval diagnostic to be
`WAITING_REVIEWER`, both for presentation and the current-query command guard. A
pending publication or workflow reference alone is not actionable evidence.
Missing, unavailable or non-actionable diagnostics expose no decision buttons;
existing owner repair guidance remains available. Media completion after CMS
approval retains its separate readiness gate and never replays the CMS decision.

After an uncertain mutation response, invalidate status through GET only. Clear
the old operation error only when a newer owner response confirms that operation's
requested state transition; do not parse timeout wording or treat an unrelated
CURRENT release as success. Otherwise preserve the failure and explicit recovery.

For long governed imports, select public `AXIS_REQUEST_TIMEOUT_MS=360000` in the
root local `.env`; the validated range is 1000..600000 ms and the example remains 10000. Application Initialization already honors the larger configured value
above its 180000 ms mutation minimum (60000 ms for status reads). Restart the Axis
dev server or rebuild its deployment to load changed public configuration.
This wait does not extend backend deadlines or retry a mutation. After an uncertain
response, inspect fresh owner status/history before another explicit action.

## Signed Operator Stages

For profiles with `preparation.selectionRequired`, Setup renders one explicit
stage dropdown from the current owner's `selectableStepCodes`. Nothing is selected
on mount; a changed owner status or session invalidates the old choice. Initialize
requires both the existing `allowedActions: INITIALIZE` and one still-selectable
code, even when aggregate preparation is BLOCKED by foreign operators. It sends
only `afterPublicationStepCode` through the existing initiate client. An empty
choice list never selects another enterprise or dispatches a bulk AFTER action.
All required stages remain visible in preparation details, including their
projected operator and `AUTHORITY_PENDING` status. Local success is not foreign
proof or aggregate READY. Unscoped profiles retain their selector-free lifecycle.
The owner maps pending foreign authority to an `AUTHORITY_PENDING` blocker with
authorized-enterprise sign-in guidance. Its `REVIEW_SETUP_AUTHORITY` diagnostic
has no operation and is unavailable for execution; it is not unknown readiness
or a refresh repair. The route regression verifies this guidance with an empty,
disabled stage selector and no write requests.

BackOffice owns signed-operator eligibility, stage ordering, prerequisites and
dispatch; nPublish/nImport retain their authorization. Axis neither interprets
the token to grant stage access nor changes the enterprise header to match a
descriptor. Malformed, duplicate, unknown or contradictory selectable projections
fail closed; revoked choices and failed status reads disable commands. No command
is retried automatically. The canonical contract is
[governed application setup](../../../../../nodics.ai/nodics.platform/modules/backoffice/llm/contracts/governed-application-setup.md#explicit-signed-operator-stages).
Customize option presentation with the owner's step label, code and operator
metadata, never by widening its selectable list. The existing route/client tests
cover explicit/unselected/foreign/normal initialization, refresh revocation,
bounded projection validation and the exact request body; these are local fixtures,
not signed-in or live acceptance.

Required Media readiness belongs to the backend readiness owner. It must report
missing/unknown activation through existing business status, blockers and next
action; a CMS Online receipt alone cannot certify Media. Axis also rejects a
contradictory ONLINE label when readiness is not READY or an ERROR, BLOCKED, or
REPAIR_REQUIRED blocker remains. INFO and WARNING alone do not negate Online.
Read-only detail expansion remains available during stale/error reads; mutating
commands stay blocked until authoritative status is available again.
An explicit Approve completes the CMS Process task, observes CMS activation with
at most twenty 500ms GET waits, then uses `coordinatePublicationAssets` with the
fresh owner's bounded `mediaDependencies`. Each unqualified asset uses the existing
Staged Media client with its exact publication code, version and checksum. Only an
actionable Process task matching the returned Media workflow may be approved;
Media and Process retain employee authorization. No decisions run on mount.
Denial or missing task evidence stops the sequence and retains completed owner
effects. CMS Online alone does not clear an asset approval failure. Only fresh
READY evidence confirms the whole approval operation.

At `MEDIA_DEPENDENCIES_PENDING`, Complete asset approvals is available with
Staged Media, Process and owner dependencies. It re-reads owner evidence without
requiring or replaying the completed CMS task, and skips already qualified assets.
Reject is disabled in this state; a pending CMS Reject retains its existing
decision and never requests or approves Media. These are independent owner
operations, not a cross-runtime transaction or a new permission grant.

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
requires Media/CMS owner resolution. Setup never executes a projected command URL
or substitutes versions. Coordinated approval uses only the typed native Media
request and existing Process decision contract described above; reviewer policy
remains backend-owned.

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
