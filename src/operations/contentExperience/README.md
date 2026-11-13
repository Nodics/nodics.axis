# Content Experience

Axis renders the existing CMS Designer model and owner commands. CMS retains
employee admission, enterprise/Catalog/Site ownership, versioning, publication
readiness and independent approval. No permission grants or schema registry live
in this feature.

Creation and saved-page editing use mutually exclusive disclosure panels. Opening
one closes the other while keeping both mounted: language content, local ordering,
validation, original command references and inspection holds survive the switch.
The saved-page library is primary; exact-code lookup stays collapsed unless the
library fails, is empty, or is not admitted. Disclosure changes never issue a
business command or bypass the parent's existing pending/inspection fences.
Customize layout in these existing components, retaining mounted draft state and
the same owner operations. Route and saved-panel tests cover draft retention and
the separate exact-lookup path; responsive/live acceptance remains separate.

The saved-page panel uses only the advertised `listDraftPages` and
`getDraftComposition` owner operations. Its library cache is partitioned by the
opaque actor scope and exact connection, enterprise, Catalog and Site. A failed
library is not an empty result; exact authorized page lookup remains available.
Opening is read-only. Each supported content block retains its own type,
placement, properties, translations, SEO and Media identities. Adding and moving
blocks remains local until explicit validation and save. Existing blocks are
never silently removed by omission. Unsupported owner graphs or missing inert
controls stay read-only.

The owner source stamp accompanies saved-page edits. Validation applies to the
exact local composition; editing invalidates it. Translation edits become DRAFT,
and shared-field edits invalidate entered translation readiness. A save outcome
holds editing until a fresh explicit owner read, including after an acknowledged
save. After a failed save, inspection is displayed separately and retains the local
content; selecting the saved version requires an explicit local-discard action.
Failed inspection retains the hold. Commands are never retried. Library
selection is held while there are local changes, with an explicit local discard.
Collapsing the panel retains its local state. Publication is separate, requires
an unchanged reopened saved draft and validates saved readiness in CMS. The source
stamp is optimistic preflight, not an atomic multi-record transaction.

The saved-page panel locks competing creation and retirement commands while busy
or awaiting inspection, including when collapsed. Synchronous local attempt guards
prevent duplicate dispatch before pending state renders. An uncertain publication
cannot be resolved by a CMS page read: the panel retains its hold and offers only
an independently authorized Publishing inspection link with the admitted source.
A confirmed publication retains its exact request link and cannot be submitted
twice from the same saved-page view. These controls do not grant Publishing access
or infer an approval outcome.

While a draft has unsaved edits or the saved-page panel has an operation awaiting
inspection, Axis asks before navigating to another page and enables the browser's
warning for a reload or tab close. Keeping the page preserves the current edits.

The new-page form also holds validation/save/publication after a failed save.
Its explicit inspection reads the attempted page's original Catalog/Site and code.
Only HTTP 404 with owner code `ERR_CMS_00088` releases that hold and requires fresh
validation; a generic 404, denial, unavailable or malformed response never does.
A saved result directs the user to the existing-page editor, preserving the
new-page hold. Retired view callbacks cannot release a later scope's hold. This
inspection performs no writes and never repeats the save.

Saved-page and failed-save component tests cover distinct block types, sibling
and translation identity preservation, local reordering, unknown outcomes, View
and unsupported graphs, typed absence and retired read callbacks. The route test
also proves that a failed new-page save holds all commands until exact owner
inspection without replaying the PUT.

Designer metrics require available ACTIVE/PREVIEW bootstrap navigation with the
matching Workbench target. Only those owners are queried; a healthy connection
alone does not authorize discovery. Without authorized targets, no metrics
requests or empty readiness cards are rendered. Step links likewise require
authorized navigation.

Designer selects the catalogue's `WCMS_STAGED` / `STAGED` role using the existing
connection selector, never a deployment server name or a legacy runtime fallback.
An absent or unavailable authoring role sends no Designer request. Tenant, owner
instance and endpoint identify the model query cache.

The CMS model's permitted `operations` independently gates validation, saving and
publication submission, both in buttons and mutation callbacks. Missing operations,
a failed owner read or an ongoing refresh disables writes. Refreshed authority
does not discard the local draft or replay mutations. Submission requests normal
Publishing governance; it never approves a publication.

Only the CMS `result` response envelope is consumed. Contradictory success flags,
error collections and malformed operation lists reject even on HTTP 200. This
does not trigger schema discovery or automatic command retries; drafts remain local
for inspection after uncertain failures.

Customize declarative defaults, references and permitted operations through CMS.
For a project-specific visual change, extend the existing route component while
retaining its typed client, navigation admission and command checks. Do not infer
authority from group names, add schema grants or introduce another editor registry.

`test/operations/contentExperience/ContentDesignerRoutePage.test.tsx` covers
View/missing/partial authority, successful authoring, permission removal without
draft loss, declared runtime selection and bounded authorized metrics.
`test/operations/contentExperience/contentDesignerClient.test.ts` covers owner
envelope failures, malformed authority and no fallback/replay. The existing responsive MUI layouts
are unchanged; consolidated typecheck, tests and visual verification are release
gates, not implied by source readiness.

This screen exposes draft validation/save, publication submission and the existing
CMS retirement commands: `deleteSection` for a placement, `deleteComponent` for a
shared component and `detachMedia` for an association, never the Media asset. The
retirement section intersects the owner presentation with fresh permitted operations;
View/Edit never gain controls from presentation metadata alone. No generic delete
path, permission string or new lifecycle is introduced.

Retirement uses an exact existing record code and the currently selected Site and
Catalog. Review pins the command, identity, connection and scope; changed authority
or scope disables confirmation. CMS still resolves and enforces the actual persisted
ownership. The review states Catalog-wide component reuse and that references are
not cascaded. This is not an impact-query result or an automatic record inspection.
The owner checks and retires its current version when the confirmed command arrives;
there is no added optimistic revision or transactional contract.

A matching inactive record and integer version are required for success. Success
clears earlier draft validation/save/publication readiness without discarding the
draft. An uncertain result retains the reviewed target, sends no replay and requires
explicit acknowledgement of owner-record inspection before a separate new review.
Publication remains independently governed and historical versions remain intact.

`ContentDesignerRetirementPanel.test.tsx` and `contentDesignerClient.test.ts` cover
the three exact transports, View/Edit denial, scope/authority drift, record evidence,
inspection acknowledgement and no replay. The route regression covers mounting and
stale-readiness invalidation. These are regression sources, not execution evidence.
Historical immutable documentation remains unbound and protected; it is not a
blocker for these scoped current-authoring controls.

A failed Designer model read offers an explicit GET-only Retry content setup action and keeps local draft entries. Empty template/component/slot references never appear as satisfied readiness checks; incomplete setup is described as incomplete rather than successful default loading.

The page draft editor renders only bounded, inert text, multiline and card controls
from the current CMS component-kind descriptors. It preserves typed values per
Catalog/Site/template/type and language, leaves absent translations blank, and
projects only declared properties. Required headings and card details hold
validation; CMS independently enforces the same content constraints before writes.
Explicit Catalog owners scope templates, slots and types in the selector.
Validation/save acknowledgements bind to the submitted draft and opaque actor/scope
partition, so editing during a pending command cannot validate/save the later draft.
Content setup refresh preserves entered content and reloads permitted operations.
Card add/reorder/remove is local editing until an explicit CMS save.

Language review is an explicit local action. Each entered translation remains
DRAFT until the user marks that language ready. Its review binds to the exact
entered/shared values and section order; edits invalidate that review. Save still
accepts unfinished drafts, while publication submission requires reviewed
translations. Switching the editing language never changes the route locale.

The CMS-projected route locale controls the web address independently of the
editing language. A configured shared/default route supports the existing Online
locale overlay; the UI does not invent locale fallback rules.

Publishing detail routes inspect a native lifecycle request by exact code and
explicit available source workspace. They show only owner-confirmed state,
versions, dependencies and audit history, with no inferred zero counts across
runtimes. A Designer submission keeps the bounded publication/workflow reference
and its submitted source workspace for direct request and approval handoffs.
These links do not grant lifecycle access, and inspection remains GET-only.

New drafts start with an empty required page code rather than an existing Home
identity. Clearing the web address keeps it empty instead of restoring a hidden
default. Draft preview, publishing diagnostics, retirement and inventory use
progressive disclosure; authorized generic inventory reads start only when the
user opens Content inventory, independently of CMS business authoring access.

The request inspector also composes explicit owner-declared retry/rollback and
retained in-flight withdrawal controls. It intersects permission-filtered ACTIVE
navigation actions with nonpersistent owner-read `operatorOperations`; missing,
ambiguous or mismatched declarations offer no command. This is independent of
API token/group/permission admission and approval. Preparation rereads the exact
source/request and requires unchanged root/source/state/revision. Explicit
confirmation sends that publication revision once to its declared owner route.
Rollback review includes its bounded retained predecessor; normal retry
revalidation is never presented as approval or Online delivery.

Unknown/contradictory responses require a later fresh inspection before another
explicit preparation. No command is automatically replayed or granted service
credentials. Actor/source keys retire reads and acknowledgements; permission or
owner-evidence changes disable prepared controls and retire delayed private
receipts. Source/request edits and refresh are held during the command. Success
shows the exact positive owner acknowledgement and refreshes read evidence; the
source workspace and website remain the delivery verification surfaces.

Explicit request selection records its admitted source coordinates and code in
the URL. Back/Forward remounts the private inspection scope; neither navigation
nor restoration replays a command. Request codes being typed are local drafts.
Editorial requests offer the existing canonical article-search handoff only
when one healthy admitted Staged source matches the originating publication.
The link opens the current working article, which may differ from historical
copy. Missing, denied or ambiguous metadata offers no guessed source link.
Recorded target versions describe the request, not current public delivery.
Customize labels through owner navigation and layout through this feature;
retain exact-source qualification and the existing Workbench deep-link contract.

The owner may supply the bounded inert `presentation` form projection, including
page-name and continuation copy. New pages use the existing `page.name` field for
the readable library name; identity and web address remain explicit. A confirmed
creation holds further creation saves for that exact actor/source/Catalog/Site/page
identity, including if the form changes while the save is pending. Later local
form entries remain mounted. **Continue with saved page** selects only the
acknowledged creation identity and makes one exact GET in the saved editor; it
does not replay creation or publication. No longer admitted Sites never fall
back to another Site. Without saved-read authority, the compatible first-save
publication path still uses the owner's actual saved-readiness check.

Saved-page local changes also hold competing creation and retirement commands.
The saved block editor omits repeated section headings while retaining its named
content regions and owner field labels. The create form keeps its section
headings. Unknown creation results require exact original inspection; only typed
authorized absence releases a creation attempt. Publication is attempted once
per view and retains its admitted source and request for inspection, including
when its acknowledgement is lost. Retirement cannot clear that publication hold.
The route, saved-panel, content-editor and typed-client tests cover these
continuation, authority, draft-retention and no-replay boundaries. Scope/session
retirement and native acceptance remain independent release gates.

Customize labels through `cms.designerAuthoring.presentation`, preserving the
owner's complete bounded projection. Extend the existing `initialSelection`
hand-off only after an explicit user continuation and an actor-bound receipt;
never use it as a route-triggered command, arbitrary cross-owner lookup or draft
merge. Alternate compact field layouts retain named content regions and explicit
validation/save. Business/backend semantics remain in CMS's Designer contract.

The continuation's automatic GET uses a query with the exact private actor/source
and selected page identity. It does not start a mutation in a mount effect:
Strict Mode can detach that mutation observer during mount rehearsal and leave a
completed read falsely pending. Mount rehearsal shares one GET; a newly opened
continuation checks the owner even if an older result is cached. Focus and
reconnect do not refetch it. The confirmed query supplies the initial saved base;
local edits override that base without an effect copying data over a draft. Manual inspection and uncertain
save/publication recovery retain their separate controls. Pending reads,
validation, saves, publication requests and competing operations have visible
status messages. The route regression runs the real Strict Mode lifecycle,
requires one exact GET and verifies that saved fields become editable.

Designer reference choices come from the current scoped CMS model. A deployment
default outside the returned Catalog choices is not offered as a selected target,
and empty Catalog, Website and template choices remain disabled. Missing choices
never invite business users to guess record codes. Refresh is a GET-only setup
inspection; it neither provisions content nor submits a draft. Customize reference
data and defaults through CMS, preserving the existing admission and command
fences. The route regression covers an empty enterprise with unrelated project
defaults; live business-site authoring remains a separate acceptance check.

Generic inventory cards report read availability as Checking availability,
Available or Unavailable. Header totals count available reads, not published
content. Publication state still comes from its owning CMS/Publishing contract;
no inventory count or successful HTTP read establishes Online delivery.
Content Overview and its focused views partition count results by the current
actor and tenant. An unavailable owner is distinct from an available inventory
with zero records. Retry counts rereads only the current view, and Designer and
Experience Studio shortcuts require available, admitted navigation.

Experience Studio selects only the authenticated STAGED wcmsExperience connection;
there is no runtime-name or Online fallback. Its authorized tabs come from bootstrap
navigation. DEFAULT/\* is the reusable initial target; project sample identifiers do
not belong in the UI. Preview and status share the entered journey, keyed by session
generation, tenant, enterprise, exact connection and shell Site/locale/channel.
Editing context retires the preview observer; late results cannot become current.
Status counts are bounded observations and are refreshable GETs. Empty is distinct
from fallback, and provider failures retain useful prerequisite guidance. HTTP401
uses the existing App session lifecycle;403 remains local. Later frontend layers
may customize presentation while retaining owner selection, context retirement and
these evidence labels. The ExperienceStudio route/client tests cover these seams.

Private preparation is admitted only from the authorized Staged owner's ACTIVE lifecycle action. The adapter uses fixed owner operations and exact journey correlation. No automatic preparation or retry follows save, import, timeout or refresh. Uncertain commands stay held for owner inspection and exact pending retirement; a completed preparation still requires an explicit Run preview. Frame supplies normal operation guidance.

The guided placements panel keeps website/page selection, existing scoped targeting, nested saved content and explicit private preview together. CMS returns nesting limits and compatible renderers; wcmsExperience returns configured target choices and exact revisions. Known typed content fields are customizable through the owning module; frontend presentation may wrap the components without adding targets, permissions or publication authority. Advanced record editing remains explicitly collapsed.

Content and placement commands preserve unknown outcomes for inspection and never retry automatically. Scope changes retire private query data. The preview displays inert textual content and nested structure, not a pixel-exact storefront renderer. Validate default and denied states, nested English/Arabic edits, stale sources, equal-priority conflict, confirmation, failed acknowledgement and recovery. The dedicated SavedPagePanel, guided Experience and owner client tests protect this customization seam.

Declared required content fields expose field-local invalid state and associated
Framework-owned CMS guidance after blur or an explicit validation attempt. Saved-page
validation focuses the first missing field and does not send an incomplete request.
Correcting a field clears its presentation error; optional blank translations still
use the owner-described default-language fallback. CMS remains the validation and
persistence authority for complete drafts.
