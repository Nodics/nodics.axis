# Content Experience

Axis renders the existing CMS Designer model and owner commands. CMS retains
employee admission, enterprise/Catalog/Site ownership, versioning, publication
readiness and independent approval. No permission grants or schema registry live
in this feature.

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
