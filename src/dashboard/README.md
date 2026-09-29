# CMS-Governed Dashboard

## Framework business Overview

`axis:core-v010` selects `layout: framework` on Overview only. Applications and
Technical, including every shared component they reference, are preserved from
v008. `AxisFrameworkOverview` is a separate renderer with isolated queries; it
does not call application initialization or operational repair APIs.

Business outcome: see current accessible business records, reach domain
dashboards/workspaces directly, and review an authorized Process work sample.
The v010 page, workspace and Overview tab have new stable identities so old
Overview associations cannot survive as extra sections after upgrade. Applications
and Technical reuse their exact existing identities and composition. V009 is
retained unchanged as an immutable release; use v010 for publication.

This is the first evidence-backed business Overview, not a new analytics engine.
CMS owns six sections, order and copy. Domain titles, icons, hierarchy, help and
destinations come from authenticated BackOffice navigation. CMS `excludedGroups`
controls placement only. A new authorized business group appears without a
frontend domain-name switch. Disabled, preview, hidden, unavailable, orphaned,
cyclic and context-dependent routes are excluded; an unavailable parent cannot
leave executable children. Workspace cards expose two direct views and a complete
keyboard-accessible drawer, with search across the directory.

CMS `navigationRefs` selects headline record snapshots by exact `module:id`.
Metrics bind only to an authorized owner-declared Workbench target, using its
existing schema discovery/query APIs and totalCount. Fixed-filter and create-only
targets are excluded rather than counting a broader scope. No client-inferred
schema, arbitrary CMS query, endpoint, currency sum or fake history is permitted.
Counts are accessible record snapshots, including authoring content, not business
outcome KPIs or published totals. Domain-specific revenue, delivery, recycling and
customer-activity measures require canonical owner aggregates before addition.

Process uses the existing typed operations summary and a CMS-selected authorized
task navigation reference. Queues, status bars and incidents are explicitly
bounded samples (up to 25 per owner query), never organization-wide totals or
claims of personal assignment. Status samples are not historical trends. Exact
task navigation/filtering is deferred until the owner advertises that contract;
Overview opens the current authorized queue without fabricating URL parameters.
Failure is distinct from empty data, retry is explicit, and query identity includes
principal, tenant, enterprise and connection. This page is read-only: no activation,
imports, credential changes, approval decisions or repairs occur here.

Customization: later CMS releases may reorder/remove sections, select other
existing metric references or exclude presentation groups. Preserve context copy.
New owners contribute navigation through normal capability registration, not an
Axis registry or customer bootstrap service. New outcome/time-series metrics must
extend the owning API and typed client; do not convert sampled lists to totals.
Deployment follows renderer deployment, Staged import and governed Process/Online
publication. No customer files or runtime configuration changes are required.

Focused verification: `frameworkOverviewModel.test.ts`,
`AxisFrameworkOverview.test.tsx`, existing dashboard tests, and backend
`axisFrameworkOverview.test.js`. Cover owner discovery, authorization/ancestor
rejection, later-module extension, reference validation, safe count binding,
empty/failure/retry, navigation, responsive layouts and unchanged other tabs.
Ownership review: PASS for Axis renderer/client presentation and backend Axis CMS
data; no domain authority, project configuration or new persistence was introduced.
Live acceptance is separate from source tests. Optional inactive domains must not
be activated merely to populate the Overview.

Local acceptance (2026-09-26): v010 imported all 37 records successfully,
validated its 61-dependency page graph, and reached Online through the normal
Process approval. The published graph excludes all legacy Overview associations.
Browser checks covered directory search, the labelled drawer, navigation to
Editorial and agreement with its record count, desktop/mobile screenshots and
390px horizontal-overflow checks. Applications and Technical retained their
existing sections and presentation. The focused suite passed 77 frontend tests,
3 backend contract tests, type-check and scoped lint. This is local evidence,
not production, inactive-domain or full-framework analytics acceptance.

## Visual Technical presentation

Backend `axis:core-v008` selects `presentation: visual` only for the Technical
operational tab. The client rejects arbitrary presentation names and visual
presentation on summary layouts. Existing compositions and Overview are unchanged.
The same owner clients, section order, evidence and repair policies are reused.

Visual treatment adds ratio rings to the four live signal tiles, a labelled
readiness status strip, responsive stage and workspace grids, business next actions
and direct workspace navigation without expanding technical evidence. Zero totals
and unavailable metrics do not claim a completion percentage. Recent recorded
readiness checks are expanded by default; no synthetic trends are invented.
Section shortcuts use CMS section titles. Blocker details, dry runs, confirmation,
repair eligibility and receipts retain their existing behavior.

Deploy this renderer before the governed Staged/Online dashboard publication.
Customization remains an inert CMS property on an operational tab; never copy
data fetching into another registry or add customer-specific UI configuration.
Tests cover presentation rejection, legacy preservation, direct actions, disclosure
without mutation and complete blocker access. Verify narrow and desktop layouts,
unavailable evidence, keyboard navigation and explicit repair confirmation.

## Complete merged sections

`axis:core-v007` adds Operational pulse and restores the artwork catalogue in
Applications. Search and category filters apply to that single catalogue; cards
retain descriptions, backend status, media ownership and the setup-plan drawer.
Environment guidance, publication progress, attention and documentation remain.
Operational pulse is the last visible section, after Documentation & guidance.
The six operational boxes reuse authenticated BackOffice readiness evidence and
authorized workspace links. Missing evidence remains unavailable, never healthy
or zero by assumption. Overview and Technical are unchanged.

Deploy the client allowlist before importing and publishing v007 through the
normal Staged/Process/Online flow. Customize section visibility and order only
through later governed CMS releases. When merging tabs, regression tests must
compare both source compositions, not just the destination's old sections.
Route tests cover all six boxes, filtering, setup continuation and read-only
behavior together. Retaining a second duplicate application list is unnecessary.

## Complete Applications journey

`axis:core-v006` corrects the incomplete v005 merge. Applications retains every
original setup section: environment notices and remediation guidance, the full
searchable application/service catalogue with owner artwork and status, and the
URL-backed setup-plan drawer with its authorized continuation action. Summary,
publication progress, attention and separate documentation guidance supplement
that journey. v007 subsequently restores the image-card presentation as the single
filtered catalogue, with the same setup journey rather than a duplicate list.

Technical retains its existing runtime signals, recovery, blockers, workspaces,
receipts and timeline. Overview is deferred for a future framework-wide dashboard;
this release deliberately does not redesign it or change its published composition.
Do not treat the v005 operational Overview as an accepted future design.

Customize composition through later backend CMS releases. Install v006 in Staged
and publish the dashboard route through normal Process approval. No customer
configuration, backend authority or frontend renderer changes are needed. The
complete-applications regression verifies preserved descriptions, filtering,
setup requirements and continuation without mutations. Backend tests compare
against all original Applications references and keep Technical/Overview unchanged.

## Unified Applications view

The immutable backend Axis `core-v005` release merges application metrics,
search/category controls, one artwork card catalogue, publication progress,
attention and the existing setup drawer into Applications. Documentation remains
a separate guidance section and never contributes to application counts.
The catalogue section provides filters without a duplicate list when the CMS
also selects the artwork section. Filters affect cards, not whole-catalogue
summary counts. Attention and cards open the same URL-backed review drawer;
viewing, filtering and reviewing never install or publish anything.

Overview restores the existing operational dashboard through the CMS tab's
allowlisted `layout: operational` property, reusing the technical renderer and
owner clients instead of copying its logic. Technical overview remains available.
This is an interim restoration, not the future Framework Overview design, and
does not alter the System & Integrations workspace. Existing approved compositions
keep their current layout until the new release is installed and published.

Customize tab/section order and visibility through a later governed CMS release.
The client never borrows sections from another tab or invents missing sections.
Unknown layouts fail visibly. Focused composition and route tests cover the new
layout, one catalogue, filtering, shared review and read-only navigation. Backend
`axisApplicationsDashboard.test.js` checks the graph and immutable checksums.

The dashboard route resolves authenticated CMS content using the same delivery
client, contract validation and renderer registry as other managed Axis pages.
It must not mount a native dashboard as an unavailable-CMS fallback.
The framework Axis data module owns the composition in its immutable
`core-v003` release: one workspace, three tabs and fifteen section records.
CMS chooses the default tab (Overview in the source release), tab labels,
descriptions, section headings, presence and ordering. A removed tab is not
recreated for a URL parameter. Unknown composition fails visibly.

The incremental `core-v004` release adds Operational pulse and Documentation &
guidance. Documentation profiles (DOCUMENTATION or DOCUMENTATION_BUNDLE) never
contribute to application metrics, distribution, preview strip or application
catalogue. Blocked, rejected, retired and rolled-back publications require
attention rather than appearing to be actively preparing.

Operational pulse consumes the authenticated BackOffice operational-readiness
report, including its assessment timestamp, next actions and
expandable blockers. Links require an exact authorized navigation match.
The CMS operations section's bounded `areas` object selects owner evidence
keys, display titles and numeric summary fields with their labels. New cards
need a real existing owner field; missing or nonnumeric values render as
unavailable, not zero. Numbers are snapshots, not time series.
An absent report is not a healthy system. No new health polling, registry,
installation authority, business-volume statistics or synthetic history exists.
The configuration action list is severity ordered with keyboard-expandable
guidance. It does not silently acknowledge notices or update credentials.

Overview contains current-state metrics, a manually controlled application
preview strip, a labelled readiness distribution and an attention list. No
historical activity or trend data is fabricated. Unavailable/stale responses
are excluded from verified counts and shown explicitly. Optional offerings
with unmet prerequisites are not automatically selected for installation.
Preparation progress uses owner-reported step evidence, not static plan length.
Application images reference existing owner Media records. The owning application's
`data/backoffice/applicationVisualData.js` selects `mediaCode` and `alt`, consumed
through existing profile composition. BackOffice adds the effective profile target
runtime role. It does not fetch media or expose raw storage paths and credentials.
Only the status response can set `visual.active`: setup must have started and
required module activation evidence must be current. A catalogue-only descriptor
is inactive. Axis uses status-owned artwork, not bootstrap-only references, and
shows one shared Nodics fallback before activation or when status cannot be verified.
`public/brand/application-fallback-v1.png` is a generated neutral modular-system
illustration, not an accelerator preview. This frontend-owned recovery asset is
the sole static default; application-specific pictures remain owner Media data.

CMS records select installed allowlisted workspace/tab/section renderer kinds.
They never contain credentials, API endpoints, executable code or operation
permissions. Interactive controls, responsive styling and typed data binding
remain installed frontend renderer behavior. BackOffice remains authoritative
for profiles, runtime state, permissions and governed operations.
Publish later layered CMS records to customize composition; no Kickoff
configuration or duplicated frontend catalogue is required.

Deployment: install `axis:core-v004` into WCMS Staged through Data Releases,
review the dashboard page graph, request governed publication, and approve it
through the normal authorized Process journey. Import alone does not change
Online. Preserve the original baseline; do not patch Online or auto-publish.
Until publication, the previously approved CMS dashboard remains visible.

The Applications tab renders the authenticated BackOffice application catalogue.
Search and category filtering are presentation only. No hardcoded accelerator or
category list is permitted. Technical diagnostics are lazy-loaded on their own
tab, so first entry does not load every registry, release and documentation query.

Review opens an accessible drawer. `offering`, `category` and `view` URL parameters
preserve review context across reload/back navigation; they do not persist business
selection or authorize installation. The drawer renders `profile.setupPlan` version
1 from BackOffice and uses current initialization status separately. Missing plan
or status remains explicit. A successful publication is labelled Published, not
full business readiness. Continue uses the authorized setup navigation route and
focuses its `profile` parameter. Reading or navigating never starts installation.

Customization: an owning backend profile supplies a new title, category,
requirements and preparation steps through existing layered configuration; no
dashboard edit is needed. BackOffice's `setupPlan` member can supply further inert
stages. Axis accepts bounded stage/item fields and strips arbitrary extra fields.
For renderer changes, extend this feature through normal frontend composition;
do not introduce a second dependency resolver or readiness store in React.

Status refresh preserves the open review and runs only in the foreground.
Optional `presentation.visual: { mediaCode, alt }` on the owning application profile
adds a compact thumbnail and review-panel preview. BackOffice projects it as
`profile.visual` with its target `runtimeRole`; both typed clients discard invalid
references and legacy raw URLs. Axis selects that role from authenticated Media
connections, never an arbitrary runtime or hardcoded server port. The typed client
reads `/v0/content/:mediaCode` using the employee bearer and enterprise header,
omits cookies, rejects redirects/non-images and caps binary previews at 8 MiB.
Requests time out and are cancelled on source/principal changes or unmount. Blob
URLs are revoked and an old principal's image is never shown after a scope change.
Missing/unimported/denied media or an unavailable owner retains the shared fallback;
there is no external stock-photo fallback, automatic import or publication.
Existing Media policy is authoritative. Staged previews do not imply Online
readiness. New offerings use the same contract without frontend brand mappings.
Hosting must permit the registered Media endpoint in connect-src and blob: in
img-src; no new third-party image host is needed.
Drawer focus, Escape, responsive width and reduced-motion preference are handled
by the existing MUI components. Unknown offerings render an unavailable state;
missing authorized setup navigation removes the continuation action. Configuration
notices are read-only here; owner-specific editors are separate work.

Focused checks: `test/dashboard/dashboardComposition.test.tsx`,
`test/dashboard/AxisDashboardRoutePage.test.tsx`,
`test/dashboard/AxisTechnicalDashboard.test.tsx`, and the setup client/plan tests.
Verify desktop and narrow layouts, search, category selection, drawer focus,
deep-link reload, failed status, retry and focused continuation. Backend execution,
approval decisions and fresh-schema setup require separate integration acceptance.

## Technical overview

`/dashboard?view=technical` retains the same BackOffice-owned readiness models,
registry/release clients, publication queries and repair eligibility checks. The
route has one page heading; the technical renderer must not add a second shell or
dashboard heading. A four-column summary becomes two columns on narrow screens.
Connection counts are module connections, not server counts. The footer separately
reports observed runtimes. Publication readiness is not full business readiness.

Ordered recovery rows, blocker summaries and operational workspace rows replace
the old nested cards and resizable overview sidebar. Evidence is collapsed by
default and uses keyboard-operable disclosure buttons with linked expanded state.
Long owner identifiers and evidence values wrap without changing page width.
The first five blockers are shown initially; Show all exposes the complete report,
not just the old eight-item slice. Keep owner order/severity and exact evidence;
do not infer dependency order or repairability in a presentation extension.

Workspace navigation stays available while its evidence is collapsed. Expanding
rows never executes a repair. Backend-advertised repair eligibility still gates
dry-run/execution, execution requires confirmation, and receipts/errors remain
visible after the response. Unavailable query signals retain their warning.
The refresh control reloads catalogues and publication queries; runtime/readiness
snapshots remain supplied by the authenticated bootstrap and its existing refresh
lifecycle. Reported action counts can overlap across sections and are not a count
of distinct required installation steps.

Customization: adjust `TechnicalDisclosure` and `TechnicalEvidence` presentation
in `AxisTechnicalDashboard.tsx`, using the Axis theme and ShellIcon. Extend data
through the existing typed BackOffice contract, not a project-specific server list
or frontend registry. Tests protect collapsed/default behavior, Enter activation,
complete blocker disclosure, unavailable repairs, dry-run receipt rendering,
cancelled execution, and retained owner evidence. Validate light/dark desktop and
mobile layouts, especially expanded long identifiers and repair buttons. These UI
checks do not certify backend recovery or application go-live.

## Publication and attention presentation

The overview keeps publication progress and attention as unframed adjacent
sections on wide screens, stacked on smaller screens. The chart has a fixed
diameter; aligned legend rows include proportional tracks and tabular counts.
Counts, labels, section visibility and repair guidance still come from the
existing CMS and readiness contracts. Empty catalogues show a dash, not a
fabricated zero-percent publication result.

Configuration findings use native keyboard-accessible disclosures with severity
accents. Each application attention row is one full-width review button when the
existing review callback is available; otherwise it remains read-only. Long names
and diagnostics wrap without moving the fixed-size icons outside the row. No new
navigation, configuration policy, readiness calculation or backend action is
introduced. Customize spacing and theme-based colors in `AxisOverviewDashboard`,
and copy/composition through the owning CMS records. Focused tests protect review
dispatch, read-only behavior, repair guidance and empty chart semantics; visual
checks cover desktop/mobile alignment and disclosure expansion.

## Shared fallback asset

Documentation cards always use `public/brand/documentation-cover-v2.png`, a shared
Axis-owned decorative illustration. They never consume application artwork,
activation evidence or a Media connection. Published, pending and unavailable
packs retain the same cover. The existing CMS documentation section still controls
visibility, copy and ordering; backend navigation still governs actions. Cards
reserve 168px image height and stack at narrow widths. The empty alternative text
avoids repeating the adjacent pack title to screen readers. Customize the shared
cover in the frontend asset layer, not through accelerator data or a per-pack map.
`AxisOverviewDashboard.test.tsx` protects this invariant even when documentation
metadata advertises active application media.

The original documentation cover was generated using the built-in image generation
tool on 2026-09-26. Version 2 edits that image to show populated reference pages
with headings, diagrams, instructions, a table and code, rather than blank pages.
The printed content is illustrative, not authoritative Nodics documentation.
The generated output is copied unchanged; the versioned URL avoids stale browser
caches. Original generation prompt:

> Use case: stylized-concept. Create one finished raster illustration for the shared header image on Nodics Axis documentation cards. Every documentation pack will use this same neutral image, independent of any accelerator or application. Wide landscape approximately 2.5:1, safe center crop to 2:1. Premium restrained 3D studio render: an elegantly open white reference book with layered pages at the center, flanked by a small stack of closed graphite and white manuals and a golden-yellow upright page tab, with one muted teal bookmark. Clear readable silhouette at thumbnail size; tactile paper edges and matte covers; subtle physically grounded shadows on a light neutral gray studio surface. Compact centered arrangement filling the center 65 percent, viewed from a clean slightly elevated three-quarter angle. Palette porcelain white, charcoal graphite, Nodics golden yellow, tiny muted teal accent. Visually consistent with polished modular enterprise software illustrations, quiet and professional. No text, lettering, logos, icons, UI, people, industry-specific objects, gradients, orbs, glow, or watermarks. The book must be the unmistakable main subject.

Version 2 edit prompt (reference: `documentation-cover-v1.png`):

> Edit the reference image only. Preserve the wide approximately 2.5:1 landscape composition, open book geometry, stacked graphite and white manuals, yellow page tabs, teal ribbon bookmark, neutral gray studio background, lighting, paper texture, camera angle and professional restrained 3D photographic style. The open book currently has blank pages, which incorrectly suggests empty documentation. Replace both visible blank pages with richly populated, beautifully typeset technical and business reference documentation printed onto the curved paper in accurate perspective. Left page: heading 'Architecture', short subordinate headings, several compact paragraphs and a clear modular architecture diagram with connected rectangular nodes, dark graphite lines with small teal and golden-yellow accents. Right page: heading 'Implementation Guide', numbered instructions, a modest configuration table, and a compact code example on a faint neutral panel. Include small running headers and page numbers. Arrange content with professional margins, crisp hierarchy and balanced density, recognizably substantive documentation at thumbnail scale. Small body copy may be unobtrusive typographic texture; avoid large garbled text. This is an illustrative reference manual, not an actual screenshot or claim about a product's exact architecture. No blank main pages, no oversized text outside the books, no floating graphics, no people, no additional objects, no watermarks. Keep the closed book covers plain.

`public/brand/application-fallback-v1.png` was generated with the built-in image
generation tool on 2026-09-26. It is a generic Axis recovery asset, not application
data. The source output was copied unchanged into the frontend repository.

Final generation prompt:

> Use case: stylized-concept. Create a finished raster asset for the shared fallback image on Nodics Axis enterprise application cards. This is a neutral placeholder before an application is activated, NOT an image of any particular industry or product and NOT a logo redesign. Wide landscape composition, approximately 2.5:1, safe for center cropping to 2:1. Sophisticated precision 3D studio render of a compact interconnected modular system: a small cluster of interlocking architectural cuboids and thin rectangular plates, some matte porcelain white, some charcoal graphite, with a few restrained Nodics golden-yellow faces and one muted teal accent. Elegant isometric perspective, clean physical geometry, crisp edges, subtle ambient shadows, soft light neutral gray studio background. Main composition centered and distributed horizontally, fills the center 65% of the frame so it remains legible at small thumbnail sizes. Quiet premium enterprise software visual, restrained, polished, tactile, balanced contrast, not flashy. No text, no lettering, no logos, no UI mockups, no photos, no people, no city buildings, no clothes, no electronics, no spheres or orbs, no gradients, no glowing circuitry, no watermark. This image should feel intentionally designed, not like a blank placeholder with a favicon.
