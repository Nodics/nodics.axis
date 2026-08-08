# Documentation Content In Axis

Axis renders an authorized, backend-provided list of documentation products
under `/docs/*`. BackOffice aggregates the list from active module metadata;
Axis does not hardcode product tabs or maintain another registry.

- **Framework** renders the canonical `nodics.docs` content pack through CMS.
- **Swaggers** renders the active System-owned OpenAPI contract in an
  Axis-owned, searchable reference and links to the backend's standalone
  interactive Swagger UI. API descriptions are not copied into a content
  catalog.
- **Nodics Axis** renders this repository's committed documentation content
  pack through its own CMS Site and content catalog.
- A future customer project contributes its own source from its backend project
  module and supplies import-ready data from the corresponding project
  repository.

Each CMS documentation product has a separate Site/catalog pair. CMS resolves
the Site to its catalog, so Axis never adds a second catalog-routing authority.
Nodics CMS remains runtime content and route authority; nImport remains the
only content-pack installation and update authority.

## Employee Journey

1. Sign in with an authorized employee account.
2. Open **Documentation > Nodics Documentation**.
3. Axis renders the ordered source tabs returned by the secured BackOffice
   bootstrap.
4. Select a CMS product or **Swaggers**. Axis resolves the configured runtime
   connection by `connectionModule`; it never stores a second endpoint list.
5. For a CMS source, Axis asks the registered System module for that source's
   configured content-pack state.
6. When the pack is absent, an authorized administrator may select **Import
   documentation**. Axis never reads a repository or imports records itself.
7. When the pack is current, Axis requests the selected product path from the CMS endpoint supplied by
   BackOffice bootstrap.
8. CMS resolves the Site, locale, channel, route, page, template, component,
   renderer mappings, and access mode.
9. Axis validates the renderer contract and displays the declarative article.
10. Internal documentation links remain inside the authenticated Axis shell.

For **Swaggers**, Axis uses the selected source's registered System connection,
OpenAPI path, and Swagger path. Axis fetches and bounds the JSON OpenAPI
contract, then renders searchable method, path, summary, description, tags,
operation metadata, parameters, request body, response codes, content types,
schema summaries, and declared security scheme names as text through its own
components. Axis does not execute API calls from this read-only catalogue. API
operations are grouped by the Nodics module hierarchy: operation ownership
comes from the generated OpenAPI `x-nodics.moduleName` metadata, while display
names, parent modules, and group labels come from BackOffice's authenticated
module registry projection. Tags and path prefixes may help search and fallback
display, but they are not the grouping authority. This keeps the API reference
aligned with Module Health, import/export release lists, and the same
business-facing module names shown elsewhere in Axis. Module groups start
collapsed so an operator or developer can scan capability areas first, expand
only the area they need, and then open individual API operations. A search
expands matching groups so the matching operations are visible without forcing
the user to manually open every parent. The grouped catalogue does not paginate
by individual API operation, because operation-level paging hides module groups
unpredictably. Instead, Axis shows the complete matching group list and renders
operation rows only when a group is expanded or a search is active.

Only one API operation detail panel stays expanded at a time. Opening another
operation closes the previously open operation so the API reference remains
easy to scan during long Swagger reviews.

Each operation may include an **Open this operation in Swagger** action. That
link is derived from the same backend-provided Swagger path and OpenAPI
operation id, so Axis does not invent a second route contract. If the operation
does not declare a stable operation id or tag, Axis falls back to the top-level
Swagger page instead of guessing.

The backend Swagger page is opened as a separate browser page for interactive
use; it is never embedded in an iframe because Nodics correctly protects
backend pages with `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Both
routes remain subject to Nodics API exposure policy. If exposure is disabled or
the runtime is unavailable, Axis reports the failure and does not substitute a
stale copied contract.

When a newer pack version is available, Axis keeps the installed Wiki readable
and offers the backend-authorized **Update documentation** action. Labels and
empty-state messages come from the bounded backend status contract. Axis sends
only the employee bearer token and enterprise context to the registered System
endpoint and never receives local paths, credentials, manifests, source files,
or backend diagnostics.

The shared CMS navigation component supplies the searchable article index,
category grouping, audience filters, and configurable labels. Each article
supplies breadcrumb context, its table of contents, and previous/next
references. Axis owns only their responsive and accessible presentation.

The documentation-product switcher is a responsive, horizontally scrollable
segmented control. Its ordered products, labels, routes, and selected identity
come from BackOffice bootstrap; its spacing, selected state, keyboard roles,
focus behavior, and responsive presentation belong to Axis. It must remain
visually consistent across installed documentation, import/update states,
OpenAPI reference, unavailable connections, and future project products.

Refreshing a documentation URL restores the Profile-owned browser session
before resolving the same CMS path. An expired or rejected session returns the
employee to the public authentication journey.

## Nodics Axis Content Pack

Axis documentation data is directly importable and committed under
`data/core`. Its immutable release manifest is
`manifest/docs-content-pack.json`. The manifest pack identity is `nodics.axis`;
the configured nImport pack code is `axisDocumentation`; and its CMS binding is
`axisDocumentationSite` → `axisDocumentationContentCatalog`.

The pack explains project purpose, architecture and repository boundaries,
supported setup, page/template/component/renderer organization, backend
contracts and security, responsive/accessibility behavior, extension,
troubleshooting, and verification. Change the pack version whenever committed
content hashes change. A same-version checksum change is rejected by default.

Canonical authored pages live under `content/documentation`. The committed
records under `data/core` are deterministic generated projections, not an
independent documentation authority. Run `npm run docs:generate` after changing
an implemented Axis capability, then run `npm run docs:check` and
`npm run verify`. The migration register must preserve the disposition,
destination, headings, and detail evidence for every README or legacy docs
source before those transitional files are reduced or retired.

The content-pack generator is scoped with the content source at
`content/documentation/tooling/generate-documentation-content.js`. It remains
tooling, not configuration: `config` is reserved for declarative runtime values
and must not contain executable generators.

`content/documentation/navigation.json` is the only authored Axis documentation
release-version authority. Generation copies that version into CMS records,
the migration register, and the immutable release manifest. Contributors must
increment it before generating changed content and must not repair generated
version projections by hand.

The same generation pass projects every canonical navigation page into matching
CMS page, component, and route records. Route lists must never be maintained
separately. The generated manifest page and route totals therefore describe the
records that are actually importable, and `npm run docs:check` rejects any
generated route drift before a release can be accepted.

## Renderer Ownership

- `DocumentationArticlePageRenderer` owns page-to-slot composition.
- `DocumentationArticleTemplateRenderer` owns the responsive article layout.
- `DocumentationArticleRenderer` owns safe article-block presentation.
- `DocumentationNavigationRenderer` owns bounded search, category grouping,
  audience filtering, selected-route presentation, and documentation-home
  navigation.
- `OpenApiDocumentationRenderer` owns the browsable API-reference
  presentation, including module-hierarchy grouping, bounded search,
  operation expansion, and the external Swagger link.
- The typed renderer manifest and registries are the only mapping from CMS
  logical keys to Axis implementations.

The renderer accepts bounded headings, paragraphs, ordered and unordered
lists, blockquotes, code blocks, tables, and image references. It does not
execute HTML, scripts, event handlers, expressions, CMS-provided JavaScript, or
arbitrary renderer URLs. Only `/docs`, anchor, HTTP(S), and mail links are
eligible for navigation.

Code blocks use a theme-owned high-contrast surface and bounded responsive
typography. Do not use undefined palette tokens: an unresolved background with
a light foreground can make valid documentation appear blank.

Documentation links and the on-page heading index use the readable secondary
text palette with a persistent gold underline. Signature gold remains an
accent, focus, and action color; it must not be used as small text on light
surfaces where it does not provide sufficient contrast.

## Failure And Recovery

- A missing or unavailable CMS route uses the existing CMS recovery screen and
  retry action.
- A disabled content-pack capability shows configuration guidance and no
  import action.
- A missing or checksum-invalid source shows a low-disclosure unavailable
  state.
- An unauthorized employee cannot view or run content-pack operations even if
  a control is forced in the browser.
- A failed update keeps the Wiki route available and presents a retryable,
  low-disclosure failure. Import diagnostics and data reconciliation remain
  backend responsibilities.
- An immutable-release conflict tells the operator that documentation content
  changed without a new release version and directs the release owner to
  increment and regenerate the pack. Axis maps the stable backend error code;
  it never renders backend stacks, contexts, record data, or arbitrary
  diagnostic messages.
- A missing renderer, unsupported contract version, unsupported channel, or
  malformed property is rejected by the CMS render boundary.
- A disabled or unavailable BackOffice documentation contribution displays the
  standard module workspace state.
- Unsupported content blocks are not rendered.

Binary image delivery is not yet owned by the CMS delivery contract. Image
metadata is migrated and validated by `nodics.docs`, while Axis presents a
non-executable placeholder until a governed CMS/DAM binary-delivery contract
is implemented. Do not add repository file paths or ad-hoc static-file loaders
to bypass that boundary.

## Customize and extend safely

Author or extend project documentation in that project's canonical structured
source and generate its committed `data/core` content pack with
`manifest/docs-content-pack.json`. Register the pack through the Nodics-owned
documentation contribution contract; Axis discovers and renders the resulting
navigation and article blocks.

Do not hand-edit generated CMS records, add repository file readers to Axis,
create a browser import engine, or duplicate a project's documentation inside
the framework pack. Test deterministic generation, stale-pack rejection,
permissions, checksum and version boundaries, unsafe links and blocks, missing
media, import/update recovery, OpenAPI module grouping, navigation, responsive
rendering, and rollback to a previously accepted immutable release.

## Contributor Verification

Run:

```bash
npm run verify
```

The suite covers registry parity, declarative article rendering, unsafe-link
rejection, executable-block rejection, TypeScript, accessibility-oriented
markup, linting, formatting, and production build behavior.
