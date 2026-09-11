# Waste review workspace

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

Customize the header copy through the owner's `waste.reviewWorkspace.labels` (`readOnlyMode`, `assignmentRequired`, `assignedToYou`, `assignmentOwned`, `assignmentElsewhere`, `assigning`, `releasing`, `assignmentSaved`, `releaseSaved`, `releaseDirty`, `reviewComplete`, `completedReadOnly`). `WasteSubmissionDialog.header` is a presentation slot, not an assignment store or permission authority. Focused `WasteManagementRoutePage` tests cover read-only entry, delayed/failed/unconfirmed claims, other assignees, release/discard, owner labels and persistent dialog state.

Impact assessments preserve provider/dataset provenance and previous results. Axis uses the backend-authorized assessment endpoints with explicit reasons, confirmation and exact asset revisions. Customer asset details show the accepted environmental assessment and paginated read-only history. CO₂e-to-tonnes conversion is carbon equivalent, not credit issuance; existing reward balances remain separate.
