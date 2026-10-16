# Waste review workspace

Notification resolution errors remain visible inside the active confirmation
dialog, with the operator reason preserved. No failure triggers a resend or
automatic repeat. Backend source, revision, confirmation and permission checks
remain authoritative; the route regression covers this recovery presentation.

## Retained Listing Inspection

`WasteListingRequestsPanel` and `api/wasteListingClient` consume the version-1
Waste-owned `/listing-requests` page and exact-asset detail GET contracts. Labels
and state captions are required typed host inputs from the owning backend
presentation contribution; there is no browser-owned navigation or business-copy
registry. The advertised binding is `waste.listing` / `ewaste.listingRequests`.
The App's existing native Waste dispatch mounts `WasteListingRoutePage` only for
that exact available eWaste contribution, not a route-prefix match. The review
workspace is a separate child, so listing inspection never loads review APIs.
The route first reads the owner's frozen `GET /listing-workspace` contract:
contractVersion1, workspaceCode `waste.listing`, viewCode `ewaste.listingRequests`,
and `presentation` with all typed `listingLabelKeys` and `listingStates` captions.
Only a valid presentation admits queue/detail reads. Absent/malformed or denied
presentation leaves the route mounted but fail-closed without rows; only an
explicit GET refresh is offered. The owning eWaste `describe` service projects
copy from `waste.listingWorkspace.views.ewaste.listingRequests`;
frontend code never imports backend properties to obtain its labels.

Inspection keeps legacy null proof/source fields unknown, distinguishes unavailable
owner evidence from absence, and shows signed/required enterprise independently.
Wrong-enterprise review never replaces the current namespace with the Store code.
Existing context/session admission is the only context mechanism. Product authoring
requires the fresh owner AUTHOR_PRODUCT_SOURCE action, canAuthor, exact signed Store
enterprise and one discovered same-environment Staged Product owner. The optional
owner presentation.authoring supplies reviewTitle, confirmLabel, cancelLabel,
workingLabel, savedMessage, uncertainMessage and inspectLabel; absent copy leaves
the command disabled. Confirmation freezes and displays exactly the six selectors
for the human Product POST /products/listings, not an editable Product command.
Acknowledgment must bind original requestRevision/key/digest/Store and actual
Product version/locales. One independent same-intent Waste readback qualifies
source creation; lost/malformed replies or drift remain held for explicit GET
inspection, never another POST or automatic retry. The bounded hold survives
close/reopen in this mounted panel, not logout/reload durable storage. New admission
or owner binding retires late replies and confirmations.

OPEN_PUBLICATION_WORKFLOW navigates only an existing admitted Publication Requests
or, with an owner Process reference, Approval Queue destination. It invents no
publication code, Process reference or query selector and sends no publication/
approval command. No private proof endpoint, returned command URL or generic CRUD
is invoked as a substitute. Binding completion is not implemented here.
The client projects business display fields only, not
raw Product commands, remote image URLs or unknown response fields.

Product evidence retains its actual non-negative `versionId`, including zero;
an activated Product reference must pin that exact numeric source version.
Publication captions preserve nPublish lifecycle IDs (`STAGED`, `PENDING_APPROVAL`,
`ONLINE` and its other canonical transitions), plus only the bounded read-only
compatibility spellings explicitly accepted by the frozen Waste contract. A
display spelling such as `APPROVAL_PENDING` or `ACTIVE` grants no command and
does not qualify approval, activation or a Product pin.
Absent Process references stay absent. Pricing uses its retained SHA256 release
identity as source version, not the Product numeric-version parser; this read-only
slice does not yet consume a Pricing row-evidence response.

`WasteListingReconciliation` consumes optional owner `presentation.reconciliation`
copy and the fixed scoped `/listing-requests/:assetCode/reconciliation` GET/POST.
An explicit inspection must admit `canWithdraw` before reason and confirmation
are offered. The command freezes the owner revision and snapshot digest, sends
one idempotency key, and accepts only a matching WITHDRAWN/RECONCILING receipt.
This withdraws a request, not external publication or financial effects: those
remain UNKNOWN, and relisting remains forbidden. An uncertain command stays held
across close/reopen in the mounted panel; explicit inspection is GET-only, never
an automatic retry or replacement command. Reload/logout does not persist this
browser hold; the owner retains revision, original-key and audit enforcement.
Authority, asset or revision changes retire confirmations and late reads. Owner
copy is the customization seam; no browser-granted cancellation authority or
backend config import is permitted. `WasteListingReconciliation.test.tsx` and
`wasteListingReconciliationClient.test.ts` cover denial, invalid evidence, explicit
confirmation, lost replies and stale authority. Native acceptance is separate.

Page/detail requests are single-attempt GETs. Explicit refresh/paging preserves
selection within the same authority, failed queue reads remove stale rows, and
closed or retired-session detail responses cannot restore private content. A new
employee/token/admission generation/tenant/enterprise/owner binding retires reads
and resets presentation. Hosts must supply the existing session generation.
Customize typed presentation and compose the panel, not its owner authority.
Tests in `test/wasteManagement/wasteListingClient.test.ts` and
`WasteListingRequestsPanel.test.tsx` cover malformed evidence, legacy reconciliation,
unavailable owners, wrong namespace, paging, explicit refresh and stale responses.
`WasteListingRoutePage.test.tsx` exercises the actual native Waste dispatch and
transport, declared binding admission, presentation refusal and signed-context
read-only details. WasteListingAuthoring and wasteListingAuthoringClient tests
cover human confirmation, exact selectors/acknowledgment, uncertainty/readback,
stale replies, missing copy/authority and navigation without approval writes.
No private proof call is wired here.
Synthetic component/transport tests are not installed or native qualification.

Saved decision recovery shows the backend's safe registered reward/notification
stage diagnostic. Missing confirmed reward evidence disables settlement-only
recovery unless fresh owner detail explicitly supplies
`savedRewardRecovery: { available: true, message }`. Its nonblank message is bounded
to 1000 characters and shown in confirmation; `available: false` displays the
owner's reason without enabling retry. Ordinary approval permission remains
required. Axis never evaluates Rules or fabricates an assessment. Notification
summary comes only from top-level `outcomeNotification: {status, message?, retryAllowed}`.

Interrupted physical verification remains a separate `verificationPending` owner
checkpoint. Axis displays its frozen original facts read-only, hides reassignment,
disables ordinary decisions, and offers the owner-labelled resume action to the
current assigned verifier. The existing verify API sends only
`resumeVerification:true`, current source revision, confirmation and command key;
it never resubmits editable facts or creates a replacement assessment. Backend
original-actor/permission/scope/CAS checks remain authoritative. Customize
`waste.operations.presentation.resumeVerificationAction` in the owning backend
layer; preserve typed client and route regressions. Source tests are not native
acceptance evidence.

The evidence-only rejection route is
`POST /review-workspace/:code/evidence-rejection`, not normal review or approval.
Fresh detail must explicitly advertise `evidenceRejectionAvailable: true`; Axis
also requires the current assigned employee, existing approval grant and all
owner `evidenceReject*` labels. The confirmation sends only the public reason,
exact revision, confirmation and deterministic command key. Edited physical
facts, replacement photos and approval acknowledgements are never submitted.
Original evidence is retained; no verification, custody, asset or reward effect
is claimed. The returned persisted REJECTED record and decision basis are
validated; malformed replies keep the confirmation/error visible without retry.
An interrupted EVIDENCE_ONLY command uses original-actor recovery, and audit
presentation uses reviewedBy without inventing a verifier. Customize owner copy
and typed presentation only, never permissions or eligibility in the browser.
Route, client and audit tests cover scoped action visibility, normal approval
holds, reason-only transport, owner refusals, malformed responses and recovery.
Native acceptance remains separate. Canonical policy is documented in
`wasteVerification/llm/contracts/review-workspace.md` in the backend repository.

Completed EVIDENCE_ONLY decisions omit the verified-facts editor and feedback
entry form. Original item properties, photo, saved public reason, outcome status,
evidence-only basis and existing audit remain visible without implying a physical
verification occurred.

Fresh review detail may include `notificationDiagnostic`. Axis validates the
registered classification, bounded plain message and attempt before rendering
it as a warning. Unknown/malformed sidecars remain hidden. It is not delivery or
retry authority; no private Communication request or service credential enters
the browser. eWaste owns human scope, exact source binding and runtime transport.
Diagnostic decoration does not discard unsaved drafts on equivalent refresh.

Opening a selected review always reads exact owner detail, even when the queue
already supplies a descriptor. The read is bound to selection, persisted revision
and current authority; object decoration and equivalent bootstrap refreshes do
not restart it. A returned newer revision is accepted without a fetch loop.
Recovery/evidence-rejection availability is consumed only after that read, never
from queue decoration. These derived fields do not reset unsaved drafts; changed
persisted content or authority still does. Closing/reopening reads fresh detail,
and missing, stale, mismatched or failed detail keeps decisions disabled.

Review and settlement confirmations render failed mutation messages inside the
active confirmation dialog, preserving the selected decision until cancelled or
explicitly resubmitted. No automatic mutation retry occurs. Settlement responses
use the owner's `settlementMessage`; `BLOCKED` and `PENDING` render as warnings,
not a successful review-save banner. Settlement-only retry reports completion
only for `COMPLETED`; missing or unknown status remains unconfirmed. Backend
messages remain the domain-copy customization path, and owner permissions,
diagnostic retry admission, revisions and idempotency keys remain unchanged.
`WasteManagementRoutePage.test.tsx` covers owner copy, warning/success severity,
missing-status recovery and visible confirmation errors.

Axis validates bounded owner status/copy and uses owner `reviewWorkspace.labels`
keys `outcomeNotification` and `outcomeRetry`. Missing/malformed summary or missing
copy fails closed: no invented PENDING, metadata fallback or retry action.
Historical completed records can show NOT_ESTABLISHED with the owner's explanation;
only explicit `retryAllowed === true` admits Retry, never a private review key,
decision status, local blacklist or nested diagnostic flag. This is presentation,
not authority: current owner permission/scope/original-command checks remain.
Existing UNCERTAIN reconciliation remains separate. Canonical
UNCONFIGURED status remains visible and non-retryable; it must not be
relabelled NOT_ESTABLISHED. A lost reconciliation acknowledgement preserves the
dialog's original decision/reason/revision for an explicit retry; the owner
recognizes exact recorded decisions without sending again. An explicit
notification retry clears the previous action notice, reloads the authorized
record and retains the latest diagnostic. No automatic retry or command replay
is introduced. Focused route tests cover blocked reward recovery and one explicit
pending notification retry across equivalent bootstrap refresh.

Axis renders the authenticated eWaste review queue and explicit review decisions.
The eWaste endpoint checks the operator permission before resolving original
private evidence through Media or returning a legacy/sample image URL. Axis
accepts JPEG/PNG/WebP inline evidence, explicitly marked PUBLIC_MEDIA SVG images,
and HTTP(S) preview URLs without embedded
credentials. It never forwards the employee token to an image host, uses no
referrer for preview images, and identifies illustrative records as samples.

Keep source records, owner checks, decisions and reward settlement in the backend.
Project customization uses backend presentation/permission contracts and the
existing module connection discovery; do not copy a queue URL as an authorization
fallback. Missing/denied evidence leaves the preview unavailable.

Focused acceptance: `test/wasteManagement` covers explicit confirmation,
rejection feedback, failed decisions, sample previews, unsafe URL rejection and
authenticated evidence access. Browser checks must cover both original uploads
and legacy sample previews against the effective backend.

Waste Operations now includes the consolidated dashboard and backend-declared
Electronics/Clothing views. Cards, activity buckets and outcomes use exact scoped
server counts. Date, family, collection centre, city/area, channel and handling
size filters share the review query. The activity chart exposes UTC boundaries.

`WastePropertyDetails` presents canonical materials/components and typed physical
and environmental corrections. The existing review command confirmation and
independent verifier/approver permissions remain authoritative. Read-only final
records show reviewed properties and public feedback. Empty Clothing views do
not imply that a deployment has activated clothing collection or reward policy.

Image evidence review uses the backend `evidenceReview` projection. The queue
highlights manual approval holds; the detail panel shows the source assessment
and reason. Approval of flagged evidence requires a fresh explicit acknowledgement
inside the confirmation dialog. Cancel, record changes and reopening the dialog
reset that acknowledgement. Axis cannot clear a hold or declare an automated
caller human. The backend enforces permission, principal type, revision and
idempotency and retains the approval audit on the resulting asset.

Customer projects customize labels through
`wasteMaterial.descriptor.imageEvidence`; keep its owner-enforced manual-review
requirement. Focused `test/wasteManagement` cases cover the highlight, disabled
approval before acknowledgement, cancellation reset and command propagation.
A successful component test does not replace a connected Axis browser check.

Dashboard anchors retain a collapsed `WasteRefinementPanel`. Submission and review
views use `WasteSearchPanel` inside the reusable `AxisSearchPanel` instead of a
separate refinement card. Both compose the same `WasteRefinementFields`. Their
expand/collapse controls support keyboard access; badges and summaries reflect
applied refinements only. Folding preserves draft inputs. Apply and Clear
continue using the parent query state, including fixed family constraints. The
expanded grid adapts from one to four columns and uses backend-provided labels.
Customize spacing through theme/presentation composition, without changing query
ownership or introducing a separate filter store.

Audit history is an on-demand accordion with a bounded, keyboard-focusable scroll
region. Each opening refreshes the authorized owner response; closing during a
request invalidates its response, and later completion cannot reopen the panel.
Errors remain inside the panel and reopening retries. Empty states show a zero
count. Missing reviewer/date fields do not produce dangling separators. The
shared layout uses consistent card gutters and fixed-height filter controls with
persistent labels; it is reused by generic and accelerator-declared views.

Waste Management and Electronics are the canonical dashboard destinations. Their
backend owners publish only operational children, without duplicate Overview
links. Dashboards, Submissions and Review Queue expose the same full filter set in
`WasteRefinementFields`: dates, waste family, collection centre, area/city, channel
and handling size. Dashboard mode adds totals and one activity chart. A fixed
accelerator family remains visible but cannot be edited or cleared. Legacy
Overview bookmarks redirect only when the exact owner, available dashboard and
backend binding are present in authorized navigation. No alias grants access or
creates menu entries. Partner dashboards keep their own backend contribution.

## Reusable submission listing

`WasteSubmissionList` accepts a composed search panel and owns paginated rows,
visible authorized thumbnails and expandable read-only summaries. It accepts the
owner's records, taxonomy, labels and callbacks; it contains no Electronics or
Clothing catalogue. `WasteSubmissionDialog` provides the accessible desktop dialog
and full-screen mobile host. The route retains one editor and the existing
permission, revision, confirmation and recovery commands. Opening details keeps
the list mounted, preserving its scroll and expansions. Close/Escape/backdrop use
the same unsaved-edit guard; cancellation preserves edits and discard restores
saved facts. Failed detail reads disable verification/approval until reopening
successfully loads the record.

All submissions, Electronics submissions and review queues reuse these components.
A future accelerator contributes an authorized `reviewWorkspace.views` entry with
its own module owner, view mode and optional fixed family. No route-prefix inference
or new frontend view registry is needed. For a presentation customization, wrap
`WasteSubmissionList` with the same typed callbacks and supply labels through the
owner's `waste.reviewWorkspace.labels` configuration; compose spacing/colors through
the theme. Do not copy the editor or move review policy into a row component.

Export reads every matching page through the existing scoped owner query, retaining
applied search/status/refinements and the fixed family. It exports only list-visible
business fields, without private images or authentication data. CSV cells escape
quotes and neutralize formula prefixes. A failed page, changed total or duplicate
record aborts the download. This is a live paginated export, not an atomic database
snapshot; an owner paging limit or access failure is shown as an error rather than
a partial file. Large background/snapshot exports require an owner contract.

Focused tests cover explicit modal entry, read-only summaries, dirty cancellation,
discard/reopen, reviewer permissions, independent approval, flagged evidence,
custom labels and a contributed clothing family, as well as all-page export and
failure/formula cases. Connected checks cover both current submission routes,
search/status, expansion, close/reopen, export and mobile overflow.

## Unified submission search

`WasteSearchPanel` combines text search, status, export and expandable advanced
fields in one `AxisSearchPanel`. Text search uses a 300 ms debounce; Enter applies
the text immediately. Advanced Apply submits the draft fields together with the
current text. Status and chip removal retain other applied criteria. Folding
preserves drafts; the badge/chips describe applied criteria only. Clear all clears
text, status and optional draft/applied fields while retaining the backend-declared
family or review-queue scope. Export is disabled while text is awaiting application
or results are loading, and always uses the displayed applied query.

If a query fails after workspace authorization succeeds, the search remains usable
for correction or Clear all. Results and counts are discarded; the list shows an
unavailable state rather than claiming an empty result. Context/owner failures
still remove the unavailable workspace. Friendly field/chip labels share
`wasteFilterChoices`; domain fields and parameters remain governed by Waste.

Customize the shell using [shared search guidance](../../app/search/README.md);
configure labels through `waste.reviewWorkspace.labels` and `dashboardLabels`.
The clothing fixture proves the adapter requires no category-specific screen.

## Claim before reviewing

Opening detail shows a read-only preview. The fixed dialog header displays the assignment and a prominent owner-labeled claim action. Only a successful canonical assignment response for the signed-in employee unlocks permitted property, feedback and review controls. Pending, failed and conflicting claims remain read-only; failures appear inside the dialog. Applying an assignment preserves the open dialog, and closing it refreshes list counts/filters. Other employees cannot release or edit the assignment.

Return to queue is disabled while local changes exist; save or discard them first. Verification hands the record back to the queue, so the next decision requires a fresh claim. Combined-role staff retain both permissions; separately verified facts and configured separate-approver requirements remain authoritative. Completed records keep their properties read-only, while existing recorded-command and settlement recovery remain separate operations.

Equivalent authenticated bootstrap and owner-row refreshes preserve unsaved names,
property edits, customer-visible feedback and the authorized detail image. They
still refresh the canonical operations context and scoped page; retained editor
state is not an authorization cache. Only identical persisted review content is
retained, ignoring object/key order and derived detail decoration. Changed record
content/revision, assignment, effective permissions or verification policy resets
the draft and confirmation proof. Changed employee, credential, session admission
generation, tenant, enterprise, project, BackOffice authority or discovered owner/
navigation binding retires the private editor and evidence. App supplies the
existing employee session `generation` as `sessionGeneration`; standalone hosts
must do likewise when an admission can change without unmounting the workspace.
The optional default supports hosts whose logout/admission lifecycle unmounts it.

Evidence follows its selected record/reference and current read permission, not
bootstrap object identity. Changed or denied evidence clears the preview; stale
evidence responses cannot restore it. Failed scoped page/context refresh removes
the editor rather than retaining unqualified data. Authority, effective grant and
record changes also retire pending assignment/verification/decision/notification
responses: no stale completion can restore a draft, show success or initiate a
follow-up read. A retired command may already have reached its owner; this UI
guard neither cancels a committed command nor authorizes an automatic retry.
Equivalent refreshes retain pending explicit commands without replaying them.
Read invalidation is monotonic: effect cleanup increments the live generation,
never restores a captured generation after intervening manual refreshes.

`WasteManagementRoutePage.test.tsx` reproduces the original equivalent-refresh
draft loss and covers dirty-release/discard, preview retention, real authority
changes including same-token admission, fresh permission and same-revision fact/
assignment drift, failed refresh recovery and late evidence/command responses.
Overlapping manual refreshes and token/bootstrap replacement cannot admit a
retired private queue or trigger its evidence reads while fresh context is pending.
Customize labels through the existing owner presentation contract, never by
weakening scope, verification, assignment, confirmation or revision checks.

Customize the header copy through the owner's `waste.reviewWorkspace.labels` (`readOnlyMode`, `assignmentRequired`, `assignedToYou`, `assignmentOwned`, `assignmentElsewhere`, `assigning`, `releasing`, `assignmentSaved`, `releaseSaved`, `releaseDirty`, `reviewComplete`, `completedReadOnly`). `WasteSubmissionDialog.header` is a presentation slot, not an assignment store or permission authority. Focused `WasteManagementRoutePage` tests cover read-only entry, delayed/failed/unconfirmed claims, other assignees, release/discard, owner labels and persistent dialog state.

Impact assessments preserve provider/dataset provenance and previous results. Axis uses the backend-authorized assessment endpoints with explicit reasons, confirmation and exact asset revisions. Customer asset details show the accepted environmental assessment and paginated read-only history. CO₂e-to-tonnes conversion is carbon equivalent, not credit issuance; existing reward balances remain separate.
