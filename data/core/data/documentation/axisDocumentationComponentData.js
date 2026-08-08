'use strict';

/** @description Generated Nodics Axis documentation navigation and article content. */
module.exports = {
  record0: {
    code: 'axisDocumentationNavigation',
    typeCode: 'axisDocumentationNavigationComponentType',
    renderer: 'documentation.component.navigation',
    accessMode: 'AUTHENTICATED',
    properties: {
      title: 'Nodics Axis',
      searchLabel: 'Search Nodics Axis documentation',
      searchPlaceholder:
        'Search setup, architecture, features, security, and troubleshooting',
      emptyMessage: 'No Nodics Axis documentation matches your search.',
      sections: [
        {
          code: 'discover-axis',
          title: 'Discover Axis',
          order: 10,
        },
        {
          code: 'build-and-operate-axis',
          title: 'Build and Operate Axis',
          order: 20,
        },
        {
          code: 'axis-capabilities',
          title: 'Axis Capabilities',
          order: 30,
        },
        {
          code: 'contribute-to-axis',
          title: 'Contribute to Axis',
          order: 40,
        },
      ],
      items: [
        {
          code: 'axis.overview',
          title: 'What Is Nodics Axis?',
          route: '/docs/nodics-axis',
          section: 'discover-axis',
          sectionTitle: 'Discover Axis',
          sectionOrder: 10,
          order: 10,
          audience: ['business-user', 'administrator', 'developer', 'operator'],
          summary:
            'Understand Axis, its backend boundary, supported runtime, setup, configuration, quality commands, and implemented scope.',
          searchText:
            'What Is Nodics Axis? Understand Axis, its backend boundary, supported runtime, setup, configuration, quality commands, and implemented scope. # Nodics Axis\n\nNodics Axis is the reusable Back Office frontend for a single Nodics-based\ncustomer project deployment.\n\nCanonical user and contributor documentation is authored as granular pages\nunder `content/documentation` and deterministically generated into the committed\nCMS import release under `data/core`. The retired legacy `docs/` files remain\naccounted for in the migration register after coverage, detail-preservation,\ngenerated-pack, and rendered-content gates approved their replacement.\n\nAxis is a client-side web application. It authenticates human users through\nProfile, retrieves an authorized bootstrap contract from Back Office, and then\ncalls the authoritative APIs of discovered Nodics modules directly.\n\n## Boundaries\n\n- Nodics remains the backend and API authority.\n- Axis contains presentation and interaction behavior, not authoritative\n  business logic.\n- Every customer project has an isolated Axis deployment.\n- Axis does not depend on whether Nodics runs as a monoServer or distributed\n  module servers.\n- CMS descriptors can select Axis-owned components but cannot deliver\n  executable frontend code.\n\nSee\n[Axis Architecture and Ownership](architecture-and-ownership.md) for the\nper-customer deployment model, repository responsibilities, contract authority,\nsecurity boundary, and verification expectations.\n\nSee [Frontend Technology Stack](frontend-technology-stack.md) for the\napproved tools, state ownership, styling decision, repository shape, and\ndependency-governance rules.\n\nUse the [Feature Delivery Checklist](feature-delivery-checklist.md) for\nrepository-boundary analysis, security, contract testing, accessibility,\ndocumentation placement, and completion evidence for every Axis slice.\n\nRead the\n[Axis Implementation And Documentation Contract](implementation-and-documentation-contract.md)\nfor partial-discovery rules, repository placement, required use cases, and the\nacceptance contract followed by human developers and AI tools.\n\nSee [CMS Delivery and Renderer Integration](cms-delivery-and-renderers.md)\nfor the resolved-page client, trusted renderer boundary, validation rules,\ncache isolation, and login integration.\n\nSee [Documentation Content In Axis](documentation-content.md) for dynamic\nFramework, Swaggers, Nodics Axis, and future project documentation sources;\nper-product CMS catalogs; the import-ready Axis content pack; renderer\nownership; security boundaries; and failure behavior.\n\nSee [Module Health](module-health.md) for backend-driven operational\nnavigation, the typed registry client, module and node readiness presentation,\nsecurity boundaries, responsive behavior, and extension rules.\n\nSee [Imports and Exports](imports-and-exports.md) for immutable init, core,\nand sample release discovery, validation, installation, history, security, and\nthe intentionally disabled export surface.\n\nSee [Employee Login, Recovery, Screen Lock, and Dashboard](employee-login.md)\nfor startup discovery, employee-only authentication, persistent BackOffice\npolicy consumption, protected routing, logout, and failure recovery.\n\n## Prerequisites\n\n- Node.js 24\n- npm 10 or 11\n- A local Nodics backend when integration behavior is required\n\n## Start locally\n\nStart the Nodics Kickoff backend servers in separate terminals:\n\n```bash\ncd ../nodics.kickoff\nnpm run start:platform\nnpm run start:wcms\n```\n\nInstall and start Axis:\n\n```bash\nnpm ci\nnpm run dev\n```\n\nAxis runs at <http://localhost:3100>.\n\n## Environment and runtime configuration\n\nCopy `.env.example` to `.env` and configure the local/build values there.\nThe repository includes a safe local `.env`; Git ignores it so each developer\nor deployment can use different values.\n\n```dotenv\nAXIS_BACKOFFICE_BASE_URL=http://localhost:3000\nAXIS_ENTERPRISE_CODE=default\nAXIS_CLIENT_CONTRACT_VERSION=1\nAXIS_REQUEST_TIMEOUT_MS=10000\nAXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf\nAXIS_ASSISTANT_MAXIMUM_EVENT_BYTES=65536\nAXIS_ASSISTANT_RECONNECT_WINDOW_MS=120000\nAXIS_ASSISTANT_IDLE_TIMEOUT_MS=45000\nAXIS_DEV_HOST=0.0.0.0\nAXIS_DEV_PORT=3100\nAXIS_STRICT_PORT=true\nAXIS_BUILD_SOURCEMAP=true\n```\n\nVite validates these values and generates `/axis-config.json`:\n\n```json\n{\n  "backofficeBaseUrl": "http://localhost:3000",\n  "enterpriseCode": "default",\n  "clientContractVersion": 1,\n  "requestTimeoutMs": 10000,\n  "browserSessionCsrfCookieName": "nodics_axis_csrf",\n  "assistantMaximumEventBytes": 65536,\n  "assistantReconnectWindowMs": 120000,\n  "assistantIdleTimeoutMs": 45000\n}\n```\n\nAxis loads that document and then obtains the active Profile and CMS endpoints\nfrom BackOffice\'s low-disclosure public bootstrap. Axis does not maintain a\nsecond module endpoint list.\nInvalid or unavailable configuration produces a recovery screen instead of\nattempting authentication.\n\n`.env` and `axis-config.json` are public configuration, not secret stores.\nNever place passwords, tokens, API keys, private keys, or credentials in them.\nOnly explicitly named `AXIS_*` variables are consumed; Axis does not expose\narbitrary environment variables to browser code.\n\nFor production, the generated `dist/axis-config.json` may be replaced during\ndeployment so endpoints can change without rebuilding Axis. Serve it with\n`Cache-Control: no-store`. Serve hashed assets with long-lived immutable\ncaching.\n\n## Quality commands\n\n```bash\nnpm run format:check\nnpm run lint\nnpm run typecheck\nnpm run test\nnpm run build\nnpm run verify\n```\n\nThe implemented Gold and Charcoal foundations, responsive shell, recovery\nstates, accessibility behavior, and extension rules are documented in\n[Axis Design System And Static Shell](design-system-and-shell.md).\n\nThe implemented authenticated Assistant CMS route, renderer hierarchy,\ndirect-module connection validation, and typed HTTP client are documented in\n[Axis Assistant Frontend](assistant-frontend.md).\n\nThe implemented Schema Workbench discovery, schema browser, bounded record\nlist, relationship editor, record detail, Create, Update, and governed Delete\nare documented in\n[Axis Schema Workbench](schema-workbench.md).\n\n## Current scope\n\nThe current foundation proves the frontend runtime boundary, safe startup, CMS\ndelivery/renderers, employee authentication, secured BackOffice bootstrap,\nCMS-driven login/recovery/lock pages, idle screen locking, protected dashboard\nrouting, logout, the CMS-driven Assistant workspace shell, typed Assistant HTTP\ncontracts, authenticated resumable SSE transport, isolated Assistant\npresentation state, and the CMS-driven Schema Workbench browser with\ndirect-module schema discovery, bounded record reads, and independent Address\nand Contact creation, relationship coordination, record detail, generated\nUpdate, and governed Delete. The Operations workspace includes Module Health\nwith permission-filtered navigation, module summaries, on-demand registered\nnode details, and governed refresh. Visual designers remain future slices.\n\n## Customize and extend safely\n\nUse Axis as the reusable frontend base and place customer-specific pages,\nrenderers, typed clients, theme composition, and CMS presentation data in the\ncustomer Axis project. Keep customer business services, schemas, workflows,\npermissions, and API implementations in its Nodics backend project.\n\nThe smallest extension adds one focused feature directory, one backend-driven\nnavigation or renderer contract, and mirrored tests. Do not modify reusable\nframework behavior for customer needs, hardcode backend-owned labels, create a\nparallel module registry, or move authorization into the browser. Prove\nstartup, permission, contract-version, malformed-data, failure recovery,\nresponsive and WebView, integration, regression, and production-build\nbehavior. Rollback removes the customer registration and deployment artifact\nwithout mutating Nodics-owned persisted contracts.\n',
        },
        {
          code: 'axis.architecture',
          title: 'Architecture and Repository Boundaries',
          route: '/docs/nodics-axis/architecture',
          section: 'discover-axis',
          sectionTitle: 'Discover Axis',
          sectionOrder: 10,
          order: 20,
          audience: ['architect', 'developer', 'security-reviewer', 'ai-tool'],
          summary:
            'Learn the per-project deployment model, contract authority, security boundary, documentation ownership, and verification expectations.',
          searchText:
            "Architecture and Repository Boundaries Learn the per-project deployment model, contract authority, security boundary, documentation ownership, and verification expectations. # Axis Architecture and Ownership\n\n## Decision\n\nNodics Axis is a reusable Back Office browser application deployed once for\neach Nodics-based customer project. The Axis process and the Nodics backend\nprocesses are built, started, scaled, deployed, and rolled back independently.\nOne Axis deployment must not switch between customer projects or federate\ntheir backend endpoints.\n\nThis decision keeps a clear authority boundary:\n\n- Nodics owns business rules, persistence, authentication enforcement,\n  authorization, workflows, pipelines, integrations, secrets, tenant\n  governance, runtime contracts, and module APIs.\n- Axis owns browser rendering, interaction, accessibility, responsive\n  behavior, and non-authoritative client view state.\n- Profile authenticates human users.\n- BackOffice returns the caller's authorized, browser-safe module registry and\n  compatibility metadata.\n- After bootstrap, Axis calls each authoritative module directly. BackOffice\n  does not proxy normal CMS, job, workflow, configuration, or business traffic.\n\n## Deployment model\n\n```text\nCustomer project A\n  Axis deployment A\n    -> Profile A\n    -> BackOffice A -> authorized module discovery\n    -> CMS A, Workflow A, CronJob A, and other discovered modules\n\nCustomer project B\n  Axis deployment B\n    -> Profile B\n    -> BackOffice B -> authorized module discovery\n    -> project B modules\n```\n\nAxis deployment A must never discover, select, or call project B endpoints.\nWhether a project's Nodics modules run together in `monoServer` or as\ndistributed module servers does not change the browser contract.\n\n## Contract authority\n\nAxis consumes versioned backend contracts such as OpenAPI, Profile\nauthentication, BackOffice bootstrap, permissions, schemas, and module\noperation metadata. Generated or handwritten Axis clients are consumers of\nthose contracts; they do not become contract authorities.\n\nAxis must not:\n\n- import source from the sibling Nodics checkout;\n- embed backend services or persistence;\n- reproduce authoritative validation or permission decisions;\n- execute workflows, pipelines, integrations, AI tools, or arbitrary scripts\n  in the browser;\n- store service or CronJob credentials;\n- create a second registry, schema authority, runtime loader, or endpoint\n  federation layer.\n\nClient-side validation may improve usability, but every target module must\nvalidate and authorize the request independently.\n\n## Security boundary\n\nHuman browser authentication remains separate from module-to-module and\nCronJob authentication. Axis may receive only browser-safe configuration,\nhuman-session material approved by the Profile browser-security contract, and\npermission-filtered module metadata. Passwords, access tokens, refresh tokens,\nservice credentials, and secrets must never be written to browser storage,\nURLs, logs, or telemetry.\n\nDetailed session, refresh, revocation, CORS, CSRF, CSP, and audience behavior\nwill be documented only after the corresponding backend contracts are\napproved and implemented.\n\n## Documentation ownership\n\n- This repository documents Axis installation, build, deployment, frontend\n  contribution rules, browser architecture, accessibility, and implemented UI\n  behavior.\n- The Nodics repository documents product capabilities, business-user and\n  administrator journeys, backend APIs, security enforcement, module\n  configuration, operations, and backend customization.\n- Temporary plans describe intended work only and must not be presented as\n  implemented capability.\n\n## Customize and extend safely\n\nCreate customer behavior in the customer backend project and customer\npresentation in its Axis project layer. A frontend extension may add a focused\npage, renderer, typed client, hook, and mirrored test, but it must continue to\nconsume the owning Nodics module's versioned API and permission contract.\n\nThe smallest safe extension is one new renderer file plus one typed registry\nentry for a backend-issued logical renderer key. Do not copy BackOffice\ndiscovery, create a browser module registry, move validation or workflow into\nReact, or edit reusable Nodics framework source. Prove the extension with\ncontract-version, unauthorized, malformed-payload, responsive, integration,\nand production-build tests. Rollback removes the project registry entry while\nleaving the backend authority and persisted data unchanged.\n\n## Verification expectations\n\nEvery Axis slice must identify:\n\n1. its authoritative backend owner and versioned contract;\n2. its Axis presentation and local-state responsibilities;\n3. authentication, authorization, tenant, and data-exposure boundaries;\n4. tests belonging to each repository;\n5. documentation belonging to each repository.\n\nImplementation must cover applicable positive, negative, boundary, contract,\nsecurity, responsive, accessibility, integration, recovery, and regression\nbehavior. Run `npm run verify` before release-oriented commits.\n",
        },
        {
          code: 'axis.technology-stack',
          title: 'Frontend Technology Stack',
          route: '/docs/nodics-axis/technology-stack',
          section: 'build-and-operate-axis',
          sectionTitle: 'Build and Operate Axis',
          sectionOrder: 20,
          order: 30,
          audience: ['developer', 'operator', 'architect', 'ai-tool'],
          summary:
            'Review exact package versions, state ownership, styling, repository shape, renderer organization, dependency governance, and verification.',
          searchText:
            'Frontend Technology Stack Review exact package versions, state ownership, styling, repository shape, renderer organization, dependency governance, and verification. # Frontend Technology Stack\n\n## Selected foundation\n\nNodics Axis uses one cohesive frontend application until demonstrated reuse\nand stable contracts justify extracting packages.\n\n| Concern                  | Selected technology            | Current version | Responsibility                                                                    |\n| ------------------------ | ------------------------------ | --------------- | --------------------------------------------------------------------------------- |\n| Package management       | npm                            | 11.6.2          | Reproducible dependency installation from `package-lock.json`                     |\n| UI runtime               | React / React DOM              | 19.2.8          | Axis-owned browser rendering and interaction                                      |\n| Language                 | TypeScript in strict mode      | 6.0.3           | Compile-time safety across UI and contract consumers                              |\n| Build and local server   | Vite                           | 8.1.5           | Development server and immutable production assets                                |\n| Client routing           | React Router                   | 8.3.0           | Static recovery routes and authorized application navigation                      |\n| Server state             | TanStack Query                 | 5.101.4         | Request lifecycle, caching, cancellation, and invalidation for backend-owned data |\n| Component foundation     | MUI                            | 9.2.0           | Accessible primitives and Nodics-owned tokens and components                      |\n| Styling runtime          | Emotion React / Styled         | 11.14.0/11.14.1 | Material UI styling and theme-aware presentation                                  |\n| Unit and component tests | Vitest / Testing Library React | 4.1.10/16.3.2   | User-observable frontend behavior and contract-consumer tests                     |\n| Browser test environment | jsdom                          | 29.1.1          | Browser DOM behavior in automated tests                                           |\n| Static quality           | ESLint / typescript-eslint     | 9.39.5/8.65.0   | TypeScript and React code-quality rules                                           |\n| Formatting               | Prettier                       | 3.8.1           | Consistent source and documentation formatting                                    |\n\nSupported engines and direct versions are declared in `package.json` and the\ncomplete dependency graph is locked in `package-lock.json`. Those files remain\nthe dependency authority. The table is an operator-friendly snapshot and must\nbe updated in the same change whenever a listed package version changes.\n\n## State ownership\n\n- TanStack Query owns remote server state and request lifecycle.\n- Presentation state stays close to the route or feature that owns it.\n- Backend modules remain authoritative for persisted state, validation,\n  authorization, workflows, and business outcomes.\n- Axis must not create a browser store that becomes a second copy of backend\n  registry, permission, workflow, publication, or tenant authority.\n\nA dedicated global client-state dependency may be considered only when a\nmeasured cross-feature problem cannot be handled safely by React composition,\nroute state, or TanStack Query.\n\n## Styling decision\n\nAxis uses MUI primitives, Emotion, and original Nodics design tokens. Tailwind\nis not part of the selected runtime. Commercial administration templates may\ninform information grouping only; their source code, components, assets,\nlayouts, and branding are not dependencies.\n\nThe design system must preserve keyboard operation, screen-reader support,\nresponsive behavior, reduced motion, mobile WebView compatibility, and the\nfixed comfortable workspace density.\n\n## Repository shape\n\nAxis starts as one application repository with cohesive feature boundaries.\nIt is not a mandatory monorepo. A package may be extracted later only when:\n\n1. two or more real consumers need the same stable capability;\n2. its public contract and ownership are explicit;\n3. extraction does not duplicate a Nodics backend authority;\n4. independent versioning and testing provide a demonstrated benefit.\n\nThis avoids package boundaries that add governance and release overhead before\nthe product has stable reuse seams.\n\nProduction code belongs under `src/`. Tests belong under the root `test/`\ndirectory and mirror the production feature boundaries, for example\n`src/cms/` and `test/cms/`. Test-only fixtures belong below the matching test\nfeature and must not be imported by production code.\n`config/typescript/tsconfig.app.json` strictly checks runtime source, while\n`config/typescript/tsconfig.test.json` strictly checks the\nseparate test tree.\n\n## CMS renderer organization\n\nCMS sends composition data and logical renderer contracts; Axis owns every\nexecutable renderer. Renderer source follows a strict, navigable hierarchy:\n\n```text\nsrc/cms/renderers/\n├── pages/                  # one page renderer per file\n├── templates/              # one template renderer per file\n├── components/\n│   ├── authentication/     # authentication-specific component renderers\n│   ├── dashboard/          # dashboard-specific component renderers\n│   ├── media/              # Media Management workspace renderer\n│   └── shared/             # genuinely reusable component renderers\n├── registry/               # typed logical-key mappings and contract manifest\n└── shared/                 # renderer-only types, guards, and property readers\n```\n\nDo not add a generic file containing multiple unrelated renderer\nimplementations. A new CMS renderer requires:\n\n1. one focused renderer file in the correct capability directory;\n2. one typed registry mapping from the backend logical key;\n3. one renderer-manifest entry declaring kind and supported contract version;\n4. focused tests in the mirrored `test/cms/renderers` hierarchy; and\n5. safe failure for unknown keys, incompatible versions, or invalid properties.\n\nReusable renderers are grouped by capability rather than copied into every\npage. Page-specific placement is reserved for a renderer contract deliberately\nowned by only that page. Backend data must never contain a TypeScript import,\nReact component name, executable file path, script URL, or HTML implementation.\n\nReusable interaction patterns follow the same rule. A capability such as\nschema query building, record filtering, media selection, relationship\nselection, or any later business-data picker should be implemented once as a\ngeneric Axis-owned component or CMS component renderer and then composed by\npages that need it. For example, the Schema Query Builder is a shared\nworkbench capability: Schema Workbench, Imports and Exports, and future\nschema-backed pages should reuse the same implementation instead of creating\nseparate query widgets.\n\nWorkspace title help follows the same reusable rule. Use the shared\n`WorkspaceHelpActions` or `WorkspaceHeading` primitives for page, workspace,\nand major component headings that need business context or a documentation\nhandoff. BackOffice navigation and CMS component content may provide bounded\n`help.summary`, `help.documentationRoute`, and `help.documentationFragment`\nmetadata. Axis renders the reusable info and documentation icons, opens docs\nlinks in a new tab, and must not replace those metadata contracts with\nhardcoded per-page tooltip maps. For business objects and framework-owned\ncapabilities, documentation routes should point to the canonical framework or\nmodule documentation that explains concept, implementation, lifecycle,\nconfiguration, customization, security, and verification. Short Nodics Axis\ndocumentation is appropriate only for Axis-specific UI behavior.\n\nThe content catalog may declare that a generic component is needed and may\nprovide labels, placeholders, help text, default presentation options, and a\nlogical renderer key. It must not become the query authority. Searchable\nfields, filter operators, sort rules, page-size limits, authorization, and\nexecution remain backend-owned contracts delivered by the relevant Nodics\nmodule. Axis owns the executable renderer and keeps it safe, typed,\nlocalized, responsive, and reusable.\n\n## Dependency decision rule\n\nBefore adding a frontend dependency:\n\n1. reuse an installed capability when it satisfies the requirement;\n2. compose or extend an existing Axis pattern when safe;\n3. document why the current stack cannot provide the capability;\n4. review bundle, security, maintenance, accessibility, browser, WebView, and\n   licensing impact;\n5. add focused tests and update this decision when the architectural stack\n   changes.\n\nAxis must not add a dependency that executes backend business processes,\nstores secrets, downloads executable CMS code, or creates an alternate\ncontract authority.\n\n## Customize and extend safely\n\nExtend the stack through a focused project-owned feature directory, existing\nReact and TypeScript composition, shared theme tokens, a typed backend client,\nand mirrored tests. Prefer an installed dependency or existing pattern; when a\nnew package is necessary, document its exact supported version, browser and\nWebView impact, bundle cost, security and licensing review, and upgrade and\nremoval procedure.\n\nDo not fork the application shell, create another state or API authority,\ndownload executable CMS code, or hide business rules in components. Verify\ntype safety, lint and formatting, accessibility, narrow and touch layouts,\ncontract rejection, integration behavior, bundle output, and clean removal of\nthe extension.\n\n## Verification\n\nUse:\n\n```bash\nnpm ci\nnpm run verify\n```\n\nThe verification gate checks formatting, linting, strict TypeScript,\nunit/component tests, and the production build.\n',
        },
        {
          code: 'axis.design-system',
          title: 'Design System and Application Shell',
          route: '/docs/nodics-axis/design-system',
          section: 'build-and-operate-axis',
          sectionTitle: 'Build and Operate Axis',
          sectionOrder: 20,
          order: 40,
          audience: ['designer', 'developer', 'business-user', 'ai-tool'],
          summary:
            'Understand authentication layouts, design foundations, shell structure, responsive states, accessibility, recovery, and extension rules.',
          searchText:
            "Design System and Application Shell Understand authentication layouts, design foundations, shell structure, responsive states, accessibility, recovery, and extension rules. # Axis Design System and Application Shell\n\n## Implemented scope\n\nAxis provides a responsive recovery workspace, CMS-composed employee\nauthentication experience, and authenticated dashboard shell. It contains no\nbackend business logic and does not infer permissions.\n\nThe implemented visual foundation uses Nodics Gold for focus and primary\nactions, Charcoal for structural surfaces and text, and restrained semantic\ncolors for success, information, warning, and error states. Panelix informed\nfunctional grouping only; no template source or visual asset was copied.\n\n## Authentication layout\n\nThe implemented login, recovery, and lock-screen template follows a two-zone\nenterprise authentication pattern:\n\n- desktop and tablet layouts at or above the medium breakpoint use a\n  60-percent Charcoal showcase panel and a 40-percent calm white form\n  workspace;\n- the showcase uses the reverse Nodics Axis lockup, Gold emphasis, a short\n  platform narrative, and configurable highlights;\n- the form workspace limits content to 440 pixels for readable field lengths;\n- brand, introduction, form, assistance, and legal content remain separate CMS\n  slots;\n- mobile webviews hide the decorative showcase and retain the complete\n  employee authentication journey in one column.\n\nThe layout pattern was informed by the approved external reference, but colors,\nlogo treatment, typography, spacing, content, accessibility, and React\nimplementation follow the Nodics Axis style guide. No source code, imagery,\nsocial-login behavior, registration journey, or branding was copied.\n\nRecovery uses the same composition with a concise reset introduction, one\nemployee identifier field, primary action, and return-to-login assistance.\nScreen lock uses the in-memory employee identifier, one password field,\nprimary unlock action, and explicit sign-out alternative. Lock content is\nauthenticated CMS composition and is never available from public delivery.\n\nImplemented foundation values include Gold `#FEC400`, Charcoal `#25292C`, app\nbackground `#F5F6F7`, border `#DDE1E5`, and the guide's semantic colors. Gold\nremains an action surface with Charcoal text; it is not used as warning status\nor normal text on white.\n\n## Foundations\n\n- Light and dark color modes.\n- A fixed comfortable workspace density.\n- Responsive typography and spacing.\n- Consistent borders, surfaces, action sizing, and elevation.\n- Visible keyboard focus.\n- Reduced-motion behavior through the operating-system preference.\n- Semantic success, information, warning, and error colors.\n- Forty-four-pixel icon-button targets for touch and mobile WebViews.\n\nAppearance choices remain in application memory. They are not identity,\ntenant, or backend configuration and are deliberately not persisted yet.\n\n## Shell structure\n\nThe shared authenticated shell provides:\n\n1. an expandable desktop navigation rail, compact icon-only desktop rail, and\n   temporary mobile navigation drawer;\n2. synchronized navigation search in the expanded left rail and top bar, an\n   optional backend-advertised Axis Assistant shortcut, quick-create\n   placeholder, My Work, notifications, context information, color mode, and\n   employee menu;\n3. a top-bar information popup showing the backend-reported environment,\n   tenant, configured enterprise, CMS Site, and CMS Catalog;\n4. employee lock and logout actions;\n5. a top-bar light/dark icon toggle;\n6. the main workspace region;\n7. bordered workspace panels;\n8. empty-state, notification, and confirmation-dialog primitives;\n9. loading and offline feedback.\n\nAfter authentication, Axis consumes the authorized BackOffice `catalogue`,\n`availability`, and client-safe module leases. It does not define a second\nfunctional menu authority. The local Dashboard entry is combined with\nmodule-owned navigation entries. Axis uses an explicitly supplied backend\nbusiness group first and retains the legacy category mapping only as a safe\nfallback for older compatible contributions:\n\n- `content` and `experience` become Content and Experience;\n- `commerce` becomes Commerce;\n- `core` becomes Customers and Organization;\n- `operations` becomes Process and Automation;\n- `platform` becomes Operations and Integration; and\n- unknown categories remain visible under Other Capabilities.\n\nAn owning module may also supply a same-module parent relationship,\nperspectives, localization key, required context dimensions, feature state,\nand a non-executable badge-provider reference. Axis validates the hierarchy\nagain and rejects duplicate identifiers, missing parents, or cycles even\nthough BackOffice has already validated the registration. Children are\ndisplayed directly after their parent with an accessible hierarchy level.\n`DISABLED` destinations remain visible but cannot be opened; `PREVIEW`\ndestinations carry a visible preview state; `HIDDEN` destinations are removed\nby BackOffice before Axis receives them.\n\nThe expanded and mobile navigation provides a real **Search menu** field. It\nmatches authorized destinations by business group, user-facing label, or\nowning module and filters the left panel immediately. The top-bar navigation\nsearch uses the same query state. Search never changes permissions, tenant\ncontext, or backend feature state, and a successful navigation clears it.\n\nEmployees may star a destination. Axis stores only bounded\n`moduleName:navigationId` values for **Favourites** and **Recent** in browser\nlocal storage. It never stores routes, labels, tokens, employee details,\ntenant data, record data, or backend payloads in navigation preferences.\nMalformed persisted values are discarded. Favourites and recent destinations\nremain conveniences over the current authenticated bootstrap; a missing or\nnewly unauthorized contribution disappears automatically.\n\nIncompatible modules are excluded by the bootstrap parser. Unavailable\ndestinations are disabled and degraded destinations remain visible with a\nwarning state. A navigation item with permissions not covered by its already\nauthorized module contribution is rejected rather than displayed.\n\nWhen the authorized `aiAssistant` contribution contains its `assistant`\nnavigation item, the same backend-provided label, route, icon key, and\navailability also drive the top-bar shortcut. The shortcut is absent when the\nemployee has no contribution, enabled for `UP` and `DEGRADED`, and disabled for\n`UNAVAILABLE` or `UNKNOWN`. Axis does not maintain a second Assistant route or\nlabel authority.\n\nThe current environment, tenant, enterprise, Site, and Catalog are available\nfrom the top-bar information icon. Axis presents them as a light/dark-aware\ncontext card with aligned label/value rows, clear typography, and the same\nsurface rules as other governed shell elements. The context remains\ndiscoverable on hover and keyboard focus but does not reserve a permanent\ncontext strip, because operators need the vertical workspace for forms,\ntables, API contracts, documentation, and health views. The information icon's\naccessible name includes the same context values so screen-reader and keyboard\nusers do not lose the operating context.\n\nThe desktop menu control switches between the full rail and the compact rail.\nThe compact rail retains every authorized destination as an icon with an\naccessible name and hover/focus tooltip; it does not hide or re-authorize\ncapabilities. The Nodics Axis wordmark contracts to the Nodics mark and the top\nbar and content region reclaim the released width. Reduced-motion preferences\ndisable the width transition.\n\nEach module-owned navigation entry may supply a semantic `icon` key. Axis maps\nthat non-executable key to an Axis-owned vector icon. The entry-level key takes\nprecedence over the module-level key, and an unknown key uses the governed\ngeneric module icon instead of loading remote or CMS-provided executable\nassets.\n\nDiscovered module routes currently open an explicit placeholder workspace until\ntheir dedicated Axis feature is implemented. The placeholder confirms the\nowning module and availability without inferring operations or calling\nunapproved APIs.\n\nBefore authentication, unavailable context is labelled honestly. Future\nenterprise, environment, Site, Store, and Catalog selectors must consume\ngoverned backend context contracts rather than turn their displayed labels into\nfrontend authority. Future features must compose these primitives rather than\ncreate parallel page shells.\n\nContext identifiers are retained exactly for API requests, authorization,\nquery keys, caches, and diagnostics. Axis uses the generic display-name helper\nonly to turn a validated fallback code such as `startioLocal` into readable\ntext such as `Startio Local`. The helper preserves common acronyms including\nAI, API, CMS, ID, and UI. A localized display name explicitly supplied by the\nowning backend contract takes precedence over this fallback.\n\n## Recovery states\n\nThe static recovery model distinguishes:\n\n- deployment configuration;\n- Profile identity authority;\n- BackOffice registry;\n- CMS delivery;\n- contract compatibility;\n- functional module availability;\n- authorization denial;\n- offline connectivity;\n- unexpected presentation failure.\n\nEach recovery state explains the affected boundary, whether retry is safe, and\nan optional bounded correlation reference. Axis never claims that a retry is\nsafe for an unknown backend mutation.\n\n## Accessibility and responsive behavior\n\n- The main workspace uses the `main` landmark.\n- Navigation has an accessible name.\n- Dialogs have programmatic titles and descriptions.\n- Notifications use MUI live-region behavior.\n- Controls retain visible labels and keyboard focus.\n- Navigation changes from permanent to temporary below the medium breakpoint.\n- Authentication layouts use the exact 60/40 split at and above the medium\n  breakpoint. Below it, the decorative panel is hidden and the form workspace\n  uses the full width.\n- Layouts stack on narrow screens, avoid hover-only interaction, and do not\n  introduce horizontal page overflow.\n\n## Customize and extend safely\n\n- Add new design values to the shared token module.\n- Add reusable layouts and states to the shell primitives.\n- Keep module-specific presentation inside its feature workspace.\n- Do not put permissions, workflow execution, service credentials, or\n  authoritative validation into a shell component.\n- Add functional navigation through the owning module's BackOffice capability\n  contribution. Do not hardcode module routes in Axis.\n- Keep the single local Dashboard route recovery-safe. Every other displayed\n  functional destination must come from authenticated bootstrap.\n- Keep the expanded/compact navigation and color-mode choice in application\n  memory. Only bounded favourite/recent navigation identifiers use the\n  reviewed preference store; do not add tokens, routes, context, records, or\n  backend responses to it.\n\n## Verification\n\nRun `npm run verify`. The foundation tests cover recovery variants, retry and\ncorrelation presentation, authorized navigation parsing and grouping,\nnavigation landmarks, module placeholder routing, context popup labels, employee\nlogout, Assistant shortcut capability gating, color controls,\nhierarchy validation, backend-owned groups, perspective metadata, feature\nstates, menu search, bounded favourite/recent preferences, dialogs,\nnotifications, offline\nbehavior, formatting, lint, types, and build.\nResponsive browser acceptance also covers the 60/40 authentication split at\ndesktop and tablet widths and the single-column mobile journey.\n\nThe governed-navigation acceptance was also exercised against the real\n`startioLocal` `monoServer` bootstrap. The authenticated catalogue returned\neleven permission-filtered destinations with module-owned groups,\nperspectives, context dimensions, and active feature state. Axis rendered the\nexpected business groups, menu search, favourite controls, compact\ndesktop behavior, and the temporary 390-pixel mobile drawer. Adding Content to\nFavourites stored only `cms:cms`; no route, token, context, or record data was\npersisted.\n\nAxis does not expose a comfortable/compact density switch. The comfortable\nworkspace density is the default because enterprise back-office screens need\nreadable forms, tables, documentation, and operational cards across desktop,\ntablet, and mobile WebView surfaces. If a future project needs denser screens,\nit must introduce that behavior as a governed design-system change with\naccessibility and responsive acceptance, not as an ad hoc shell preference.\n",
        },
        {
          code: 'axis.cms-renderers',
          title: 'CMS Delivery and Renderer Integration',
          route: '/docs/nodics-axis/cms-renderers',
          section: 'build-and-operate-axis',
          sectionTitle: 'Build and Operate Axis',
          sectionOrder: 20,
          order: 50,
          audience: ['developer', 'architect', 'security-reviewer', 'ai-tool'],
          summary:
            'Follow the CMS delivery, validation, cache-safety, logical renderer, and frontend implementation boundaries.',
          searchText:
            "CMS Delivery and Renderer Integration Follow the CMS delivery, validation, cache-safety, logical renderer, and frontend implementation boundaries. # CMS Delivery and Renderer Integration\n\nAxis renders CMS-managed Back Office pages without moving backend authority or\nbusiness logic into the browser.\n\n## Runtime boundary\n\nCMS owns routes, pages, templates, components, component properties, and the\nlogical renderer metadata attached to each page or component type. Axis owns\nthe executable React renderers. CMS never returns JavaScript, module paths, or\narbitrary renderer URLs.\n\nAxis obtains the CMS endpoint from the approved runtime bootstrap flow. The CMS\nclient accepts that discovered endpoint as an input; it does not invent a\nfallback URL or proxy CMS through the Axis server.\n\n## Delivery validation\n\nBefore rendering, Axis validates the complete resolved-page response:\n\n- delivery contract version;\n- site, path, locale, and channel;\n- page, template, and component renderer keys;\n- renderer major versions and supported channels;\n- required component properties;\n- component graph depth and total component count.\n\nUnknown renderer keys, unsupported versions or channels, malformed data, and\noversized graphs fail closed. A component rendering failure is isolated and\nreplaced with a safe error message. Deprecated renderer metadata is retained\nfor migration tooling; it does not allow CMS to select untrusted executable\ncode.\n\n## Request and cache safety\n\nThe delivery client:\n\n- sends bearer tokens only in the `Authorization` header;\n- never places tokens in URLs, storage, or cache keys;\n- omits browser credentials and rejects redirects;\n- supports cancellation, timeouts, `ETag`, and `304 Not Modified`;\n- separates cache keys by enterprise, tenant, site, path, locale, channel,\n  access mode, principal, and authenticated session generation.\n\nAuthenticated cache keys require principal and session identity. This prevents\none employee or tenant from reusing another user's resolved page.\n\n## Customize and extend safely\n\nCreate one project-owned renderer file in the relevant capability directory,\nregister its backend-issued logical key and supported contract version in the\ntyped renderer manifest, and add mirrored tests. Customize labels, help text,\nlayout options, and safe fragments through CMS component properties; keep API\ndestinations, authorization, validation, and business decisions in their\nowning backend modules.\n\nNever execute CMS HTML or JavaScript, accept arbitrary component imports, add a\nfallback renderer for unknown keys, or duplicate CMS route resolution in Axis.\nVerify valid, unknown, deprecated, incompatible, malformed, oversized,\nunauthorized, cached-session, responsive, and renderer-isolation behavior.\nRollback removes the later project registration and restores the prior CMS\ncomponent version without editing the reusable renderer framework.\n\n## Renderer development\n\nAdd a renderer only to the trusted Axis renderer manifest and implement it in\nAxis source. Keep the renderer declarative: component properties may influence\ncontent and presentation, but must not introduce API destinations, executable\nscripts, authorization rules, or backend business decisions.\n\nWhen a component can be reused across pages, promote it to a shared component\ncontract instead of creating a second page-local renderer. Schema Query\nBuilder is the reference pattern: the content catalog can place or configure a\nquery-builder component, and Axis can render it through a shared renderer or\nshared primitive, but the owning backend module still supplies searchable\nfields, allowed operators, sort rules, limits, and execution contracts. This\nsame reuse rule applies to future media pickers, relationship selectors,\nrecord browsers, workflow selectors, and any other repeated business-control\nsurface.\n\nRun the focused checks while changing this boundary:\n\n```bash\nnpm run typecheck\nnpm test -- --run test/cms\n```\n\nRun `npm run verify` before handing off or committing the completed slice.\n\n`/login` and `/forgot-password` are resolved from public CMS delivery. The\nlogin renderer sends employee credentials only to Profile. After Profile issues\nthe human bearer token, Axis validates access through secured BackOffice\nbootstrap before loading the authenticated CMS dashboard. Tokens remain in\nmemory and are cleared locally before logout revocation is sent to Profile.\n\nThe forgot-password page is presentation-ready, but submission remains disabled\nuntil Profile owns an approved employee-recovery API. Axis does not simulate\nrecovery or create a second identity workflow.\n",
        },
        {
          code: 'axis.documentation-content',
          title: 'Documentation Content in Axis',
          route: '/docs/nodics-axis/documentation-content',
          section: 'build-and-operate-axis',
          sectionTitle: 'Build and Operate Axis',
          sectionOrder: 20,
          order: 60,
          audience: ['administrator', 'developer', 'operator', 'ai-tool'],
          summary:
            'Understand dynamic documentation products, content-pack installation, renderer ownership, failure recovery, and contributor verification.',
          searchText:
            "Documentation Content in Axis Understand dynamic documentation products, content-pack installation, renderer ownership, failure recovery, and contributor verification. # Documentation Content In Axis\n\nAxis renders an authorized, backend-provided list of documentation products\nunder `/docs/*`. BackOffice aggregates the list from active module metadata;\nAxis does not hardcode product tabs or maintain another registry.\n\n- **Framework** renders the canonical `nodics.docs` content pack through CMS.\n- **Swaggers** renders the active System-owned OpenAPI contract in an\n  Axis-owned, searchable reference and links to the backend's standalone\n  interactive Swagger UI. API descriptions are not copied into a content\n  catalog.\n- **Nodics Axis** renders this repository's committed documentation content\n  pack through its own CMS Site and content catalog.\n- A future customer project contributes its own source from its backend project\n  module and supplies import-ready data from the corresponding project\n  repository.\n\nEach CMS documentation product has a separate Site/catalog pair. CMS resolves\nthe Site to its catalog, so Axis never adds a second catalog-routing authority.\nNodics CMS remains runtime content and route authority; nImport remains the\nonly content-pack installation and update authority.\n\n## Employee Journey\n\n1. Sign in with an authorized employee account.\n2. Open **Documentation > Nodics Documentation**.\n3. Axis renders the ordered source tabs returned by the secured BackOffice\n   bootstrap.\n4. Select a CMS product or **Swaggers**. Axis resolves the configured runtime\n   connection by `connectionModule`; it never stores a second endpoint list.\n5. For a CMS source, Axis asks the registered System module for that source's\n   configured content-pack state.\n6. When the pack is absent, an authorized administrator may select **Import\n   documentation**. Axis never reads a repository or imports records itself.\n7. When the pack is current, Axis requests the selected product path from the CMS endpoint supplied by\n   BackOffice bootstrap.\n8. CMS resolves the Site, locale, channel, route, page, template, component,\n   renderer mappings, and access mode.\n9. Axis validates the renderer contract and displays the declarative article.\n10. Internal documentation links remain inside the authenticated Axis shell.\n\nFor **Swaggers**, Axis uses the selected source's registered System connection,\nOpenAPI path, and Swagger path. Axis fetches and bounds the JSON OpenAPI\ncontract, then renders searchable method, path, summary, description, tags,\noperation metadata, parameters, request body, response codes, content types,\nschema summaries, and declared security scheme names as text through its own\ncomponents. Axis does not execute API calls from this read-only catalogue. API\noperations are grouped by the Nodics module hierarchy: operation ownership\ncomes from the generated OpenAPI `x-nodics.moduleName` metadata, while display\nnames, parent modules, and group labels come from BackOffice's authenticated\nmodule registry projection. Tags and path prefixes may help search and fallback\ndisplay, but they are not the grouping authority. This keeps the API reference\naligned with Module Health, import/export release lists, and the same\nbusiness-facing module names shown elsewhere in Axis. Module groups start\ncollapsed so an operator or developer can scan capability areas first, expand\nonly the area they need, and then open individual API operations. A search\nexpands matching groups so the matching operations are visible without forcing\nthe user to manually open every parent. The grouped catalogue does not paginate\nby individual API operation, because operation-level paging hides module groups\nunpredictably. Instead, Axis shows the complete matching group list and renders\noperation rows only when a group is expanded or a search is active.\n\nOnly one API operation detail panel stays expanded at a time. Opening another\noperation closes the previously open operation so the API reference remains\neasy to scan during long Swagger reviews.\n\nEach operation may include an **Open this operation in Swagger** action. That\nlink is derived from the same backend-provided Swagger path and OpenAPI\noperation id, so Axis does not invent a second route contract. If the operation\ndoes not declare a stable operation id or tag, Axis falls back to the top-level\nSwagger page instead of guessing.\n\nThe backend Swagger page is opened as a separate browser page for interactive\nuse; it is never embedded in an iframe because Nodics correctly protects\nbackend pages with `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Both\nroutes remain subject to Nodics API exposure policy. If exposure is disabled or\nthe runtime is unavailable, Axis reports the failure and does not substitute a\nstale copied contract.\n\nWhen a newer pack version is available, Axis keeps the installed Wiki readable\nand offers the backend-authorized **Update documentation** action. Labels and\nempty-state messages come from the bounded backend status contract. Axis sends\nonly the employee bearer token and enterprise context to the registered System\nendpoint and never receives local paths, credentials, manifests, source files,\nor backend diagnostics.\n\nThe shared CMS navigation component supplies the searchable article index,\ncategory grouping, audience filters, and configurable labels. Each article\nsupplies breadcrumb context, its table of contents, and previous/next\nreferences. Axis owns only their responsive and accessible presentation.\n\nThe documentation-product switcher is a responsive, horizontally scrollable\nsegmented control. Its ordered products, labels, routes, and selected identity\ncome from BackOffice bootstrap; its spacing, selected state, keyboard roles,\nfocus behavior, and responsive presentation belong to Axis. It must remain\nvisually consistent across installed documentation, import/update states,\nOpenAPI reference, unavailable connections, and future project products.\n\nRefreshing a documentation URL restores the Profile-owned browser session\nbefore resolving the same CMS path. An expired or rejected session returns the\nemployee to the public authentication journey.\n\n## Nodics Axis Content Pack\n\nAxis documentation data is directly importable and committed under\n`data/core`. Its immutable release manifest is\n`manifest/docs-content-pack.json`. The manifest pack identity is `nodics.axis`;\nthe configured nImport pack code is `axisDocumentation`; and its CMS binding is\n`axisDocumentationSite` → `axisDocumentationContentCatalog`.\n\nThe pack explains project purpose, architecture and repository boundaries,\nsupported setup, page/template/component/renderer organization, backend\ncontracts and security, responsive/accessibility behavior, extension,\ntroubleshooting, and verification. Change the pack version whenever committed\ncontent hashes change. A same-version checksum change is rejected by default.\n\nCanonical authored pages live under `content/documentation`. The committed\nrecords under `data/core` are deterministic generated projections, not an\nindependent documentation authority. Run `npm run docs:generate` after changing\nan implemented Axis capability, then run `npm run docs:check` and\n`npm run verify`. The migration register must preserve the disposition,\ndestination, headings, and detail evidence for every README or legacy docs\nsource before those transitional files are reduced or retired.\n\nThe content-pack generator is scoped with the content source at\n`content/documentation/tooling/generate-documentation-content.js`. It remains\ntooling, not configuration: `config` is reserved for declarative runtime values\nand must not contain executable generators.\n\n`content/documentation/navigation.json` is the only authored Axis documentation\nrelease-version authority. Generation copies that version into CMS records,\nthe migration register, and the immutable release manifest. Contributors must\nincrement it before generating changed content and must not repair generated\nversion projections by hand.\n\nThe same generation pass projects every canonical navigation page into matching\nCMS page, component, and route records. Route lists must never be maintained\nseparately. The generated manifest page and route totals therefore describe the\nrecords that are actually importable, and `npm run docs:check` rejects any\ngenerated route drift before a release can be accepted.\n\n## Renderer Ownership\n\n- `DocumentationArticlePageRenderer` owns page-to-slot composition.\n- `DocumentationArticleTemplateRenderer` owns the responsive article layout.\n- `DocumentationArticleRenderer` owns safe article-block presentation.\n- `DocumentationNavigationRenderer` owns bounded search, category grouping,\n  audience filtering, selected-route presentation, and documentation-home\n  navigation.\n- `OpenApiDocumentationRenderer` owns the browsable API-reference\n  presentation, including module-hierarchy grouping, bounded search,\n  operation expansion, and the external Swagger link.\n- The typed renderer manifest and registries are the only mapping from CMS\n  logical keys to Axis implementations.\n\nThe renderer accepts bounded headings, paragraphs, ordered and unordered\nlists, blockquotes, code blocks, tables, and image references. It does not\nexecute HTML, scripts, event handlers, expressions, CMS-provided JavaScript, or\narbitrary renderer URLs. Only `/docs`, anchor, HTTP(S), and mail links are\neligible for navigation.\n\nCode blocks use a theme-owned high-contrast surface and bounded responsive\ntypography. Do not use undefined palette tokens: an unresolved background with\na light foreground can make valid documentation appear blank.\n\nDocumentation links and the on-page heading index use the readable secondary\ntext palette with a persistent gold underline. Signature gold remains an\naccent, focus, and action color; it must not be used as small text on light\nsurfaces where it does not provide sufficient contrast.\n\n## Failure And Recovery\n\n- A missing or unavailable CMS route uses the existing CMS recovery screen and\n  retry action.\n- A disabled content-pack capability shows configuration guidance and no\n  import action.\n- A missing or checksum-invalid source shows a low-disclosure unavailable\n  state.\n- An unauthorized employee cannot view or run content-pack operations even if\n  a control is forced in the browser.\n- A failed update keeps the Wiki route available and presents a retryable,\n  low-disclosure failure. Import diagnostics and data reconciliation remain\n  backend responsibilities.\n- An immutable-release conflict tells the operator that documentation content\n  changed without a new release version and directs the release owner to\n  increment and regenerate the pack. Axis maps the stable backend error code;\n  it never renders backend stacks, contexts, record data, or arbitrary\n  diagnostic messages.\n- A missing renderer, unsupported contract version, unsupported channel, or\n  malformed property is rejected by the CMS render boundary.\n- A disabled or unavailable BackOffice documentation contribution displays the\n  standard module workspace state.\n- Unsupported content blocks are not rendered.\n\nBinary image delivery is not yet owned by the CMS delivery contract. Image\nmetadata is migrated and validated by `nodics.docs`, while Axis presents a\nnon-executable placeholder until a governed CMS/DAM binary-delivery contract\nis implemented. Do not add repository file paths or ad-hoc static-file loaders\nto bypass that boundary.\n\n## Customize and extend safely\n\nAuthor or extend project documentation in that project's canonical structured\nsource and generate its committed `data/core` content pack with\n`manifest/docs-content-pack.json`. Register the pack through the Nodics-owned\ndocumentation contribution contract; Axis discovers and renders the resulting\nnavigation and article blocks.\n\nDo not hand-edit generated CMS records, add repository file readers to Axis,\ncreate a browser import engine, or duplicate a project's documentation inside\nthe framework pack. Test deterministic generation, stale-pack rejection,\npermissions, checksum and version boundaries, unsafe links and blocks, missing\nmedia, import/update recovery, OpenAPI module grouping, navigation, responsive\nrendering, and rollback to a previously accepted immutable release.\n\n## Contributor Verification\n\nRun:\n\n```bash\nnpm run verify\n```\n\nThe suite covers registry parity, declarative article rendering, unsafe-link\nrejection, executable-block rejection, TypeScript, accessibility-oriented\nmarkup, linting, formatting, and production build behavior.\n",
        },
        {
          code: 'axis.employee-access',
          title: 'Employee Login, Recovery, Lock, and Dashboard',
          route: '/docs/nodics-axis/employee-access',
          section: 'axis-capabilities',
          sectionTitle: 'Axis Capabilities',
          sectionOrder: 30,
          order: 70,
          audience: [
            'business-user',
            'administrator',
            'developer',
            'security-reviewer',
          ],
          summary:
            'Operate the employee-only authentication journey, recovery, persistent browser session, idle lock, logout, configuration, and safe failures.',
          searchText:
            "Employee Login, Recovery, Lock, and Dashboard Operate the employee-only authentication journey, recovery, persistent browser session, idle lock, logout, configuration, and safe failures. # Employee Login, Recovery, Screen Lock, and Dashboard\n\nAxis is an employee Back Office application. Customer credentials must not be\nsubmitted to its login flow.\n\n## Startup journey\n\n1. Axis reads public deployment configuration from `/axis-config.json`.\n2. Axis calls the BackOffice public bootstrap.\n3. BackOffice returns only active Profile/CMS endpoints and Axis CMS\n   composition identifiers.\n4. Axis loads `/login` directly from CMS public delivery.\n5. Axis sends entered employee credentials directly to Profile.\n6. Axis keeps the returned access token in memory only. Profile stores the\n   refresh credential in a scoped `HttpOnly` cookie that Axis cannot read.\n7. Axis calls secured BackOffice bootstrap with the access token.\n8. BackOffice returns the effective tenant-scoped Axis employee policy,\n   authorized module catalogue, navigation contributions, compatibility,\n   availability, and client-safe environment observations.\n9. Axis constructs its shell from the local Dashboard route plus authorized\n   module-owned navigation.\n10. If authorized, Axis loads `/dashboard` from authenticated CMS delivery.\n\nA customer login is never used as a fallback. Authentication or authorization\nfailure keeps the employee outside the dashboard and displays a safe message.\n\nPassword fields on login and lock-screen pages include an accessible show/hide\ncontrol so employees can verify local typing mistakes before submission.\nRevealing a password changes only the current input presentation. Axis still\nsends the value only to Profile, never stores it, and never exposes it through\nBackOffice, CMS, URLs, logs, query cache, or browser storage.\n\n## Password recovery\n\nThe public `/forgot-password` page uses the same responsive authentication\nlayout as login, with CMS-owned introduction, identifier label, placeholder,\naction label, assistance, and legal text. Axis intentionally keeps submission\nunavailable today because Profile does not yet expose an approved employee\nself-recovery API.\n\nDo not simulate success, send identifiers to BackOffice or CMS, or build a\nfrontend-only reset path. The future Profile contract must be anti-enumeration,\nrate-limited, tenant-aware, auditable, and compatible with the existing OTP and\nnotification authorities before this form is connected.\n\n## Idle screen lock\n\nThe secured bootstrap returns `axisPolicy` after employee authentication.\nVersion 1 supports `screenLockEnabled`, `idleTimeoutSeconds` from 60 through\n86,400, the policy contract version and optimistic revision, and whether the\neffective policy came from layered defaults or persistence.\n\nAxis observes keyboard, pointer, touch, and wheel activity. Pointer movement is\nthrottled to one deadline update per second to avoid high-frequency work.\nBackground-tab timer throttling is handled by comparing the absolute deadline\nwhen the page becomes visible again.\n\nWhen the deadline passes, Axis:\n\n1. records a bounded lock marker and same-application return path in\n   `sessionStorage`;\n2. replaces it with `/lock-screen`;\n3. keeps tokens and the employee identifier in memory only;\n4. hides protected application content;\n5. asks only for the current employee password; and\n6. sends that password directly to Profile.\n\nA successful unlock receives fresh Profile tokens, reloads secured BackOffice\nbootstrap and policy, removes the lock marker, and returns to the prior\nprotected route. A failed unlock stays locked and shows a safe authentication\nerror. “Not you? Sign out” clears the marker and local session, asks Profile to\nrevoke it, and returns to `/login`.\n\nThe marker contains only `locked: true` and a validated relative return path.\nIt never contains a password, access token, refresh token, employee identifier,\nbackend response, or authorization data. External, malformed, authentication,\nand lock-screen return paths fall back to `/dashboard`.\n\nThe screen lock is presentation defense-in-depth. It never replaces bearer\nexpiry, revocation, Profile authentication, or target-module authorization.\n\nOn browser refresh, Axis reads only the non-secret CSRF cookie and calls the\nProfile browser restore endpoint with credentials included. Profile requires\nthe exact allowed Origin and matching `X-CSRF-Token`, consumes the refresh\ncredential once, rotates it, and returns a replacement access token and\nemployee identifier. Axis then reloads the secured BackOffice bootstrap and\nrestores the lock gate before protected routing. A session that was locked\nbefore refresh remains on `/lock-screen` until successful password\nre-verification; refresh cannot silently return it to the dashboard. An\nexpired, revoked, replayed, or otherwise invalid session returns to the public\nlogin experience.\n\n## Logout\n\nAxis sends the configured CSRF value to Profile, which revokes refresh state\nand expires both browser-session cookies. Only after Profile confirms that\noperation does Axis clear its in-memory access token and redirect to `/login`.\nIf Profile is unavailable, Axis keeps the secured session visible and reports\nthat logout was not completed; it never presents a false signed-out state while\nan HttpOnly refresh session remains active. The existing short-lived access\ntoken remains bounded by backend expiry and revocation policy.\n\n## Configuration\n\nThe root `.env` contains only public deployment values:\n\n```dotenv\nAXIS_BACKOFFICE_BASE_URL=http://localhost:3000\nAXIS_ENTERPRISE_CODE=default\nAXIS_CLIENT_CONTRACT_VERSION=1\nAXIS_REQUEST_TIMEOUT_MS=10000\nAXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf\n```\n\nThe CSRF cookie name is public protocol configuration and must equal Profile's\neffective `profileBrowserSession.csrfCookieName`. Do not add Profile or CMS\nURLs. BackOffice discovers them from module self-registration. Never place\npasswords or tokens in `.env`, browser storage, URLs, logs, or query-cache keys.\n\n## Failure behavior\n\n- Invalid configuration uses static configuration recovery.\n- BackOffice discovery failure uses static discovery recovery with retry.\n- Missing Profile or CMS registration fails public bootstrap closed.\n- CMS failure or incompatibility uses static CMS recovery with retry.\n- Invalid employee credentials produce a safe login error.\n- Missing BackOffice permission rejects the session before dashboard delivery.\n- Direct `/dashboard` navigation attempts Profile-owned session restoration;\n  absent or invalid refresh state redirects to `/login`.\n- Direct `/lock-screen` navigation without an authenticated locked session\n  redirects safely.\n- Refreshing a locked session restores the lock marker and requires password\n  verification before any protected route is rendered.\n- Invalid or incompatible Axis policy rejects authenticated bootstrap.\n- Persistent-policy read failure is handled by BackOffice using its safe\n  configured default.\n\nEmployee password recovery is not yet a Profile capability. The CMS page may\nexplain the process, but Axis keeps submission disabled until Profile provides\na governed, enumeration-safe recovery contract.\n\n## Customize and extend safely\n\nCustomize login, recovery, and lock-screen presentation through CMS component\nproperties and project-owned renderer composition. Add a new authentication\nview only as a focused renderer with a typed logical-key registration while\ncontinuing to use Profile's browser-session, CSRF, refresh, revocation, and\nemployee-only contracts.\n\nDo not replace Profile authentication, store tokens in browser storage, embed\ncredentials in configuration, infer authorization from the UI, or implement\npassword recovery locally. Test valid and invalid credentials, customer-user\nrejection, missing permissions, refresh restoration, locked-page refresh,\nCSRF rejection, idle boundaries, logout revocation, malformed CMS properties,\nresponsive layout, and rollback of the project renderer registration.\n\n## Verification\n\n```bash\nnpm run verify\n```\n\nTests cover low-disclosure discovery, policy validation, credential delivery\nto Profile, HttpOnly refresh restoration, CSRF transport, secured bootstrap\nbearer use, protected-route preservation after remount, invalid-session\nfallback, CMS authentication pages, inactivity boundaries, activity deadline\nreset, protected routing, and logout revocation.\n",
        },
        {
          code: 'axis.assistant',
          title: 'Axis Assistant Frontend',
          route: '/docs/nodics-axis/assistant',
          section: 'axis-capabilities',
          sectionTitle: 'Axis Capabilities',
          sectionOrder: 30,
          order: 80,
          audience: ['business-user', 'developer', 'architect', 'security-reviewer'],
          summary:
            'Learn the governed Assistant request flow, typed API contracts, resumable streaming, presentation lifecycle, evidence, accessibility, and security behavior.',
          searchText:
            "Axis Assistant Frontend Learn the governed Assistant request flow, typed API contracts, resumable streaming, presentation lifecycle, evidence, accessibility, and security behavior. # Axis Assistant Frontend\n\n## Implemented scope\n\nAxis implements the authenticated `/assistant` CMS route, dedicated Assistant\npage/template/component renderer hierarchy, BackOffice-driven top navigation\nshortcut, validated direct-module connection projection, and a typed\nprovider-neutral Assistant HTTP client.\n\nThe workspace presents backend-owned CMS content, an interactive composer,\nemployee and Assistant message surfaces, smooth streamed text, progress\nfeedback, cancellation, and safe failure presentation. The authenticated SSE\ntransport and presentation state controller drive the visible experience.\nNo browser request is sent to OpenAI, Anthropic, Gemini, or another provider.\n\n## Authority and request flow\n\n1. BackOffice authenticated bootstrap advertises the authorized `aiAssistant`\n   capability, navigation entry, availability, and client-callable module\n   leases.\n2. Axis validates those values and selects only an `UP` or `DEGRADED`\n   connection. Credentials, query strings, fragments, and non-HTTP endpoints\n   are rejected.\n3. CMS authenticated delivery resolves `/assistant` for the configured Site,\n   locale, and channel.\n4. The CMS logical renderer keys map to allowlisted Axis-owned React\n   implementations.\n5. The typed Assistant client sends the employee bearer directly to the\n   discovered `aiAssistant` module endpoint.\n6. Nodics owns authorization, validation, persistence, provider selection,\n   token governance, tools, Workflow handoff, and audit.\n\nAxis does not proxy Assistant calls through BackOffice and does not select or\ncall an AI provider.\n\n## Source map\n\n- `src/bootstrap/publicBootstrap.ts`: authorized navigation and module\n  connection validation.\n- `src/cms/renderers/pages/AssistantPageRenderer.tsx`: Assistant page slot\n  composition.\n- `src/cms/renderers/templates/AssistantWorkspaceTemplateRenderer.tsx`:\n  responsive workspace structure.\n- `src/cms/renderers/components/assistant/AssistantWorkspaceRenderer.tsx`:\n  CMS-driven workspace composition.\n- `src/cms/renderers/components/assistant/AssistantMessageTimeline.tsx`:\n  stable, auto-following activity region.\n- `src/cms/renderers/components/assistant/AssistantMessageBubble.tsx`:\n  employee and Assistant text presentation.\n- `src/cms/renderers/components/assistant/AssistantStreamingStatus.tsx`:\n  accessible non-terminal progress.\n- `src/cms/renderers/components/assistant/AssistantComposer.tsx`: keyboard and\n  touch-friendly Send and Stop controls.\n- `src/cms/renderers/components/assistant/AssistantConversationHistory.tsx`:\n  responsive conversation selection and bounded pagination.\n- `src/assistant/api/assistantContracts.ts`: provider-neutral domain contracts.\n- `src/assistant/api/assistantContractParsers.ts`: untrusted response\n  validation.\n- `src/assistant/api/assistantTransport.ts`: shared authenticated HTTP\n  boundary.\n- `src/assistant/api/assistantClient.ts`: bounded Assistant commands.\n- `src/assistant/api/assistantSseParser.ts`: incremental, byte-bounded SSE\n  framing.\n- `src/assistant/api/assistantEventStream.ts`: authenticated event delivery,\n  ordering, resume, and reconnect.\n- `src/assistant/presentation/assistantPresentationContracts.ts`: UI-facing\n  state and action contracts.\n- `src/assistant/presentation/assistantPresentationReducer.ts`: pure,\n  deterministic event projection.\n- `src/assistant/presentation/assistantQueryKeys.ts`: enterprise, employee,\n  conversation, and turn cache isolation.\n- `src/assistant/presentation/useAssistantPresentation.ts`: lifecycle\n  composition for conversation creation, turn submission, streaming, and\n  cancellation.\n- `src/assistant/api/assistantError.ts`: stable backend error and correlation\n  projection.\n\n## CMS customization\n\nThe backend component properties currently control:\n\n- title;\n- welcome message;\n- composer placeholder;\n- send and stop labels;\n- empty-state text;\n- employee and Assistant speaker labels;\n- working, cancelling, and failure labels;\n- conversation history, new conversation, empty history, and load-more labels.\n\nChanging these properties in the authoritative CMS content changes Axis after\nthe next CMS delivery without rebuilding the frontend. Axis never accepts\nbackend JavaScript, component imports, event handlers, arbitrary HTML, or CSS.\n\nLocale and channel remain part of the CMS delivery request. Renderers must\ntolerate translated text expansion and future right-to-left content. Axis does\nnot translate by parsing English text.\n\n## Typed API coverage\n\nThe current client implements only backend routes that exist:\n\n- create, list, and retrieve employee-owned conversations;\n- submit and retrieve a turn;\n- replay persisted turn events;\n- cancel a turn;\n- create, retrieve, approve, and reject a mutation confirmation;\n- execute or hand off an approved confirmation.\n\nRequests use:\n\n- memory-only employee access token;\n- validated enterprise context;\n- bounded query values;\n- abort and timeout handling;\n- `Idempotency-Key` for turn and confirmation creation;\n- no browser credentials in URLs, logs, or storage.\n\nThe event stream additionally enforces the backend contract version and event\ntypes, validates conversation and turn ownership, rejects sequence gaps,\ndeduplicates replayed events, resumes with `Last-Event-ID` and\n`afterSequence`, observes an idle timeout, and limits reconnect duration.\nAuthentication failures and malformed protocol data fail closed rather than\nbeing retried.\n\n## Presentation lifecycle\n\nThe presentation reducer keeps each conversation in a separate immutable\nrecord. It projects streamed text, status, clarification, tool planning,\nconfirmation, citations, usage, completion, cancellation, and failure while\nretaining the normalized raw events for later UI projections.\n\nDuplicate and stale events are ignored. Sequence gaps fail the active\npresentation rather than silently rendering incomplete output. Events for\nanother conversation or turn cannot mutate the active state. Resetting the\nscope removes all prior employee conversation state.\n\nThe React controller creates a conversation only when required, submits one\nturn at a time, streams its ordered events, and requests cancellation without\nprematurely closing the stream that carries the authoritative terminal event.\nIt holds no provider credentials and does not reproduce backend validation.\n\nOn authenticated entry, the controller loads a bounded employee-owned\nconversation page. Selecting a conversation loads its durable turn/message and\nstructured-interaction projection from `aiAssistant`; it does not reconstruct\nlong-term history from short-lived SSE events. Clarification, tool state, safe\nusage, citations, and confirmation lifecycle therefore survive reload. Older\nconversation and turn pages are merged without changing chronological order or\ncrossing enterprise and employee scope.\n\nBackend error `code`, safe `message`, HTTP status, and optional `traceId` remain\nstructured. Axis uses a generic fallback only when the backend supplies no\nsafe response.\n\nArchive conversation and a dedicated usage-summary screen are not yet\nimplemented in Axis. The employee-owned summary endpoint belongs directly to\n`aiProviders`; Axis must discover and call that module rather than proxying\nthrough Assistant when that screen is added.\n\n## Accessibility and responsive behavior\n\n- The page and workspace use named regions and headings.\n- Every CMS-provided action retains an accessible name.\n- The layout remains single-column and bounded on desktop, tablet, mobile, and\n  WebView widths.\n- The activity region announces additions and text updates politely.\n- Enter sends, Shift+Enter creates a new line, and buttons retain touch-safe\n  targets.\n- The timeline keeps a stable minimum height and follows new output without\n  remounting existing messages.\n- System reduced-motion preferences disable smooth scrolling and the streaming\n  cursor animation through the shared Axis theme.\n\n## Failure and security behavior\n\n- Unauthenticated access redirects to the configured public page.\n- A locked employee remains on the lock-screen flow.\n- Missing capability contribution removes the Assistant shortcut.\n- `UNAVAILABLE` and `UNKNOWN` disable the shortcut.\n- Incompatible renderers use the existing safe render boundary.\n- Malformed CMS properties fail inside the render boundary.\n- Unsafe direct-module endpoints fail bootstrap parsing before a token is\n  transmitted.\n- Backend errors do not become frontend authorization decisions.\n\n## Verification\n\nFocused coverage includes:\n\n- authenticated `/assistant` CMS delivery;\n- renderer registry and contract versions;\n- backend-driven labels and malformed properties;\n- direct module URL and employee headers;\n- fragmented SSE parsing and heartbeat handling;\n- authenticated streaming, terminal closure, replay deduplication, and resume;\n- cross-turn, sequence, contract, and payload-boundary rejection;\n- immutable presentation event projection and terminal states;\n- duplicate, stale, gap, and foreign-event handling;\n- employee and enterprise query-key isolation;\n- conversation creation, turn submission, overlap prevention, and controller\n  cleanup;\n- CMS-driven workspace copy, keyboard submission, streamed text, and\n  cancellation controls;\n- persisted multi-turn history, selection, new-conversation reset, and bounded\n  pagination;\n- idempotent turn submission;\n- input bounds;\n- stable error codes and trace IDs;\n- unsafe endpoint and path rejection.\n\nRun:\n\n```bash\nnpm run verify\n```\n\n## Structured interactions\n\nAxis renders backend `CLARIFICATION`, `TOOL_PLAN`, and\n`CONFIRMATION_REQUIRED` events through separate feature components. All visible\nheadings and action labels come from the authenticated Assistant CMS component.\nAxis does not reconstruct mutation arguments, target routes, authorization, or\nconfirmation identity.\n\nApproval and rejection return the backend-issued argument digest and\noptimistic revision. Rejection is available only before execution begins.\nExecution sends only the backend-issued confirmation code. Invalid event\npayloads fail closed; expired, stale, unauthorized, conflicting, and uncertain\noutcomes remain backend decisions and are shown through the normal safe error\ncontract. The browser never retries an execution automatically.\n\n## Evidence and operational transparency\n\nThe workspace renders the backend-issued tool lifecycle as prepared, running,\nsucceeded, or failed. Only stable tool identity, owner module, operation\nidentity, lifecycle state, and a safe failure code are displayed. Raw tool\narguments, target URLs, credentials, and result content are neither projected\nnor rendered.\n\nCitation cards display backend-issued identity, title, section, locator, and\nversion. A title becomes a link only when AI Knowledge explicitly classifies\nit as `INTERNAL_ROUTE` and supplies a validated same-application path.\nUnclassified locators and rejected external or scheme-based values remain\nplain text. Axis validates the path again and never invents navigation from\nlocator text.\n\nUsage cards display the normalized input, output, cached-input, reasoning, and\nembedding token values plus reconciliation state. Reservation identifiers are\ndiscarded. Axis does not infer cost, quota, or remaining budget. `aiProviders`\nnow exposes the separate direct, employee-owned\n`GET /operations/ai-ledger/usage/me` projection for a future budget-summary\nsurface.\n\nMalformed citation, usage, tool lifecycle, and reconciliation payloads fail\nclosed through the same event-data boundary.\n\n## Customize and extend safely\n\nAdd Assistant presentation through a new focused renderer under the Assistant\nfeature, a typed logical-key registration, and bounded properties supplied by\nthe owning CMS component. Add provider, tool, prompt, budget, knowledge, or\nbusiness-operation behavior only in the appropriate Nodics AI or business\nmodule; Axis renders the provider-neutral events it receives.\n\nDo not parse prompts into business commands, select providers in the browser,\ninvent token balances, expose tool arguments, or call unregistered endpoints.\nTest the project extension with allowed and rejected renderer keys, contract\nversions, malformed SSE events, unauthorized tool proposals, confirmation\nrevision changes, reconnection boundaries, keyboard and narrow-view behavior,\nand a production build. Removing the renderer registration is the safe\nfrontend rollback; backend conversations and audit records remain owned by\nNodics.\n\n## Known next boundary\n\nNodics now supports provider-neutral `CLARIFICATION` and\n`MUTATION_PROPOSAL` planning for confirmed enterprise creation. Axis consumes\nthe resulting clarification and persisted-confirmation events through the\nexisting renderers; it does not parse natural language into business fields.\n\nThe next boundary is local end-to-end acceptance with a configured provider:\nrequest enterprise creation, answer missing fields, inspect the persisted\nconfirmation, approve it, execute it, and verify Profile's result. This requires\nprovider credentials and usage credit; deterministic contract tests remain the\noffline acceptance authority.\n\nThe offline backend acceptance now covers the full provider-neutral\nclarification, confirmation, approval, and Profile-dispatch boundary. Axis\nseparately verifies rendering, digest/revision approval, execution controls,\nmalformed-event rejection, accessibility, and responsive behavior. A live\nbrowser journey remains intentionally deferred until provider credentials and\nusage credit are configured.\n",
        },
        {
          code: 'axis.schema-workbench',
          title: 'Axis Schema Workbench',
          route: '/docs/nodics-axis/schema-workbench',
          section: 'axis-capabilities',
          sectionTitle: 'Axis Capabilities',
          sectionOrder: 30,
          order: 90,
          audience: ['business-user', 'administrator', 'developer', 'operator'],
          summary:
            'Use and extend governed schema discovery, record operations, relationship coordination, failure recovery, responsive behavior, and verification.',
          searchText:
            "Axis Schema Workbench Use and extend governed schema discovery, record operations, relationship coordination, failure recovery, responsive behavior, and verification. # Axis Schema Workbench\n\nAxis implements the presentation side of Nodics Schema Workbench. The owning\nbackend module remains authoritative for schemas, allowed operations,\nrelationships, generated CRUD, domain operations, validation, permissions,\ntenant isolation, and persistence.\n\nBusiness-user and backend customization guidance is maintained in the Nodics\ndocumentation:\n\n- `gDocs/backoffice/how-schema-workbench-works.md`\n- `gFramework/nDatabase/database/README.md`\n\n## Implemented frontend behavior\n\nThe authenticated `/schema-workbench` route:\n\n- appears only when BackOffice advertises its authorized navigation item;\n- resolves its page, template, renderer keys, and visible copy through CMS;\n- discovers active module endpoints through authenticated BackOffice bootstrap;\n- requests safe Workbench descriptors directly from those modules;\n- lists and filters authorized data types by readable label or module;\n- loads bounded record pages through an owning-module Workbench query that\n  delegates to existing generated CRUD services;\n- searches the full authorized result set across descriptor-advertised safe\n  text fields rather than filtering only the current browser page;\n- uses the shared Axis Schema Query Builder for browsing, export preview, and\n  any future schema-backed data retrieval screen so employees learn one\n  consistent query experience;\n- sorts only by descriptor-advertised scalar fields and default sort metadata;\n- builds typed filters only from descriptor-advertised fields and operators;\n- supports bounded nested `AND`/`OR` groups with an inert JSON request preview;\n- keeps filter edits as a local draft until the employee applies them;\n- offers only backend-configured page sizes and shows the authoritative total;\n- cancels obsolete in-flight record requests when query state changes;\n- renders primary and searchable fields in a responsive record table;\n- stores employee/tenant/enterprise-scoped favourites, recents, visible\n  columns, and up to ten saved views in bounded browser storage without\n  storing records or access tokens;\n- supports current-page row selection and exposes bulk deletion only when the\n  owning descriptor explicitly advertises it;\n- requests a governed delete-impact preview before enabling final deletion;\n- consumes backend concurrency and aggregate-operation metadata without\n  inventing browser-side business authority;\n- opens a complete permitted record detail view from the record table;\n- renders schema-declared reference values through one shared reference\n  renderer used by record details, schema listing tables, and\n  navigation-scoped schema workspaces;\n- keeps the selected parent record visible when a related record is opened, and\n  renders the related record detail below the current record instead of\n  redirecting to another schema workspace;\n- opens related values from both single-value and multi-value relationship\n  fields, including list-valued references displayed in schema table columns;\n- shows Edit only when the owning descriptor advertises Update;\n- initializes Update from the selected record while excluding managed and\n  read-only fields from the mutation model;\n- sends a bounded generated Update request using the original primary identity,\n  an editable model, and `returnModified`;\n- refreshes the record list and detail view only after the owning module\n  confirms the update;\n- shows Delete only when the owning descriptor advertises it;\n- requires a modal confirmation showing record identity, authenticated tenant,\n  and enterprise;\n- sends one bounded Delete query using the original primary identity;\n- disables confirmation and cancellation while deletion is pending;\n- keeps the record and confirmation available when authorization, ownership,\n  reference integrity, or another backend business rule rejects deletion;\n- displays only the bounded backend error code/message contract and never\n  renders diagnostic contexts, records, queries, or stacks;\n- closes record details and refreshes the list only after confirmed deletion;\n- supports reusable feature handoff links using\n  `/schema-workbench?module=<moduleName>&schema=<schemaName>` to select an\n  authorized schema after discovery;\n- renders WCMS and publishing management routes such as `/content/pages` and\n  `/publishing/requests` from BackOffice navigation `workbenchTarget` metadata\n  rather than frontend-owned route-to-schema maps;\n- renders those navigation-scoped routes as focused schema workspaces, hiding\n  the global data-type browser so a selected item such as Websites, Pages, or\n  Publishing Requests shows only its own records, detail, create, update, and\n  governed delete interactions;\n- renders route-scoped business help from BackOffice navigation `help`\n  metadata, including a short summary tooltip and a documentation link that\n  opens the configured Axis documentation route in a new browser tab;\n- renders permission-filtered, state-aware lifecycle actions declared by the\n  owning backend module, including bounded text, select, hidden/default, and\n  JSON input descriptors in one reusable action dialog;\n- resolves an action against its declared owner-module connection, substitutes\n  only record/input route parameters, sends one idempotent backend request, and\n  refreshes server state after success; Axis never coordinates owner writes;\n- uses the shared Axis listing interaction pattern: employees select a row\n  from the records table and Axis renders the selected record detail below the\n  list, instead of adding a one-action View column or moving detail above the\n  table;\n- preserves the authenticated shell hierarchy from BackOffice navigation and\n  lets any parent navigation item with children expand or collapse its children\n  independently of the top-level navigation group;\n- supports `/schema-workbench?module=<moduleName>&schema=<schemaName>&mode=create`\n  only when the discovered schema advertises Create, so feature pages can hand\n  users to generic generated CRUD without duplicating record forms;\n- renders one typed field component per supported schema field type;\n- creates independent Address and Contact records through generated CRUD;\n- renders schema-declared relationship fields separately from ordinary arrays;\n- renders each relationship using its backend-declared business role, so\n  references to the same target type remain distinguishable;\n- combines backend-declared display properties in their configured order so\n  selectors show meaningful identities instead of only opaque record keys;\n- presents related records as `code - description`, truncating descriptions\n  longer than five words to the first five words followed by `...`;\n- exposes the complete description in a tooltip on pointer hover or keyboard\n  focus, including descriptions displayed without truncation;\n- selects existing related records through the target module's generated read\n  contract;\n- holds new related records as in-memory drafts until the parent is submitted;\n- creates drafted related records through their owning module and associates\n  only the returned reference property;\n- replaces a one-to-one pending related draft when the employee chooses an\n  existing related record for the same relationship, so parent save does not\n  create an unused child record;\n- prevents duplicate references in a multi-value relationship;\n- bounds nested related creation by backend-advertised depth and stops cycles\n  by falling back to selecting an existing record;\n- offers inline related-record editing only when both relationship metadata\n  advertises `EDIT_RELATED` and the target schema advertises Update;\n- retains each successfully created related reference when a later related\n  operation or parent save fails, so retry does not recreate that record;\n- keeps unsaved drafts in component memory;\n- blocks visibly incomplete required fields before submission while preserving\n  backend validation as authoritative;\n- formats dates with locale-aware browser APIs and renders booleans with\n  CMS-provided user-facing labels;\n- exposes loading, empty, unavailable, and retry states.\n\nEvery backend model that is authorized and not explicitly excluded is\ndiscoverable with generated Search, Read, Create, Update, and governed Delete\noperations. An owning schema may narrow that list. Address and Contact also\ndemonstrate the Address-to-Contact relationship editor.\n\n## Request ownership\n\n```text\nAxis → BackOffice: authorized navigation and module endpoints\nAxis → CMS: Workbench page composition and presentation copy\nAxis → owning module: schema descriptors, generated reads, and authorized writes\n```\n\nAxis does not send schema operations through BackOffice and does not maintain\nits own module registry. Access tokens remain in memory and are sent only in\nthe Authorization header. Enterprise context is sent in\n`x-enterprise-code`.\n\n## Successful behavior\n\nAn authorized employee opens Schema Workbench, selects Address, and sees the\nfirst bounded page of Address records using labels supplied by the effective\nProfile schema. The employee can open Create Address, complete required fields,\nselect an existing Contact or add a new Contact draft, and submit the complete\ndraft directly to Profile.\n\nFor Update, the employee selects a record row, chooses **Edit** when\npermitted, changes ordinary fields or relationship references, and submits.\nAxis uses the original primary identity as the update query even when the\neditable primary field changes. When the descriptor advertises required\noptimistic concurrency, the query also carries the record's advertised\nrevision. Update and Delete fail closed before sending a request if that\nrequired revision is unavailable.\n\nFor Delete, the employee opens the record, chooses **Delete**, verifies the\nrecord, tenant, and enterprise shown in the confirmation, and explicitly\nconfirms. Axis never cascades deletion and never treats a frontend permission\ncheck as final authority.\n\n## Unauthorized or invalid behavior\n\nThe route is unavailable when BackOffice does not advertise it. Modules omit\nschemas and operations that the employee cannot access. Malformed descriptors,\nunsupported operations, unsafe endpoints, invalid envelopes, and malformed\nrecords fail validation rather than being rendered. A relationship cannot\ncreate a target schema unless that descriptor advertises Create.\n\nAxis does not infer optimistic concurrency from timestamps. It sends an\neffective revision only when the backend descriptor advertises a compare-and-\nset field. Axis must never simulate stale-write protection in browser state.\n\nDelete rejection leaves the confirmation open with the safe backend message.\nAxis does not hide a reference-integrity failure, retry automatically, or\ndelete related records as compensation.\n\nThe HTTP client accepts only a bounded top-level backend message and code for\ndisplay. Structured diagnostic contexts and stacks are deliberately ignored.\nMalformed or non-JSON failures use a generic HTTP fallback. Translation must\nuse stable backend codes and CMS presentation content rather than parsing an\nEnglish message.\n\n## Boundary and responsive behavior\n\nAt large widths, the global `/schema-workbench` route uses data-type\nnavigation and records in two columns. Navigation-scoped workspaces such as\n`/content/sites` use a focused one-column record workspace because the selected\nBackOffice menu item already supplies the schema context. At smaller widths\nthey stack into one column. Record columns remain horizontally scrollable\ninstead of shrinking into unreadable content. Controls retain labels, keyboard\noperation, and semantic list/table roles.\n\n## Failure and recovery\n\nOne unavailable module does not hide descriptors successfully returned by\nother active modules. If every discovery request fails, Axis shows a safe\nretryable error. Record loading failures remain scoped to the selected schema\nand can be retried without reloading the application.\n\nWorkbench does not claim a browser-side or cross-module database transaction.\nRelated records are created sequentially during final submission. After each\nsuccessful related creation, Axis replaces that local draft with the returned\nreference. If a later related creation or the parent save fails, the form stays\nopen and the successful reference remains selected. Retrying therefore resumes\nfrom the failed step instead of creating the successful record again.\n\nFor one-to-one relationships, selecting an existing target record clears any\npending create draft for that relationship before submission. This keeps the\nfrontend draft aligned with the backend `refSchema` contract: the parent stores\nonly the selected reference value, and the owning module remains responsible for\nvalidating whether that reference is allowed.\n\nThis recovery model avoids hidden deletion and unsafe compensation. It does not\nguarantee atomic commit across modules. Journeys that require strict atomicity\nmust use a backend-owned domain operation or a transaction-capable workflow,\nnot generic Workbench coordination.\n\nLifecycle action forms keep entered evidence open after a safe backend failure\nso the employee can correct or retry it. JSON descriptors are parsed only as\nrequest data; they never execute code. Backend authorization, optimistic\nversions, maker-checker rules, Workflow decisions, Pipelines, owner adapters,\nand audit remain authoritative even when Axis hides an inapplicable action.\n\n## Customize and extend safely\n\n- Change page copy and composition through `axisContentCatalog`.\n- Change available schemas, fields, relationships, and operations in the\n  owning Nodics module.\n- Change module availability through Nodics runtime topology and BackOffice\n  registration.\n- Extend Axis with one typed renderer per new CMS component contract.\n- Reuse shared interaction components when the same behavior appears on more\n  than one page. The Schema Query Builder is a generic workbench capability,\n  not a private Schema Workbench widget. If another page needs schema search,\n  filtering, sorting, grouping, or preview behavior, compose the shared query\n  builder and feed it backend-advertised capabilities instead of creating a\n  local query form.\n\nDo not add hardcoded module endpoints, backend rules, translated business\ncopy, or alternate schema definitions to Axis.\n\n## Notifications & Messaging workspace\n\nWhen the backend advertises the `notifications-messaging` capability, Axis uses the same authenticated navigation and Schema Workbench contracts to expose Templates, Scenarios, Channels, Message Types, Providers, Provider Accounts, Delivery Logs, Attempts, Suppressions, Verification, and In-App Inbox. Axis does not contain a notification catalogue, provider list, consent rule, template lifecycle, OTP value, or delivery policy. Removing the backend capability or employee permission removes the workspace.\n\nBusiness users may traverse Channel -> Scenario -> Template or Scenario -> Channel -> Template using backend-advertised schema filters and relationships. Template preview and lifecycle operations execute only backend-declared secured routes. Real OTPs, provider credentials, raw destinations, raw provider payloads, and diagnostic stacks must never enter Axis records, browser storage, telemetry, or preview state. Provider-account forms accept secret references only.\n\nCustomer projects customize this surface by contributing higher-layer Nodics schemas, capability navigation, presentation metadata, lifecycle actions, permissions, and CMS help. Add Axis code only for a genuinely new reusable presentation contract; do not fork a channel-specific editor or duplicate backend policy. Successful, denied, suppressed, retry/recovery, maker-checker, narrow-screen, keyboard, and partial-discovery behavior remains protected by the generic Workbench and bootstrap suites.\n\n## Compliance Management workspace\n\nWhen the backend advertises `compliance-management`, Axis creates one dedicated\nCompliance Management section from the authenticated bootstrap. Compliance\ncapabilities attach their pages to that backend-owned parent instead of\ncreating separate consoles. The KYC capability currently contributes KYC Cases,\nReview Queue, Subject Status, Document Review, Policies and Requirements,\nProviders, and Compliance Audit; each page binds to its backend-advertised KYC\nschema. Future AML, sanctions, due-diligence, monitoring, or reporting modules\nmust contribute sibling pages through the same contract.\n\nAxis does not maintain the compliance catalogue. Removing the shared backend\ncapability, a child capability, or an employee permission removes the relevant\nsection, page, or action after authenticated bootstrap. Configuration and\noperational processes remain backend-owned even though authorized business\nusers manage them from this one Axis section.\n\nThe route-scoped Workbench hides the global schema picker, paginates and filters\nthrough KYC-owned APIs, and renders only fields, relations, panels, and actions\nallowed by the effective contract.\n\nCase actions are not generic record edits. Approve, reject, escalate, and\nrequest-more-information controls come from backend lifecycle metadata and call\nthe secured KYC intent route. Axis collects bounded reason inputs and supplies\nrecord identity/idempotency context; KYC rechecks authorization, scope, state,\nversion, maker-checker, policy, Workflow, persistence, and audit. Removing a\npermission or capability removes the corresponding route/action after the next\nauthenticated bootstrap.\n\nDocument Review shows masked metadata and nMedia codes only. Preview/download\nmust use an advertised purpose-bound nMedia action and be backend-audited. Axis\nnever turns a media code, provider reference, storage key, path, private URL,\nor schema value into a browser URL. Providers show readiness and a related\nexecution-policy panel; credentials, webhook keys, raw payloads, OCR,\nbiometrics, and full identity values never enter browser state, telemetry,\nURLs, or preferences.\n\nOn narrow screens and WebViews, panels stack, controls remain keyboard\nreachable, tables retain accessible labels, and high-risk actions keep explicit\nconfirmation. A backend rejection, stale state, provider outage, or network\nfailure leaves the record unchanged and shows only the safe code/message so the\nemployee can refresh, retry when allowed, or escalate.\n\nCustomer projects customize KYC through later backend modules: policy,\nrequirements, provider adapters, schemas, presentation metadata, lifecycle\nactions, permissions, and help. The smallest Axis customization is a\nproject-owned typed renderer that composes existing Workbench primitives for a\ngenuinely new presentation need. It must preserve KYC, nMedia, and Workflow\nauthority and must not fork a KYC editor, provider registry, lifecycle,\nauthorization rule, document viewer, or navigation catalogue. Removing the\nlater renderer or metadata contribution rolls back presentation without\nmutating KYC evidence.\n\n## Verification\n\nRun:\n\n```bash\nnpm run verify\n```\n\nFocused tests cover direct-module headers and paths, bounded record reads,\ncreates and updates, original-identity update queries, descriptor validation,\nbounded original-identity deletion, missing-identity rejection, explicit\nconfirmation, pending duplicate-submit prevention, authenticated tenant\nparsing, partial discovery, retryable failure, schema selection, record rendering,\nrecord selection, CMS renderer registration, required-field\nvalidation, default values, framework-managed field exclusion, selecting an\nexisting relationship, related-record creation, duplicate-reference prevention,\nretry without duplicate related creation, backend conflict-message handling,\ndiagnostic-context exclusion, malformed-error fallback, and locale-aware\nrecord formatting. Coverage also includes backend-declared lifecycle action\ninputs, JSON parsing, owner-module routing, safe route substitution, stable\nidempotency, and route-scoped schema workspaces that\nhide the global schema browser, nested shell navigation expansion and collapse,\nrevision forwarding for Update and Delete, missing-revision rejection before\nnetwork access, self-referential relationship cycle fallback, bounded nested\nrelationship depth, full description tooltips, five-word related-record\nsummaries, shared clickable reference rendering in details and tables, inline\nrelated-record details that preserve parent context, clearing stale one-to-one\npending drafts when selecting an existing target, and preserving remaining\none-to-many references when another selected reference is removed.\n\nThe authenticated local acceptance journey additionally verifies schema\ndiscovery across active modules, bounded search, unauthenticated rejection,\nraw-query rejection, advertised Create/Update/Delete visibility, readable\nEnterprise relationship labels, and `code - description` Tenant choices. The\njourney is read-only: it opens forms and selectors but does not submit a\nbusiness-data mutation.\n",
        },
        {
          code: 'axis.module-health',
          title: 'Module Health',
          route: '/docs/nodics-axis/module-health',
          section: 'axis-capabilities',
          sectionTitle: 'Axis Capabilities',
          sectionOrder: 30,
          order: 100,
          audience: ['administrator', 'operator', 'developer', 'security-reviewer'],
          summary:
            'Monitor the sanitized BackOffice module and node readiness projection without creating a browser-side health authority.',
          searchText:
            "Module Health Monitor the sanitized BackOffice module and node readiness projection without creating a browser-side health authority. # Module Health\n\n## Purpose and ownership\n\nModule Health gives an authorized employee a responsive view of registered\nNodics modules and runtime instances. Operators can see whether Profile, CMS,\nWorkflow, BackOffice, or another capability is healthy, degraded, unavailable,\nor unknown and identify the registered environment, server, and node involved.\n\nAxis does not decide health. Nodics System owns readiness and BackOffice owns\nthe sanitized availability observation and registry projection. Axis owns only\ntyped consumption, interaction, rendering, filtering, and accessible state\npresentation.\n\nAxis displays the backend-provided package label and renders the\nloader-discovered parent/child hierarchy. It never sends a label or canonical\npath as the operational identifier; detail, refresh, query keys, and\nauthorization continue using the original module name.\n\n## Navigation and access\n\nBackOffice contributes **Module Health** under **Operations and Integration**\nthrough `backofficeCapabilities.backoffice.navigation`; Axis does not hardcode\nthe menu. It is returned only with `backoffice.registry.admin.view`.\n\nThe route is `/operations/module-health`. Employee session and screen-lock\nguards protect direct navigation. Backend authorization remains mandatory.\n\n## Frontend structure\n\n```text\nsrc/operations/moduleHealth/\n  ModuleHealthRoutePage.tsx\n  ModuleHealthTree.tsx\n  api/\n    moduleHealthClient.ts\n    moduleHealthContracts.ts\n\ntest/operations/moduleHealth/\n  api/\n    moduleHealthClient.test.ts\n```\n\nContracts reject malformed counts, identifiers, states, and freshness.\nThe client supplies the in-memory employee token, enterprise header, request\ntimeout, no-store policy, and redirect rejection. It stores no credentials and\nrejects unsafe module path segments.\n\nTanStack Query owns server state. Summary data loads once; instance details\nload only for the selected module, avoiding an unbounded request per module.\nWindow focus and explicit actions refresh data. Axis adds no health poller.\nAn on-demand **Check now** action is enabled only when the selected module has\nat least one client-callable runtime endpoint. Non-client modules still show\ntheir registration heartbeat and observed state, but Axis does not request a\nrefresh that the backend cannot perform.\n\n## Operator workflow\n\n1. Open **Operations and Integration > Module Health**.\n2. Review totals and module states.\n3. Expand or collapse module groups.\n4. Search by label, code, canonical path, environment, server, or state.\n   Matching descendants retain their ancestor chain.\n5. Select a concrete module. Its detail region expands directly beneath that\n   module so the hierarchy and runtime evidence remain visually connected.\n   Selecting the same module again collapses the detail region; selecting\n   another module moves the single expanded detail region to that module.\n6. Review each registered node's heartbeat, readiness observation, state,\n   freshness, and stable reason.\n7. Choose **Check now** for a governed immediate observation.\n\nExpired and intentionally deregistered nodes are not active instances. Axis\ndoes not infer expected cluster membership from previously observed nodes.\n\n## Responsive, accessible, and failure behavior\n\n- Summary cards wrap, while the module hierarchy and inline detail region use\n  the full available width on every breakpoint.\n- State always has text in addition to color.\n- Search is visibly labelled; rows are keyboard-operable buttons.\n- Loading uses announced progress and failures use alerts.\n- Dates use the browser locale.\n- BackOffice failure never falls back to invented health.\n- Unauthorized access remains a backend rejection.\n- Malformed responses fail closed.\n- Stale evidence is `UNKNOWN`, never healthy.\n- Refresh failure preserves the existing view and shows a bounded message.\n\n## Customize and extend safely\n\nPartners may change styling or compose presentation around typed contracts.\nThey must not call databases/providers from Axis, reproduce the registry,\ncall every module ping as a second authority, persist access tokens or raw\ndiagnostics, infer configured cluster membership, or bypass permissions.\n",
        },
        {
          code: 'axis.imports-exports',
          title: 'Imports and Exports Workspace',
          route: '/docs/nodics-axis/imports-exports',
          section: 'axis-capabilities',
          sectionTitle: 'Axis Capabilities',
          sectionOrder: 30,
          order: 110,
          audience: ['administrator', 'operator', 'developer', 'security-reviewer'],
          summary:
            'Review immutable data releases, validation, installation, history, security, responsive behavior, and the fail-closed export boundary.',
          searchText:
            'Imports and Exports Workspace Review immutable data releases, validation, installation, history, security, responsive behavior, and the fail-closed export boundary. # Imports and Exports Workspace\n\n## Purpose and ownership\n\nAxis gives authorized employees a responsive workspace for Nodics data\noperations. It is a client of the `import` module and does not discover files,\ncalculate installation state, sequence imports, write a database, or retain a\nbrowser-side audit authority.\n\nBackOffice contributes **Operations and Integration → Imports and Exports** at\n`/operations/imports-exports`. Axis renders it only when authenticated\nnavigation contains that entry.\n\n## Frontend organization\n\n- `src/operations/importExport/ImportExportRoutePage.tsx` owns presentation and\n  short-lived selection.\n- `src/operations/importExport/api/dataReleaseContracts.ts` owns bounded client\n  types.\n- `src/operations/importExport/api/dataReleaseClient.ts` owns authenticated\n  transport and defensive parsing.\n- `src/operations/importExport/components/FileImportWorkspace.tsx` owns the\n  governed file-import interaction only: selecting a backend-discovered target\n  model, uploading one file through nMedia, validating through nImport, and\n  executing only after successful validation.\n- Tests mirror this hierarchy under `test/operations/importExport`.\n\nTanStack Query owns catalogue server state. The browser sends selected module\ncodes and reviewed versions; Nodics re-discovers and validates the authority\nbefore doing work.\n\n## Employee workflow\n\nChoose Initialization, Core, or Sample data; review friendly module names,\ndescriptions, versions, and states; select releases; validate; then install or\nupdate when authorized. A release marked `CURRENT` is already installed at the\nsame immutable version and checksum. Axis still lets an operator validate a\ncurrent release so the backend can confirm the immutable manifest, requested\nversion, upgrade policy, active-module authority, tenant context, and installed\nstate. Validation is side-effect-free: it never runs import handlers or writes\nbusiness data. Install/update is the only action that executes init, core, or\nsample import processing. After a successful install/update, Axis clears the\nexecuted selection because the reviewed plan has become stale and must be\nreloaded before another operator action.\n\nThe install/update action remains disabled when every selected release is\nalready current because there is no executable import work.\n\nControls stack on narrow screens, remain keyboard operable, and have assistive\nlabels.\n\n## File import workflow\n\nUse **File imports** when an employee has an external CSV, Excel, JSON, or\nJavaScript import file that should create or update records in a Nodics schema.\nAxis does not ask for a server path and does not parse the file. The file is\nfirst uploaded through the `media` module, which stores the file according to\nbackend storage policy and returns a media code. Axis then sends only the media\ncode and selected backend model to the secured `system` import route.\n\nThe screen has five deliberate states:\n\n1. **Confirm target destination.** Axis shows the target enterprise as the\n   business destination and shows the tenant only as technical traceability. The\n   connected environment remains global read-only context; Axis is connected to\n   one backend environment and does not offer environment switching inside file\n   import. Tenant is the database or schema isolation authority resolved by\n   Nodics from enterprise configuration, while the selected data type is only\n   the model being imported. Business users should not independently choose a\n   tenant in the normal import flow. Axis presents enterprise as a selector even\n   when only one authorized enterprise is available, so the interaction is\n   ready for future multi-enterprise deployments. When multiple enterprises are\n   available, the selector should be populated from backend-authorized\n   destinations and the tenant must remain read-only and derived from the\n   selected enterprise.\n2. **Choose target model.** Axis loads authorized Workbench schema metadata from\n   the connected backend modules and presents business-friendly model names such\n   as Tenant, Address, Product, Price, Stock Balance, or CMS Page. The selected\n   model still carries its authoritative module name and schema name, but Axis\n   does not make `importDefinition` the first decision. Import templates are a\n   later optional convenience for reusable mappings; the generic flow starts\n   from the target schema.\n3. **Upload governed file.** The chosen browser file is submitted as\n   `multipart/form-data` to nMedia after enterprise and target model are\n   selected. Axis sends the selected enterprise, technical tenant, module name,\n   and schema name as upload context so the backend storage strategy can place\n   the file correctly. Axis never sets the multipart boundary by hand; the\n   browser owns that header. Axis must never infer the schema from the file\n   name.\n4. **Validate file import.** Axis calls the media-backed import route with\n   validation enabled. nImport asks nMedia for the stored file, stages a\n   temporary import workspace, generates a run-local header from the selected\n   module/schema target, resolves tenant scope, parses the data, prepares\n   finalized records, and reports whether the file is safe to execute. This\n   proves the file can pass the existing backend import initializer without\n   writing schema or search data. Axis displays backend counters, such as\n   records read, records finalized, and validation issues, so the operator can\n   tell the difference between a superficial upload success and a real import\n   validation.\n5. **Install imported data.** Only after validation for the current uploaded\n   media code does Axis enable the install action. The backend reruns governed\n   import preparation and then executes the existing data-handler pipeline, so\n   schema validation, authorization, duplicate handling, diagnostics, history,\n   and cleanup stay backend-owned. Axis displays dispatched, succeeded, and\n   failed record counts from the backend run summary and does not calculate\n   those totals in the browser.\n\nThe generic path is intentionally schema-first. A later implementation may add\nimport templates for recurring business feeds, such as Product CSV import,\nStock balance Excel import, or Legacy ERP Customer import. Those templates must\nremain optional nImport-owned conveniences over the same media-backed route;\nthey must not become a second file-import authority or a Profile-specific\npattern.\n\nTo customize file import safely, expose or refine schema metadata and import\nbehavior in the owning backend module. If a new parser, storage provider,\nfield-mapping template, transformation, or validation rule is needed, implement\nthat capability in the backend provider layer and expose it through the same\nsecured contracts. Axis may improve selection, preview, and result\npresentation, but it must not parse business files or duplicate schema rules.\n\n## Security, failure, and extension\n\nThe in-memory employee token is sent only to the selected `import` connection\nfor release/history reads, backend module connections for Workbench schema\ndiscovery, the selected `media` connection for uploads, and the selected\n`system` connection for media-backed import execution. Each connection comes\nfrom BackOffice bootstrap. Axis never infers authorization from a visible\nbutton. Unknown states and incompatible responses are rejected.\nTimeouts, authorization failures, disabled policy, integrity failures, and stale\nselections are shown without backend stacks or diagnostics.\n\nExisting installations may enter this workspace with the historical\n`import.core.run` administrator permission so they can install the new\nfine-grained permission data. Nodics still enforces a separate type-specific\npermission for each execution.\n\n## Export workflow\n\nUse **Exports** when an employee needs a governed file generated from records\nowned by a Nodics schema. Axis follows the same business-first sequence as file\nimport:\n\n1. **Confirm target destination.** The employee chooses the target enterprise.\n   Axis shows the derived tenant as technical traceability because tenant is\n   database isolation, not a normal business choice. Axis stays connected to\n   one backend environment and does not switch environments inside the export\n   screen.\n2. **Choose export model.** Axis loads authorized schemas from the Schema\n   Workbench and groups them by owning module. The employee searches by model\n   name or module name and chooses the schema that owns the data. Axis keeps\n   the module name and schema name only as backend contract values.\n3. **Build query and preview.** Axis uses the shared Schema Query Builder used\n   by Schema Workbench record browsing and every other schema-backed data\n   retrieval screen. The employee can combine\n   simple search text with governed conditions, nested `AND`/`OR` groups,\n   allowed operators, sort order, and preview size. Allowed fields, operators,\n   group operators, sortable fields, default sort, and maximum preview size come\n   from the backend schema Workbench capability contract; Axis does not invent\n   unsupported operators or send free-form database queries. The preview remains\n   bounded and read-only so the employee can verify the query before generating\n   a file, but it is not the export authority.\n4. **Generate export file.** The employee chooses CSV or JSON. Axis calls the\n   secured nExport route. The backend uses nExport to re-run the governed\n   query, applies export access policy, renders the file, and asks nMedia to\n   store the output as an `exportFiles` media record.\n5. **Download or use the media.** Axis shows the generated file name, record\n   counts, media code, and download action when the backend returns an access\n   URL. Private, signed, or public delivery is always controlled by nMedia\n   policy; Axis never exposes raw filesystem paths.\n\nThis first export implementation supports single-schema CSV and JSON exports.\nMulti-schema or aggregated exports, scheduled exports, additional formats, and\nexternal destinations should be added behind nExport provider contracts later.\nThose extensions must still generate media records for produced files so\nhistory, storage policy, access policy, and cleanup remain backend-owned.\n\nThe Schema Query Builder is not an export component. Export, Schema Workbench,\nfuture media-reference lookups, and any future schema record browser should\nreuse the same builder whenever they retrieve records from a Nodics schema.\nThe builder consumes backend-advertised searchable fields, filter fields,\noperators, grouping rules, sort fields, default sort, and page-size limits. It\ndoes not decide database syntax, bypass ownership, or add browser-only operators.\n\nTo customize export safely, change the owning backend schema/search behavior,\nexport access policy, nExport rendering/provider services, nMedia storage\nconfiguration, or the shared Axis Schema Query Builder presentation. Axis may\nimprove the query builder and result presentation, but it must not query\ndatabases directly, render authoritative business files from browser-only data,\nor decide media storage paths.\n\nExtend presentation inside this feature and reuse shell and API patterns. Never\nadd an Axis filesystem picker or importer. Run `npm run verify` and validate\ndesktop, touch, narrow viewport, keyboard, unauthorized, unavailable-module,\nvalidation, execution, recovery, integration, and regression behavior.\n\n## Customize and extend safely\n\nAdd project-specific release filters, explanatory CMS copy, file-import helper\ncopy, or result presentation through focused Axis components while continuing to\ncall the Nodics nImport catalogue, Workbench schema discovery, preflight,\nmedia-backed execution, and history contracts. New import or export formats,\nrelease discovery, sequencing, persistence, mapping templates, and provider\nbehavior belong in later backend modules behind the provider-neutral data\ncontracts.\n\nDo not inspect sibling repositories, submit arbitrary server paths, calculate\ninstallation state locally, parse data files in Axis, store uploaded file\ncontent in browser state beyond the selected `File`, or enable export before\nits backend contract is active. Test authorized and unauthorized catalogues,\ninitialization/core/sample separation, schema discovery absence, missing\nmedia/system connections, upload failure, validation failure, stale validated\nmedia, checksum and compatibility rejection, execution retry, history\nprojection, narrow and keyboard use, backend unavailability, and removal of the\nproject presentation extension.\n',
        },
        {
          code: 'axis.media-management',
          title: 'Media Management Workspace',
          route: '/docs/nodics-axis/media',
          section: 'axis-capabilities',
          sectionTitle: 'Axis Capabilities',
          sectionOrder: 30,
          order: 115,
          audience: ['administrator', 'operator', 'developer', 'business-user'],
          summary:
            'Understand the governed Media Management navigation, route shell, backend ownership, storage and delivery boundaries, and upcoming capability slices.',
          searchText:
            'Media Management Workspace Understand the governed Media Management navigation, route shell, backend ownership, storage and delivery boundaries, and upcoming capability slices. # Media Management Workspace\n\n## Purpose\n\nMedia Management gives BackOffice users a single place to work with files that\nNodics stores through the framework media lifecycle. A media file can be an\nimport spreadsheet, a CMS banner image, a product gallery image, a product\nthumbnail, a PDF document, or another governed file that a business process\nneeds to keep and reference.\n\nAxis does not own media storage. The backend `nMedia` module owns media\nmetadata, folders, formats, sets, references, storage provider selection,\nstorage-key generation, upload validation, access policy, and content delivery.\nAxis only renders the employee workspace that is returned by the BackOffice\nnavigation contract.\n\nIn the Axis UI, the word **Visibility** is used for the backend media access\npolicy. Visibility answers a business question: "who can safely open this\nfile?" It does not mean database permission and it does not mean the employee\'s\nBackOffice role. For example, data import and data export files are normally\nprivate, while approved CMS or product assets may become public or signed later.\n\n## Navigation\n\nThe left navigation group is **Media Management**. It is published by nMedia\nthrough `backofficeCapabilities.media.navigation`, not hardcoded in Axis. The\ncurrent first slice exposes these entries:\n\n- **Media** for uploaded media records.\n- **Media Folders** for purpose-based folders such as import sources, data\n  export files, CMS assets, product assets, and utility files.\n- **Media Sets** for groups of related media variants, such as a product image\n  gallery or responsive CMS image set.\n- **Media Formats** for reusable formats such as original, thumbnail, mobile,\n  desktop, zoom, and import file.\n- **Media Usage** for finding which product, CMS, import, or business record is\n  referencing a media item.\n- **Storage and Delivery** for provider policy, visibility, and delivery\n  behavior.\n\nThese entries appear only when BackOffice returns them for the authenticated\nemployee. Axis must not show a duplicate static media menu when the backend does\nnot authorize it.\n\n## Implemented Axis behavior\n\nThe implemented browser route is `/media/*`, but page composition is\nowned by the authenticated Axis CMS content catalog route at\n`/media`. The catalog maps `axis.page.media-management` to the Axis\npage renderer, `axis.template.media-management` to the template renderer, and\n`axis.component.media-management-workspace` to the reusable workspace component\nrenderer. The renderer reads the current browser location and backend-published\nnavigation to make each section route meaningful:\n\n- `/media` explains the full governed media operations area.\n- `/media/items` explains uploaded media records.\n- `/media/folders` explains media folder policy.\n- `/media/sets` explains logical media sets and variants.\n- `/media/formats` explains reusable presentation or processing\n  formats.\n- `/media/usage` explains media references and usage tracing.\n- `/media/storage-delivery` explains provider policy and delivery\n  behavior.\n\nThe active section shows three beginner-friendly blocks:\n\n1. the backend owner or model that remains authoritative;\n2. what the employee workspace can safely show now;\n3. the next capability slices that will make the section operational.\n\nThe route uses the same employee session, screen-lock, runtime bootstrap,\nleft-nav, CMS renderer boundary, and authorization gates as the rest of Axis.\nAxis must not mount Media Management as a direct operations page that bypasses\nthe content catalog and renderer registry.\n\nThe **Media** section now includes an operational media record workspace. Axis\ndiscovers the `media` schema through the same generated Schema Workbench\ncontract used by the Business Data workbench, then searches records through the\nowning nMedia module connection. The screen shows safe business metadata such as\nmedia code, original filename, folder, format, visibility, lifecycle status,\nMIME type, extension, size, checksum, checksum algorithm, and provider. Normal\nbusiness detail panels do not expose provider storage keys or backend-resolved\nfull paths.\n\nThe media list is designed to scale beyond the small local-development list.\nBusiness users can narrow media records by:\n\n- **Source type**, which is the business purpose published by nMedia context\n  metadata or, for older backend deployments, derived from backend folder\n  metadata. Examples include data imports, data exports, product media, content\n  media, business documents, or utility media;\n- **Visibility**, such as private, public, or future signed delivery;\n- **Status**, such as ready, consumed, retired, or failed;\n- **Format**, such as import file, original, thumbnail, desktop, mobile, or a\n  partner-defined format;\n- free-text search across safe metadata such as code, filename, folder, format,\n  status, MIME type, and extension.\n\nAxis sends search text, queryable source-type/facet selections, page number,\npage size, and the schema default sort to nMedia through the generated\nSchema Workbench record contract. The table count comes from the backend\n`totalCount`, not from a browser-side full-record load. Axis only renders\nfilters when the active schema advertises the corresponding safe filter field\nand operator. Source type is mapped to backend folder codes from `/contexts`,\nthen passed as a `folderCode` filter when the media schema allows it. This keeps\nlarge media libraries scalable while preserving nMedia as the only authority for\nrecord retrieval, filtering, storage, and delivery. Axis must not create a\nbrowser-only media index or read storage folders directly.\n\nThe same section also supports governed upload. The employee selects an upload\npurpose, such as data imports, content media, product media, or utility media.\nAxis first asks nMedia for backend-owned media source contexts through\n`/contexts`. The context response tells Axis which source types are eligible\nfor manual upload, which compatibility aliases identify the same source type,\nwhich folders and formats they use, and which route template can be shown to\nthe employee. Axis treats backend `sourceType`, `code`, and `aliases` as the\nauthority for source-type mapping. Regex-style browser guessing is only an\nolder-backend fallback when `/contexts` is unavailable. If an older backend does\nnot publish contexts, Axis falls back to the older `/storage/policy` folder\nprobes. Data exports are not shown as a manual-upload source type by default\nbecause export files are generated by the Exports workspace. When the employee\nuploads a file, Axis posts multipart data to the nMedia `/storage/upload`\nendpoint. nMedia validates the folder, file type, size, checksum, provider, and\nstorage key. Axis receives the returned media code and refreshes the media list.\nAxis does not choose the filesystem folder, does not generate the storage key,\nand does not persist\nmedia metadata directly.\n\nThe upload UI is implemented as the reusable `MediaUploadWizard` component under\nMedia Management operations. The wizard keeps the interaction layered:\n\n1. select a backend-published source type;\n2. show the resolved nMedia folder, format, route template, extension policy,\n   MIME policy, and max-size policy;\n3. show the backend-published target module and schema when a source type\n   requires target context;\n4. keep file selection disabled until a valid source type, policy, and required\n   target context are known;\n5. let the employee choose a local file;\n6. show a browser-only review; and\n7. submit the file to nMedia and call the parent refresh callback after a media\n   code is returned.\n\nThe browser-only review is intentionally advisory. Axis may show local metadata\nthat helps an employee catch obvious mistakes before upload, including file\nsize, MIME type, extension, image dimensions, a thumbnail for image files, CSV\nheaders and row count, JSON top-level shape, and a small text preview. These\nsignals are not business validation. nMedia still validates upload policy, and\nthe owning module, such as nImport, Product, CMS, or a partner module, still\nvalidates business content after it receives the media code.\n\nMedia detail includes three operational checks:\n\n1. **Delivery preview** uses the nMedia content endpoint only when the media is\n   public and in a deliverable lifecycle state.\n2. **Usage summary** checks nMedia `mediaReference` records for the selected\n   media code and links to `/media/usage?mediaCode=...` so the\n   employee can review where the file is used.\n3. **Lifecycle actions** expose retire or restore actions only when the\n   generated media schema allows update for the employee session. Axis blocks\n   retire when active usage references are visible, because a business user\n   should review dependencies before making a file inactive.\n\nThe **Media Folders** section uses the same backend-owned pattern. Axis\ndiscovers the `mediaFolder` schema from nMedia, searches folder records through\nthe nMedia module connection, and presents folder policy in business-friendly\nlanguage. It shows the folder code, name, description, storage prefix,\nvisibility/access mode, allowed extensions, allowed MIME types, maximum file\nsize, and retention days. This helps administrators understand where import\nfiles, data export files, CMS assets, product assets, and utility documents are\nrouted without making Axis own storage rules.\n\nWhen an employee selects a folder, Axis shows a policy-impact warning. The\nwarning explains that changes to the folder policy affect future upload\nvalidation, default visibility, retention, and provider-relative routing. It\nalso repeats the boundary: provider secrets, raw paths, and alternate\nbrowser-side upload rules must not be added to Axis.\n\nFolder policy editing is intentionally nMedia-owned. If the discovered\n`mediaFolder` schema does not advertise update permission for the employee\nsession, Axis shows the policy as read-only and directs administrators back to\nbackend-approved media configuration. When update is advertised, Axis exposes a\nsmall policy action panel for visibility, maximum upload size, and retention\ndays. The panel submits only those fields through the nMedia folder policy\noperation, so future upload validation uses the same backend authority. Axis\ndoes not edit storage prefixes, resolved paths, provider secrets, provider\nconfiguration, or browser-side policy rules. nMedia remains responsible for\nvalidation, routing, provider behavior, tenant policy, and persistence.\n\nMedia Management may link to Schema Workbench for generic `mediaFolder` record\ninspection, search, audit, or seed-data workflows instead of duplicating the\ngeneric record form. The handoff URL is\n`/schema-workbench?module=media&schema=mediaFolder`; when the backend advertises\ncreate permission, Axis may also link to\n`/schema-workbench?module=media&schema=mediaFolder&mode=create`. Those links do\nnot replace the nMedia policy operation for live upload-policy changes unless a\ndeployment explicitly synchronizes generated records into effective\nconfiguration through nMedia-owned governance.\n\nThe **Media Formats** section is also operational. Axis discovers the\n`mediaFormat` schema from nMedia and shows reusable presentation or processing\nformats such as original, thumbnail, desktop, mobile, zoom, or import file. The\nscreen presents format code, name, purpose, family, lifecycle status,\ndescription, width, height, and a combined dimensions view. Formats help backend\nand frontend teams use consistent business vocabulary for media variants without\nmaking Axis transform images or own storefront rendering behavior.\n\nFormat detail also asks nMedia for `/contexts` and shows where the selected\nformat is advertised. This answers questions such as "which folders/source\ntypes can use desktop?" without hardcoding source-type behavior in Axis. A\nformat can be default, allowed, both, or unused by the current backend context\nconfiguration. The live upload authority remains nMedia format policy; Schema\nWorkbench records are useful for inspection and audit, not a second browser\npolicy authority.\n\nThe **Media Sets** section now lists and searches logical media groups from the\n`mediaSet` schema. A media set represents one logical asset group, such as a\nproduct gallery, responsive CMS image group, documentation asset group, or mixed\nfile bundle. Axis shows the set code, name, description, media type, business\npurpose, and lifecycle status.\n\nWhen an employee selects a media set, Axis also loads the set composition from\nthe nMedia-owned `mediaSetEntry` schema. The detail panel shows each linked\nvariant with its media code, optional format code, variant role, locale,\nchannel, device, breakpoint, fallback entry, dimensions, position, primary\nflag, and lifecycle status. This keeps the business view clear: the set\ndescribes the logical group, each entry describes a specific reusable variant,\nand each variant still points to an owned media record. Axis does not duplicate\nvariant ownership or infer image behavior; it asks nMedia for the set entries\nusing a backend filter on the selected set code.\n\nSet-entry actions call nMedia-owned endpoints under\n`/sets/{mediaSetCode}/entries`. Axis can reorder entries, mark one entry as\nprimary, remove an entry from the set, and hand off full create/edit record\nworkflows to Schema Workbench. These actions intentionally do not update\nProduct, CMS, import, export, or partner business records. Those modules decide\nwhere a media set is used; nMedia manages the reusable media grouping and\nvariant metadata.\n\nThe **Media Usage** section now searches the nMedia `mediaReference` schema. A\nmedia reference answers the business question, "where is this file or media set\nbeing used?" without moving ownership away from the source module. For example,\na product record may reference a product gallery, a CMS component may reference\na banner image, or an import process may reference the uploaded source file.\nAxis shows the owner module, owner schema, owner record code, relation type,\nmedia code, media set code, position, and lifecycle status.\n\nWhen the route receives a `mediaCode` query parameter, Axis filters the usage\nworkspace to that media item. This gives Media detail a safe deep link into\nusage without inventing a second search endpoint. The filter still runs through\nnMedia\'s generated schema/workbench contract.\n\nUsage can also be filtered by owner module, owner schema, owner record, relation\ntype, and status when the backend schema advertises those fields as queryable.\nThe owner-record filter is useful when a business user already knows the\nProduct, CMS, import, export, or partner record that may be holding a reference.\n\nThis is not analytics usage and it is not a duplicate product or CMS editor.\nnMedia owns only the media reference trace. The product, CMS, import, or partner\nmodule continues to own the business record and its validation rules. This\nseparation lets administrators safely answer cleanup questions such as "can this\nfile be retired?" before removing or retiring media that may still be attached\nto another business object.\n\nMedia detail also includes an **Import/export linkage** panel. The panel is\nread-only. It asks nImport for run history with the selected `mediaCode` and\nshows any matching import runs, counts, status, data type, and modules. It also\nsummarizes import/export `mediaReference` traces when they exist. Axis does not\nedit the import run, export result, Product record, CMS record, or partner\nrecord from this panel; it links the employee to the owning Import/Export\nworkspace for deeper work. Export status remains owned by nExport and should be\nsurfaced only through nExport-published contracts.\n\nThe **Storage and Delivery** section now provides a read-only policy inspection\nview. Axis first calls the nMedia `/contexts` API and derives safe folder\npolicy rows from the backend-owned context projection, including backend-owned\nsource type aliases. For older backend deployments that do not yet publish\ncontexts, Axis falls back to the\n`/storage/policy` API with small safe probe descriptors for known folder\npurposes. The result shows folder-level upload rules: folder code, business\nlabel, visibility, allowed extensions, allowed MIME types, maximum file size,\nand checksum algorithm.\n\nThe same screen also calls `/storage/providers/summary` when the backend\npublishes it. That summary is deliberately safe: active provider code, provider\ntype, enabled/active flags, provider health status, key strategy name, and\ndelivery mode. It does not expose absolute filesystem paths, bucket names,\ncertificates, credentials, object keys, or signed URL secrets. Axis does not\ncall the storage-location endpoint, does not generate storage keys, and does\nnot offer provider credential controls. nMedia still decides whether a folder\nuses local storage, NAS, S3, Azure, Google Cloud Storage, FTP, or a partner\nprovider.\n\nFor a beginner developer, this means:\n\n1. Axis asks nMedia, "which media source contexts and folder policies are safe\n   for this employee workspace?"\n2. nMedia returns safe context and upload-policy metadata without provider\n   secrets or raw paths.\n3. Axis optionally asks nMedia for the safe storage provider summary and shows\n   only provider code, type, health, delivery, and key-strategy metadata.\n4. Axis displays only the safe context, policy, and provider summary metadata.\n5. When a real upload happens, Axis sends the selected file to nMedia.\n6. nMedia resolves provider and storage location, creates the media record, and\n   returns the media code.\n7. When a file is opened, Axis uses the nMedia content delivery endpoint with\n   the media code instead of a raw file path.\n\nFor example, an import CSV is uploaded under the `importSources` purpose. A\ngenerated export CSV or ZIP is stored under the `exportFiles` purpose. A CMS\nbanner image is uploaded under the `cmsAssets` purpose. A product gallery image\nis uploaded under the `productAssets` purpose. They may all use the same local\nprovider in local development, but production can route them differently through\nnMedia configuration without changing Axis.\n\nFor single-schema data operations, nMedia uses separate provider-relative data\npaths for imports and exports:\n\n- import files:\n  `data/import/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;\n- generated export files:\n  `data/export/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.\n\nAxis may display the business purpose and media code, but it must not assemble\nor persist these paths itself. Multi-schema aggregated exports will need their\nown backend-owned path contract later.\n\nFor business media operations, nMedia uses separate provider-relative media\npaths by purpose:\n\n- product media:\n  `media/product/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;\n- content media:\n  `media/content/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;\n- utility media:\n  `media/utility/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.\n\nAxis can present these as Product media, Content media, and Utility media\nfilters, but the backend folder configuration and key strategy remain the only\nauthority for the actual storage key.\n\nAxis deliberately does not display backend-resolved full paths. If a file can be\nopened inline, the UI uses the nMedia content endpoint, not a filesystem path.\nIf a file is downloaded, Axis uses the nMedia download endpoint\n`/download/{mediaCode}` so backend content-disposition and authorization policy\nremain in charge. This keeps local storage, NAS, cloud storage, and future\nsigned URL providers behind the backend media contract.\n\nThe **Media** record detail view follows the same rule. When a selected media\nrecord is a public image in a deliverable lifecycle state, Axis can render a\nsmall preview by calling the nMedia content delivery URL. For other file types,\nAxis offers an open action through `/content/{mediaCode}` and a download action\nthrough `/download/{mediaCode}` only when the backend record is public and in a\ndeliverable state. Private and signed files are not opened directly from the\nbrowser until nMedia exposes the proper authorized or signed delivery contract.\nAxis must never convert `fullPath`, `relativePath`, bucket keys, or storage keys\ninto browser links.\n\nProvider diagnostics remain a separate capability slice. They must be\nimplemented against nMedia-owned APIs instead of frontend path logic.\n\n## Backend ownership\n\nnMedia is the source of truth for:\n\n- media records and their original filename, stored filename, MIME type,\n  extension, size, checksum, provider code, folder code, format code, storage\n  key, relative path, absolute path policy, access URL, visibility/access mode,\n  and status;\n- media folders and their allowed file types, storage prefix, visibility/access\n  policy, and retention policy;\n- media formats and named variants;\n- media sets and set entries;\n- media references from CMS, product, import, or other backend-owned records;\n- local, NAS, S3, Azure Blob, Google Cloud Storage, or partner provider\n  configuration;\n- public, private, or future signed delivery policy.\n\nAxis uses only backend contracts. It does not calculate storage paths, expose\nabsolute paths, infer visibility/access policy, or decide whether a media file is\nreusable.\n\n## Customize and extend safely\n\nPartners can customize Media Management safely by changing nMedia configuration\nor extending nMedia services:\n\n- add a new storage provider under nMedia and register it in module\n  configuration;\n- override the storage-key strategy so files route to a partner-specific folder\n  layout;\n- add a new media folder for a business purpose, such as KYC documents,\n  generated export files, or logistics proof-of-delivery images;\n- add new formats for brand or storefront image requirements;\n- extend backend APIs for governed media search, usage inspection, preview,\n  cleanup, or provider diagnostics;\n- add Axis renderers that consume those APIs after BackOffice publishes the\n  corresponding navigation or operation contract.\n\nPartners should not customize Axis by adding hardcoded menus, direct storage\ncalls, direct database reads, raw filesystem URLs, or assumptions about local\ndevelopment paths. Those would create duplicate authority paths and would break\ncloud, NAS, or multi-provider deployments.\n\n### Customizing storage policy safely\n\nStorage customization belongs to nMedia. A partner or project can configure the\nlocal provider for development, a mounted NAS path for enterprise deployments,\nor a cloud provider for production. The important contract is that Axis never\nneeds to know the storage path. Axis only needs the returned media code and the\nsafe delivery URL or content endpoint.\n\nThe safe extension sequence is:\n\n1. Add or override nMedia provider configuration.\n2. Add or override a storage-key strategy service if the folder layout must\n   change.\n3. Add or override folder configuration for business purposes such as import\n   files, product images, CMS banners, KYC documents, or process evidence.\n4. Expose only safe inspection metadata from nMedia when the BackOffice needs to\n   display it.\n5. Keep provider secrets and absolute paths out of Axis, content catalog data,\n   documentation content packs, and browser-visible responses.\n\nIf a partner wants files under a structure like\n`{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`, that\nstructure must be produced by a backend nMedia key strategy service. Axis can\ndisplay the business folder and media code, but it must not assemble that path\nitself.\n\n### Customizing upload behavior safely\n\nUpload behavior is configured by nMedia folders, formats, providers, and key\nstrategies. Axis should not be customized with file-type rules or storage\nfolders. A partner can extend upload behavior safely by adding backend\nconfiguration such as:\n\n- a new folder for a purpose like KYC documents, warranty attachments, shipment\n  proof images, data export files, or learning resources;\n- a new format such as storefront-thumbnail, mobile-banner, zoom-image, or\n  compliance-document;\n- a new provider such as NAS, S3, Azure Blob, Google Cloud Storage, FTP, or a\n  partner document store;\n- a new key strategy when the physical or provider-side path needs a different\n  structure;\n- a visibility/access policy that marks which media can be public, private,\n  signed, or internal-only.\n\nAfter nMedia publishes the new context or folder policy, Axis can show it\nautomatically in the upload purpose selector. If the partner needs a richer\nworkflow, such as a product gallery uploader or CMS banner picker, that workflow\nshould still call nMedia upload first and then create the product or CMS\nreference through the owning module contract.\n\nThe smallest safe Axis customization is to compose `MediaUploadWizard` inside a\nproject-owned page or workflow and respond to its returned media code. A customer\npage may change surrounding copy, add a next-step panel, or route the media code\nto an owning Product, CMS, Import, or partner API. It must not copy the wizard\ninto a second upload implementation, hardcode folder-to-source mappings, invent\nfile policy, generate media records locally, infer storage paths, or bypass\nnMedia upload.\n\nWhen customizing the wizard, keep tests focused on the boundary:\n\n- generated export contexts remain excluded from manual upload unless nMedia\n  explicitly publishes a different contract;\n- file selection is blocked until backend policy is known;\n- source types marked `targetRequired` by nMedia are blocked until the backend\n  publishes the target module and schema Axis should send with upload;\n- unsupported extensions, MIME types, and oversized files are rejected locally\n  only as early UX warnings;\n- successful upload calls nMedia with the backend-derived folder, format,\n  module, and schema context;\n- backend upload errors are shown as safe messages without exposing service\n  internals; and\n- local previews for images, CSV, JSON, or text remain advisory and never\n  replace backend validation.\n\n## Verification\n\nWhen adding a Media Management feature, verify:\n\n1. nMedia publishes the navigation or API contract.\n2. BackOffice filters the entry by permissions.\n3. Axis renders the route only when the authenticated bootstrap contains the\n   entry and the CMS content catalog resolves the `/media` page.\n4. Media record, folder, format, and set search use the nMedia-owned\n   schema/workbench API and never a direct database or storage read.\n5. Storage policy inspection uses nMedia `/contexts` first, including\n   backend-owned `sourceType`, `code`, and `aliases`, and falls back to\n   `/storage/policy` only for older backend deployments. It does not call\n   storage-location or upload APIs unless that workflow is explicitly being\n   executed.\n6. Preview and download actions use nMedia delivery URLs only, never raw storage\n   paths.\n7. Private and signed media do not show direct browser delivery actions until\n   nMedia exposes and authorizes that delivery contract.\n8. Upload posts to nMedia `/storage/upload`; Axis does not create media records\n   directly.\n9. Usage deep links filter the nMedia `mediaReference` schema through the\n   generated workbench contract.\n10. Renderer coverage includes `axis.page.media-management`,\n    `axis.template.media-management`, and\n    `axis.component.media-management-workspace`; future media presentation\n    changes must extend CMS properties or renderer contracts rather than\n    adding another direct operations page.\n11. Retire and restore actions use the nMedia media schema update contract and\n    are hidden or disabled when update is not authorized.\n12. Large media lists provide source-type, visibility, status, format, free-text\n    search, and pagination without creating a browser-side media authority.\n13. Import/export linkage remains read-only. Axis may query nImport history by\n    media code and show import/export media references, but it must not mutate\n    import runs, export results, Product records, CMS records, or partner owner\n    records through Media Management.\n14. Storage provider summaries show only safe operator metadata: active\n    provider code, provider type, enabled/active state, health, key strategy,\n    and delivery mode. They must not show credentials, certificates, buckets,\n    storage keys, signed URL secrets, absolute paths, or backend-resolved full\n    paths.\n15. Generated export files are downloaded through nMedia media-code delivery,\n    not through export-specific browser paths or duplicate binary routes.\n16. Upload, search, reference, lifecycle, or delivery behavior stays\n    backend-owned.\n17. Positive, negative, boundary, permission, contract, integration, and\n    regression tests cover the new behavior.\n',
        },
        {
          code: 'axis.feature-delivery',
          title: 'Axis Feature Delivery Checklist',
          route: '/docs/nodics-axis/feature-delivery',
          section: 'contribute-to-axis',
          sectionTitle: 'Contribute to Axis',
          sectionOrder: 40,
          order: 120,
          audience: ['developer', 'architect', 'framework-maintainer', 'ai-tool'],
          summary:
            'Apply repository-boundary, reuse, security, interaction, contract-testing, documentation, partial-discovery, and completion gates.',
          searchText:
            'Axis Feature Delivery Checklist Apply repository-boundary, reuse, security, interaction, contract-testing, documentation, partial-discovery, and completion gates. # Axis Feature Delivery Checklist\n\nUse this checklist for every implemented Axis feature. Complete the ownership\nanalysis before changing source and retain evidence in the pull request or\ndelivery record.\n\n## 1. Repository boundary\n\nRecord:\n\n- the authoritative Nodics module and backend contract;\n- the Axis route, feature, or component that consumes it;\n- the contract version or supported range;\n- the authentication and authorization boundary;\n- the tenant, enterprise, application, Site, Store, locale, channel, and module\n  context involved;\n- backend changes required in `nodics`, if any;\n- Axis changes required in this repository;\n- documentation and tests owned by each repository.\n\nStop when ownership is ambiguous. Do not move backend business behavior into\nAxis to avoid defining a backend contract.\n\n## 2. Reuse and dependency check\n\nConfirm:\n\n- an existing Axis component, hook, client, state pattern, or test utility was\n  considered first;\n- an existing Nodics API, schema, permission, workflow, publishing, cache,\n  search, import, or export authority is reused;\n- no second registry, loader, schema authority, workflow engine, publisher,\n  context authority, or provider integration is introduced;\n- any new dependency has documented bundle, maintenance, security,\n  accessibility, browser, WebView, and licensing impact.\n\n## 3. Security and privacy\n\nConfirm:\n\n- target modules independently authorize every request;\n- UI filtering is not treated as authorization;\n- passwords, access tokens, refresh tokens, cookies, internal credentials, and\n  secrets are absent from browser storage, URLs, logs, and telemetry;\n- errors and telemetry contain safe correlation data without sensitive\n  payloads;\n- query keys and caches cannot cross users or validated contexts;\n- logout, revocation, and context switching cancel requests and clear affected\n  data;\n- CMS or another module cannot supply executable browser code.\n- configurable business-facing labels, help text, placeholders, empty states,\n  action captions, and content fragments come from typed CMS properties rather\n  than renderer literals;\n- domain errors retain stable backend codes and safe messages, while generic\n  Axis fallbacks are limited to browser and transport failures;\n- locale, direction, translated text expansion, and locale-aware formatting\n  are covered without creating a second translation authority in Axis;\n- arbitrary HTML, CSS, JavaScript, expressions, event handlers, and remote\n  renderer imports are rejected.\n\n## 4. Interaction quality\n\nImplement and verify applicable:\n\n- loading, success, empty, unavailable, unauthorized, incompatible, validation,\n  conflict, partial-failure, and recovery states;\n- keyboard operation and visible focus;\n- screen-reader names, roles, states, and announcements;\n- responsive desktop, tablet, and mobile WebView layouts;\n- long translated labels, right-to-left direction, locale fallback, and\n  locale-aware dates, numbers, currency, and pluralization where applicable;\n- touch target sizing and non-hover alternatives;\n- reduced motion;\n- the fixed comfortable workspace density;\n- light and dark token compatibility;\n- safe cancellation and stale-response prevention.\n\n## 5. Contract tests\n\nCover applicable:\n\n- positive behavior;\n- invalid input and malformed response;\n- permission and cross-tenant denial;\n- minimum, maximum, empty, timeout, and payload boundaries;\n- supported, degraded, incompatible, missing, and unknown contract versions;\n- cancellation, retry, idempotency, and concurrency;\n- backend outage and recovery;\n- responsive and accessibility behavior;\n- integration with `monoServer` and later distributed module topology;\n- regression of the static recovery shell.\n\nUI tests prove client behavior only. Backend authorization, validation,\npersistence, workflow, publication, and integration tests belong in `nodics`.\n\n## 6. Documentation placement\n\nUpdate this repository for implemented:\n\n- installation, build, start, and deployment behavior;\n- runtime configuration consumed by Axis;\n- frontend architecture and contribution rules;\n- browser routes, interaction, accessibility, responsive behavior, and\n  troubleshooting;\n- frontend verification commands.\n\nUpdate `nodics` for implemented:\n\n- business-user and administrator journeys;\n- backend architecture, configuration, permissions, APIs, schemas, workflows,\n  publication, integration, security, and operations;\n- customization and override guidance;\n- backend tests and deployment evidence.\n\nKeep proposals, unresolved decisions, and future action lists only in the\ntemporary ignored planning workspace. Do not document planned UI as available\nproduct behavior.\n\n## 7. Partial-discovery and use-case proof\n\nConfirm that a contributor or AI tool opening only the nearest maintained files\ncan identify:\n\n- whether behavior belongs in Axis or Nodics;\n- the owning feature, route, component, hook, client, contract, and test;\n- the supported extension point and prohibited bypass;\n- backend authority and permission expectations;\n- accessibility, responsive, WebView, security, and recovery requirements;\n- the focused verification command.\n\nDocument successful, unauthorized/invalid, boundary/responsive,\nfailure/recovery, and supported customization examples with expected outcomes.\nLink Nodics-owned business and backend guidance rather than copying it into\nAxis.\n\n## 8. Completion evidence\n\nBefore marking the feature complete:\n\n- link the implemented source and contract;\n- link focused test evidence;\n- link permanent documentation for every applicable audience;\n- explain any audience or operational layer that is not applicable;\n- run `npm run verify`;\n- record known limitations and safe fallback behavior;\n- confirm the action-plan status reflects repository and test evidence.\n\n## Customize and extend safely\n\nFor every delivered feature, name the later project-owned page, component,\nrenderer, typed client, hook, configuration, or style extension point. Include\nthe smallest working file map and example, the backend contract that remains\nauthoritative, prohibited browser-side shortcuts, upgrade and rollback impact,\nand the focused positive, rejected, boundary, integration, regression, and\nproduction-build tests.\n\nA checklist that records only the shipped OOTB behavior is incomplete. If no\nsafe extension point exists, record that limitation explicitly rather than\nsuggesting that a framework file should be edited.\n',
        },
        {
          code: 'axis.implementation-contract',
          title: 'Axis Implementation and Documentation Contract',
          route: '/docs/nodics-axis/implementation-contract',
          section: 'contribute-to-axis',
          sectionTitle: 'Contribute to Axis',
          sectionOrder: 40,
          order: 130,
          audience: ['developer', 'architect', 'framework-maintainer', 'ai-tool'],
          summary:
            'Follow local discovery, repository ownership, placement, documentation, required scenarios, customization, and acceptance contracts.',
          searchText:
            "Axis Implementation and Documentation Contract Follow local discovery, repository ownership, placement, documentation, required scenarios, customization, and acceptance contracts. # Axis Implementation And Documentation Contract\n\nAxis is a reusable frontend framework application, not a one-off admin screen.\nPartners, developers, and AI tools must be able to extend it without seeing the\nentire repository or moving backend authority into the browser.\n\n## Local Discovery Chain\n\nFor every feature, read:\n\n1. root `AGENTS.md`;\n2. this contract and the feature-delivery checklist;\n3. the nearest feature source and focused tests;\n4. the consuming Nodics API/OpenAPI/CMS contract;\n5. the feature guide linked from the root README.\n\nCritical rules must be repeated concisely near the implementation and protected\nby TypeScript, schema validation, linting, or focused tests. A conversation or\ntemporary plan is never an implementation authority.\n\n## Repository Ownership\n\nAxis owns:\n\n- rendering, interaction, responsive/WebView behavior, and accessibility;\n- typed client contract consumption;\n- browser routing and presentation state;\n- TanStack Query server-state coordination;\n- Axis-owned CMS renderer implementations and typed registries;\n- loading, empty, unauthorized, incompatible, failure, and recovery views.\n\nNodics owns:\n\n- business rules and authoritative validation;\n- authentication and authorization enforcement;\n- persistence, workflows, pipelines, events, jobs, and integrations;\n- secrets, tenant governance, AI execution, tool execution, and audit;\n- backend schemas, APIs, configuration, runtime contracts, and business docs.\n\nWhen both repositories change, analyze and test each boundary separately.\n\n## Placement Rules\n\n- Application composition belongs under `src/app`.\n- Feature interaction belongs in a named feature boundary, not a generic\n  utilities folder.\n- CMS page, template, and component renderers follow the paths defined in\n  `AGENTS.md`, with one renderer implementation per file.\n- Backend logical keys map through typed registries. CMS data never supplies\n  executable JavaScript.\n- Configurable page copy comes from CMS component properties. Page and\n  component renderers consume typed labels, headings, placeholders, help text,\n  empty-state text, action captions, and fragments rather than defining\n  business-facing copy in JSX.\n- Reusable interaction behavior is implemented once and composed everywhere.\n  Query builders, media selectors, relationship selectors, record browsers,\n  and similar repeated controls must be modeled as reusable CMS component\n  contracts and Axis-owned shared renderers or primitives. Do not fork a\n  page-local implementation when a generic component already exists. Schema\n  data querying uses the `axis.component.schema-query-builder` renderer key,\n  so Schema Workbench, Imports and Exports, and future schema-backed pages\n  share one governed query-building experience.\n- Error ownership remains layered: the owning backend module supplies stable\n  domain codes and safe messages, CMS supplies configurable presentation copy,\n  and Axis supplies only generic browser or transport fallbacks needed when\n  the backend is unavailable. Axis never interprets English error text.\n- Locale, channel, and backend-resolved fallback are part of the CMS delivery\n  contract. Axis preserves that context, supports translated text expansion\n  and text direction, and uses locale-aware formatting without creating a\n  parallel backend translation catalogue.\n- Runtime values come from validated Axis configuration and backend contracts.\n  They do not belong in scattered constants or `package.json`.\n- Raw identifiers remain separate from display labels. Humanization is a\n  presentation fallback after contract validation, never a transformation of\n  request, authorization, cache, storage, audit, or telemetry identity. A\n  backend-provided localized display name always takes precedence.\n- Secrets never belong in frontend source, `.env`, generated browser config,\n  storage, URLs, telemetry, or logs.\n\n## Required Feature Documentation\n\nEvery significant feature guide explains:\n\n- purpose and current implemented scope;\n- backend authority and contract version;\n- source/component/client/test map;\n- setup and runtime configuration;\n- permissions and security;\n- keyboard, screen reader, responsive, touch, reduced-motion, and WebView\n  behavior;\n- success, unauthorized/invalid, boundary/responsive, failure/recovery, and\n  supported customization examples;\n- troubleshooting and verification;\n- known limitations and safe fallback.\n\nBusiness workflows and backend customization belong in Nodics documentation.\nAxis guides link to them and focus on frontend setup and contribution.\n\n## Customize and extend safely\n\nEvery feature guide includes this section. It\nshows the smallest supported project-owned Axis customization, identifies the\nbackend contract and security boundary that remain authoritative, lists\nprohibited frontend shortcuts or parallel authorities, and names the focused\npositive, rejected, boundary, integration, and regression tests. Explaining\nonly the out-of-the-box screen or workflow is incomplete.\n\n## Canonical Source and Generated Data\n\nAxis documentation is authored as granular, reviewable pages under\n`content/documentation`. The deterministic documentation generator creates CMS\npage, component, navigation, route, search, and immutable manifest data under\n`data/core` and `manifest/docs-content-pack.json`.\n\nThe generator is executable repository tooling and lives beside the authored\ncontent at `content/documentation/tooling/generate-documentation-content.js`.\nIt must not be placed under `config`, because configuration files remain\ndeclarative values only.\n\nDo not hand-edit generated CMS article records. Do not maintain a shorter\ngenerated summary beside a richer project guide. Every implemented feature\nmust update its canonical source page and regenerate the content pack in the\nsame change:\n\n```bash\nnpm run docs:generate\nnpm run docs:check\n```\n\nThe migration register records the original README/docs evidence, canonical\nsource, destination route, source hash, headings, word count, and disposition.\nREADME or legacy docs may be reduced only after all substantive guidance is\nmapped, generated, reviewed in Axis, and protected by content-preservation\ntests.\n\nEvery project and module retains a concise high-level `README.md` after detailed\nguidance migrates. It remains the repository entry point for purpose, ownership,\nimplemented capabilities, setup, verification, extension boundaries, and links\nto canonical pages. It must not become a second copy of the complete\noperational and developer guides. Legacy detailed `docs/` files may be retired\nonly after the migration register records their hashes, word counts, headings,\ncanonical destinations, and the generated and rendered verification gates pass.\nAfter retirement, do not recreate a parallel `docs/` directory. The project\nkeeps one concise `README.md`; detailed permanent guidance belongs only under\n`content/documentation` and its generated `data/core` projection.\n\n## Required Examples\n\n### Successful\n\nAn authorized employee loads a backend descriptor, Axis validates it, maps its\nrenderer key to an Axis-owned component, and displays the result.\n\n### Unauthorized\n\nThe backend denies an operation. Axis presents an accessible unauthorized state\nand does not infer authorization from menu visibility.\n\n### Boundary\n\nThe same feature remains usable with keyboard and touch in desktop, tablet, and\nmobile WebView layouts, including long labels, empty data, and bounded payloads.\n\n### Failure And Recovery\n\nWhen BackOffice or a target module is unavailable, Axis presents a safe\nrecovery state, avoids stale privileged data, and retries through the same\nauthoritative contract.\n\n### Customization\n\nA partner adds an Axis-owned renderer and registry manifest for a backend\nlogical component key. The partner does not download code from CMS or add\nbusiness validation to the renderer.\n\nAn administrator changes a component label or locale-specific content in the\nauthoritative CMS catalog. The same allowlisted Axis renderer displays the\nresolved value without a frontend rebuild. Missing or malformed required\nproperties produce the renderer's safe generic fallback and never execute\nbackend-supplied markup or code.\n\nA validated fallback identifier such as `axisContentCatalog` may be displayed\nas `Axis Content Catalog`. The raw code remains unchanged wherever identity or\nbackend communication is involved.\n\n## Acceptance\n\nA feature is complete only when:\n\n- repository ownership is explicit;\n- the backend contract and security boundary are preserved;\n- strict TypeScript and validation cover external data;\n- accessibility and responsive states are implemented;\n- focused positive, negative, boundary, failure, integration, and regression\n  tests pass;\n- implemented documentation and known limitations are current;\n- `npm run verify` passes at the release-oriented gate.\n\n## Continue\n\n- [Feature Delivery Checklist](feature-delivery-checklist.md)\n- [Architecture And Ownership](architecture-and-ownership.md)\n- [CMS Delivery And Renderers](cms-delivery-and-renderers.md)\n- [Axis README](../README.md)\n",
        },
      ],
    },
    active: true,
  },
  record1: {
    code: 'axisDocsComponentoverview',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.overview',
      title: 'What Is Nodics Axis?',
      route: '/docs/nodics-axis',
      section: 'discover-axis',
      sectionTitle: 'Discover Axis',
      category: 'Discover Axis',
      audience: ['business-user', 'administrator', 'developer', 'operator'],
      summary:
        'Understand Axis, its backend boundary, supported runtime, setup, configuration, quality commands, and implemented scope.',
      headings: [
        {
          text: 'Boundaries',
          anchor: 'overview-1-boundaries',
          level: 2,
        },
        {
          text: 'Prerequisites',
          anchor: 'overview-2-prerequisites',
          level: 2,
        },
        {
          text: 'Start locally',
          anchor: 'overview-3-start-locally',
          level: 2,
        },
        {
          text: 'Environment and runtime configuration',
          anchor: 'overview-4-environment-and-runtime-configuration',
          level: 2,
        },
        {
          text: 'Quality commands',
          anchor: 'overview-5-quality-commands',
          level: 2,
        },
        {
          text: 'Current scope',
          anchor: 'overview-6-current-scope',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'overview-7-customize-and-extend-safely',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Nodics Axis is the reusable Back Office frontend for a single Nodics-based customer project deployment.',
        },
        {
          kind: 'paragraph',
          text: 'Canonical user and contributor documentation is authored as granular pages under `content/documentation` and deterministically generated into the committed CMS import release under `data/core`. The retired legacy `docs/` files remain accounted for in the migration register after coverage, detail-preservation, generated-pack, and rendered-content gates approved their replacement.',
        },
        {
          kind: 'paragraph',
          text: 'Axis is a client-side web application. It authenticates human users through Profile, retrieves an authorized bootstrap contract from Back Office, and then calls the authoritative APIs of discovered Nodics modules directly.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Boundaries',
          anchor: 'overview-1-boundaries',
        },
        {
          kind: 'unordered-list',
          items: [
            'Nodics remains the backend and API authority.',
            'Axis contains presentation and interaction behavior, not authoritative business logic.',
            'Every customer project has an isolated Axis deployment.',
            'Axis does not depend on whether Nodics runs as a monoServer or distributed module servers.',
            'CMS descriptors can select Axis-owned components but cannot deliver executable frontend code.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'See [Axis Architecture and Ownership](/docs/nodics-axis/architecture) for the per-customer deployment model, repository responsibilities, contract authority, security boundary, and verification expectations.',
        },
        {
          kind: 'paragraph',
          text: 'See [Frontend Technology Stack](/docs/nodics-axis/technology-stack) for the approved tools, state ownership, styling decision, repository shape, and dependency-governance rules.',
        },
        {
          kind: 'paragraph',
          text: 'Use the [Feature Delivery Checklist](/docs/nodics-axis/feature-delivery) for repository-boundary analysis, security, contract testing, accessibility, documentation placement, and completion evidence for every Axis slice.',
        },
        {
          kind: 'paragraph',
          text: 'Read the [Axis Implementation And Documentation Contract](/docs/nodics-axis/implementation-contract) for partial-discovery rules, repository placement, required use cases, and the acceptance contract followed by human developers and AI tools.',
        },
        {
          kind: 'paragraph',
          text: 'See [CMS Delivery and Renderer Integration](/docs/nodics-axis/cms-renderers) for the resolved-page client, trusted renderer boundary, validation rules, cache isolation, and login integration.',
        },
        {
          kind: 'paragraph',
          text: 'See [Documentation Content In Axis](/docs/nodics-axis/documentation-content) for dynamic Framework, Swaggers, Nodics Axis, and future project documentation sources; per-product CMS catalogs; the import-ready Axis content pack; renderer ownership; security boundaries; and failure behavior.',
        },
        {
          kind: 'paragraph',
          text: 'See [Module Health](/docs/nodics-axis/module-health) for backend-driven operational navigation, the typed registry client, module and node readiness presentation, security boundaries, responsive behavior, and extension rules.',
        },
        {
          kind: 'paragraph',
          text: 'See [Imports and Exports](/docs/nodics-axis/imports-exports) for immutable init, core, and sample release discovery, validation, installation, history, security, and the intentionally disabled export surface.',
        },
        {
          kind: 'paragraph',
          text: 'See [Employee Login, Recovery, Screen Lock, and Dashboard](/docs/nodics-axis/employee-access) for startup discovery, employee-only authentication, persistent BackOffice policy consumption, protected routing, logout, and failure recovery.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Prerequisites',
          anchor: 'overview-2-prerequisites',
        },
        {
          kind: 'unordered-list',
          items: [
            'Node.js 24',
            'npm 10 or 11',
            'A local Nodics backend when integration behavior is required',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Start locally',
          anchor: 'overview-3-start-locally',
        },
        {
          kind: 'paragraph',
          text: 'Start the Nodics Kickoff backend servers in separate terminals:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'cd ../nodics.kickoff\nnpm run start:platform\nnpm run start:wcms',
        },
        {
          kind: 'paragraph',
          text: 'Install and start Axis:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm ci\nnpm run dev',
        },
        {
          kind: 'paragraph',
          text: 'Axis runs at <http://localhost:3100>.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Environment and runtime configuration',
          anchor: 'overview-4-environment-and-runtime-configuration',
        },
        {
          kind: 'paragraph',
          text: 'Copy `.env.example` to `.env` and configure the local/build values there. The repository includes a safe local `.env`; Git ignores it so each developer or deployment can use different values.',
        },
        {
          kind: 'code',
          language: 'dotenv',
          text: 'AXIS_BACKOFFICE_BASE_URL=http://localhost:3000\nAXIS_ENTERPRISE_CODE=default\nAXIS_CLIENT_CONTRACT_VERSION=1\nAXIS_REQUEST_TIMEOUT_MS=10000\nAXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf\nAXIS_ASSISTANT_MAXIMUM_EVENT_BYTES=65536\nAXIS_ASSISTANT_RECONNECT_WINDOW_MS=120000\nAXIS_ASSISTANT_IDLE_TIMEOUT_MS=45000\nAXIS_DEV_HOST=0.0.0.0\nAXIS_DEV_PORT=3100\nAXIS_STRICT_PORT=true\nAXIS_BUILD_SOURCEMAP=true',
        },
        {
          kind: 'paragraph',
          text: 'Vite validates these values and generates `/axis-config.json`:',
        },
        {
          kind: 'code',
          language: 'json',
          text: '{\n  "backofficeBaseUrl": "http://localhost:3000",\n  "enterpriseCode": "default",\n  "clientContractVersion": 1,\n  "requestTimeoutMs": 10000,\n  "browserSessionCsrfCookieName": "nodics_axis_csrf",\n  "assistantMaximumEventBytes": 65536,\n  "assistantReconnectWindowMs": 120000,\n  "assistantIdleTimeoutMs": 45000\n}',
        },
        {
          kind: 'paragraph',
          text: "Axis loads that document and then obtains the active Profile and CMS endpoints from BackOffice's low-disclosure public bootstrap. Axis does not maintain a second module endpoint list. Invalid or unavailable configuration produces a recovery screen instead of attempting authentication.",
        },
        {
          kind: 'paragraph',
          text: '`.env` and `axis-config.json` are public configuration, not secret stores. Never place passwords, tokens, API keys, private keys, or credentials in them. Only explicitly named `AXIS_*` variables are consumed; Axis does not expose arbitrary environment variables to browser code.',
        },
        {
          kind: 'paragraph',
          text: 'For production, the generated `dist/axis-config.json` may be replaced during deployment so endpoints can change without rebuilding Axis. Serve it with `Cache-Control: no-store`. Serve hashed assets with long-lived immutable caching.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Quality commands',
          anchor: 'overview-5-quality-commands',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run format:check\nnpm run lint\nnpm run typecheck\nnpm run test\nnpm run build\nnpm run verify',
        },
        {
          kind: 'paragraph',
          text: 'The implemented Gold and Charcoal foundations, responsive shell, recovery states, accessibility behavior, and extension rules are documented in [Axis Design System And Static Shell](/docs/nodics-axis/design-system).',
        },
        {
          kind: 'paragraph',
          text: 'The implemented authenticated Assistant CMS route, renderer hierarchy, direct-module connection validation, and typed HTTP client are documented in [Axis Assistant Frontend](/docs/nodics-axis/assistant).',
        },
        {
          kind: 'paragraph',
          text: 'The implemented Schema Workbench discovery, schema browser, bounded record list, relationship editor, record detail, Create, Update, and governed Delete are documented in [Axis Schema Workbench](/docs/nodics-axis/schema-workbench).',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Current scope',
          anchor: 'overview-6-current-scope',
        },
        {
          kind: 'paragraph',
          text: 'The current foundation proves the frontend runtime boundary, safe startup, CMS delivery/renderers, employee authentication, secured BackOffice bootstrap, CMS-driven login/recovery/lock pages, idle screen locking, protected dashboard routing, logout, the CMS-driven Assistant workspace shell, typed Assistant HTTP contracts, authenticated resumable SSE transport, isolated Assistant presentation state, and the CMS-driven Schema Workbench browser with direct-module schema discovery, bounded record reads, and independent Address and Contact creation, relationship coordination, record detail, generated Update, and governed Delete. The Operations workspace includes Module Health with permission-filtered navigation, module summaries, on-demand registered node details, and governed refresh. Visual designers remain future slices.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'overview-7-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Use Axis as the reusable frontend base and place customer-specific pages, renderers, typed clients, theme composition, and CMS presentation data in the customer Axis project. Keep customer business services, schemas, workflows, permissions, and API implementations in its Nodics backend project.',
        },
        {
          kind: 'paragraph',
          text: 'The smallest extension adds one focused feature directory, one backend-driven navigation or renderer contract, and mirrored tests. Do not modify reusable framework behavior for customer needs, hardcode backend-owned labels, create a parallel module registry, or move authorization into the browser. Prove startup, permission, contract-version, malformed-data, failure recovery, responsive and WebView, integration, regression, and production-build behavior. Rollback removes the customer registration and deployment artifact without mutating Nodics-owned persisted contracts.',
        },
      ],
      searchText:
        'What Is Nodics Axis? Understand Axis, its backend boundary, supported runtime, setup, configuration, quality commands, and implemented scope. # Nodics Axis\n\nNodics Axis is the reusable Back Office frontend for a single Nodics-based\ncustomer project deployment.\n\nCanonical user and contributor documentation is authored as granular pages\nunder `content/documentation` and deterministically generated into the committed\nCMS import release under `data/core`. The retired legacy `docs/` files remain\naccounted for in the migration register after coverage, detail-preservation,\ngenerated-pack, and rendered-content gates approved their replacement.\n\nAxis is a client-side web application. It authenticates human users through\nProfile, retrieves an authorized bootstrap contract from Back Office, and then\ncalls the authoritative APIs of discovered Nodics modules directly.\n\n## Boundaries\n\n- Nodics remains the backend and API authority.\n- Axis contains presentation and interaction behavior, not authoritative\n  business logic.\n- Every customer project has an isolated Axis deployment.\n- Axis does not depend on whether Nodics runs as a monoServer or distributed\n  module servers.\n- CMS descriptors can select Axis-owned components but cannot deliver\n  executable frontend code.\n\nSee\n[Axis Architecture and Ownership](architecture-and-ownership.md) for the\nper-customer deployment model, repository responsibilities, contract authority,\nsecurity boundary, and verification expectations.\n\nSee [Frontend Technology Stack](frontend-technology-stack.md) for the\napproved tools, state ownership, styling decision, repository shape, and\ndependency-governance rules.\n\nUse the [Feature Delivery Checklist](feature-delivery-checklist.md) for\nrepository-boundary analysis, security, contract testing, accessibility,\ndocumentation placement, and completion evidence for every Axis slice.\n\nRead the\n[Axis Implementation And Documentation Contract](implementation-and-documentation-contract.md)\nfor partial-discovery rules, repository placement, required use cases, and the\nacceptance contract followed by human developers and AI tools.\n\nSee [CMS Delivery and Renderer Integration](cms-delivery-and-renderers.md)\nfor the resolved-page client, trusted renderer boundary, validation rules,\ncache isolation, and login integration.\n\nSee [Documentation Content In Axis](documentation-content.md) for dynamic\nFramework, Swaggers, Nodics Axis, and future project documentation sources;\nper-product CMS catalogs; the import-ready Axis content pack; renderer\nownership; security boundaries; and failure behavior.\n\nSee [Module Health](module-health.md) for backend-driven operational\nnavigation, the typed registry client, module and node readiness presentation,\nsecurity boundaries, responsive behavior, and extension rules.\n\nSee [Imports and Exports](imports-and-exports.md) for immutable init, core,\nand sample release discovery, validation, installation, history, security, and\nthe intentionally disabled export surface.\n\nSee [Employee Login, Recovery, Screen Lock, and Dashboard](employee-login.md)\nfor startup discovery, employee-only authentication, persistent BackOffice\npolicy consumption, protected routing, logout, and failure recovery.\n\n## Prerequisites\n\n- Node.js 24\n- npm 10 or 11\n- A local Nodics backend when integration behavior is required\n\n## Start locally\n\nStart the Nodics Kickoff backend servers in separate terminals:\n\n```bash\ncd ../nodics.kickoff\nnpm run start:platform\nnpm run start:wcms\n```\n\nInstall and start Axis:\n\n```bash\nnpm ci\nnpm run dev\n```\n\nAxis runs at <http://localhost:3100>.\n\n## Environment and runtime configuration\n\nCopy `.env.example` to `.env` and configure the local/build values there.\nThe repository includes a safe local `.env`; Git ignores it so each developer\nor deployment can use different values.\n\n```dotenv\nAXIS_BACKOFFICE_BASE_URL=http://localhost:3000\nAXIS_ENTERPRISE_CODE=default\nAXIS_CLIENT_CONTRACT_VERSION=1\nAXIS_REQUEST_TIMEOUT_MS=10000\nAXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf\nAXIS_ASSISTANT_MAXIMUM_EVENT_BYTES=65536\nAXIS_ASSISTANT_RECONNECT_WINDOW_MS=120000\nAXIS_ASSISTANT_IDLE_TIMEOUT_MS=45000\nAXIS_DEV_HOST=0.0.0.0\nAXIS_DEV_PORT=3100\nAXIS_STRICT_PORT=true\nAXIS_BUILD_SOURCEMAP=true\n```\n\nVite validates these values and generates `/axis-config.json`:\n\n```json\n{\n  "backofficeBaseUrl": "http://localhost:3000",\n  "enterpriseCode": "default",\n  "clientContractVersion": 1,\n  "requestTimeoutMs": 10000,\n  "browserSessionCsrfCookieName": "nodics_axis_csrf",\n  "assistantMaximumEventBytes": 65536,\n  "assistantReconnectWindowMs": 120000,\n  "assistantIdleTimeoutMs": 45000\n}\n```\n\nAxis loads that document and then obtains the active Profile and CMS endpoints\nfrom BackOffice\'s low-disclosure public bootstrap. Axis does not maintain a\nsecond module endpoint list.\nInvalid or unavailable configuration produces a recovery screen instead of\nattempting authentication.\n\n`.env` and `axis-config.json` are public configuration, not secret stores.\nNever place passwords, tokens, API keys, private keys, or credentials in them.\nOnly explicitly named `AXIS_*` variables are consumed; Axis does not expose\narbitrary environment variables to browser code.\n\nFor production, the generated `dist/axis-config.json` may be replaced during\ndeployment so endpoints can change without rebuilding Axis. Serve it with\n`Cache-Control: no-store`. Serve hashed assets with long-lived immutable\ncaching.\n\n## Quality commands\n\n```bash\nnpm run format:check\nnpm run lint\nnpm run typecheck\nnpm run test\nnpm run build\nnpm run verify\n```\n\nThe implemented Gold and Charcoal foundations, responsive shell, recovery\nstates, accessibility behavior, and extension rules are documented in\n[Axis Design System And Static Shell](design-system-and-shell.md).\n\nThe implemented authenticated Assistant CMS route, renderer hierarchy,\ndirect-module connection validation, and typed HTTP client are documented in\n[Axis Assistant Frontend](assistant-frontend.md).\n\nThe implemented Schema Workbench discovery, schema browser, bounded record\nlist, relationship editor, record detail, Create, Update, and governed Delete\nare documented in\n[Axis Schema Workbench](schema-workbench.md).\n\n## Current scope\n\nThe current foundation proves the frontend runtime boundary, safe startup, CMS\ndelivery/renderers, employee authentication, secured BackOffice bootstrap,\nCMS-driven login/recovery/lock pages, idle screen locking, protected dashboard\nrouting, logout, the CMS-driven Assistant workspace shell, typed Assistant HTTP\ncontracts, authenticated resumable SSE transport, isolated Assistant\npresentation state, and the CMS-driven Schema Workbench browser with\ndirect-module schema discovery, bounded record reads, and independent Address\nand Contact creation, relationship coordination, record detail, generated\nUpdate, and governed Delete. The Operations workspace includes Module Health\nwith permission-filtered navigation, module summaries, on-demand registered\nnode details, and governed refresh. Visual designers remain future slices.\n\n## Customize and extend safely\n\nUse Axis as the reusable frontend base and place customer-specific pages,\nrenderers, typed clients, theme composition, and CMS presentation data in the\ncustomer Axis project. Keep customer business services, schemas, workflows,\npermissions, and API implementations in its Nodics backend project.\n\nThe smallest extension adds one focused feature directory, one backend-driven\nnavigation or renderer contract, and mirrored tests. Do not modify reusable\nframework behavior for customer needs, hardcode backend-owned labels, create a\nparallel module registry, or move authorization into the browser. Prove\nstartup, permission, contract-version, malformed-data, failure recovery,\nresponsive and WebView, integration, regression, and production-build\nbehavior. Rollback removes the customer registration and deployment artifact\nwithout mutating Nodics-owned persisted contracts.\n',
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/project-overview.md',
        evidence: 'README.md',
        hash: '4a988ab89c7e4092e0129811a0bf9adc336aff11703b3e114f837cd6818c5320',
        version: '0.3.19',
      },
      next: {
        title: 'Architecture and Repository Boundaries',
        route: '/docs/nodics-axis/architecture',
      },
    },
    active: true,
  },
  record2: {
    code: 'axisDocsComponentarchitecture',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.architecture',
      title: 'Architecture and Repository Boundaries',
      route: '/docs/nodics-axis/architecture',
      section: 'discover-axis',
      sectionTitle: 'Discover Axis',
      category: 'Discover Axis',
      audience: ['architect', 'developer', 'security-reviewer', 'ai-tool'],
      summary:
        'Learn the per-project deployment model, contract authority, security boundary, documentation ownership, and verification expectations.',
      headings: [
        {
          text: 'Decision',
          anchor: 'architecture-1-decision',
          level: 2,
        },
        {
          text: 'Deployment model',
          anchor: 'architecture-2-deployment-model',
          level: 2,
        },
        {
          text: 'Contract authority',
          anchor: 'architecture-3-contract-authority',
          level: 2,
        },
        {
          text: 'Security boundary',
          anchor: 'architecture-4-security-boundary',
          level: 2,
        },
        {
          text: 'Documentation ownership',
          anchor: 'architecture-5-documentation-ownership',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'architecture-6-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Verification expectations',
          anchor: 'architecture-7-verification-expectations',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Decision',
          anchor: 'architecture-1-decision',
        },
        {
          kind: 'paragraph',
          text: 'Nodics Axis is a reusable Back Office browser application deployed once for each Nodics-based customer project. The Axis process and the Nodics backend processes are built, started, scaled, deployed, and rolled back independently. One Axis deployment must not switch between customer projects or federate their backend endpoints.',
        },
        {
          kind: 'paragraph',
          text: 'This decision keeps a clear authority boundary:',
        },
        {
          kind: 'unordered-list',
          items: [
            'Nodics owns business rules, persistence, authentication enforcement, authorization, workflows, pipelines, integrations, secrets, tenant governance, runtime contracts, and module APIs.',
            'Axis owns browser rendering, interaction, accessibility, responsive behavior, and non-authoritative client view state.',
            'Profile authenticates human users.',
            "BackOffice returns the caller's authorized, browser-safe module registry and compatibility metadata.",
            'After bootstrap, Axis calls each authoritative module directly. BackOffice does not proxy normal CMS, job, workflow, configuration, or business traffic.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Deployment model',
          anchor: 'architecture-2-deployment-model',
        },
        {
          kind: 'code',
          language: 'text',
          text: 'Customer project A\n  Axis deployment A\n    -> Profile A\n    -> BackOffice A -> authorized module discovery\n    -> CMS A, Workflow A, CronJob A, and other discovered modules\n\nCustomer project B\n  Axis deployment B\n    -> Profile B\n    -> BackOffice B -> authorized module discovery\n    -> project B modules',
        },
        {
          kind: 'paragraph',
          text: "Axis deployment A must never discover, select, or call project B endpoints. Whether a project's Nodics modules run together in `monoServer` or as distributed module servers does not change the browser contract.",
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Contract authority',
          anchor: 'architecture-3-contract-authority',
        },
        {
          kind: 'paragraph',
          text: 'Axis consumes versioned backend contracts such as OpenAPI, Profile authentication, BackOffice bootstrap, permissions, schemas, and module operation metadata. Generated or handwritten Axis clients are consumers of those contracts; they do not become contract authorities.',
        },
        {
          kind: 'paragraph',
          text: 'Axis must not:',
        },
        {
          kind: 'unordered-list',
          items: [
            'import source from the sibling Nodics checkout;',
            'embed backend services or persistence;',
            'reproduce authoritative validation or permission decisions;',
            'execute workflows, pipelines, integrations, AI tools, or arbitrary scripts in the browser;',
            'store service or CronJob credentials;',
            'create a second registry, schema authority, runtime loader, or endpoint federation layer.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Client-side validation may improve usability, but every target module must validate and authorize the request independently.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Security boundary',
          anchor: 'architecture-4-security-boundary',
        },
        {
          kind: 'paragraph',
          text: 'Human browser authentication remains separate from module-to-module and CronJob authentication. Axis may receive only browser-safe configuration, human-session material approved by the Profile browser-security contract, and permission-filtered module metadata. Passwords, access tokens, refresh tokens, service credentials, and secrets must never be written to browser storage, URLs, logs, or telemetry.',
        },
        {
          kind: 'paragraph',
          text: 'Detailed session, refresh, revocation, CORS, CSRF, CSP, and audience behavior will be documented only after the corresponding backend contracts are approved and implemented.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Documentation ownership',
          anchor: 'architecture-5-documentation-ownership',
        },
        {
          kind: 'unordered-list',
          items: [
            'This repository documents Axis installation, build, deployment, frontend contribution rules, browser architecture, accessibility, and implemented UI behavior.',
            'The Nodics repository documents product capabilities, business-user and administrator journeys, backend APIs, security enforcement, module configuration, operations, and backend customization.',
            'Temporary plans describe intended work only and must not be presented as implemented capability.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'architecture-6-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: "Create customer behavior in the customer backend project and customer presentation in its Axis project layer. A frontend extension may add a focused page, renderer, typed client, hook, and mirrored test, but it must continue to consume the owning Nodics module's versioned API and permission contract.",
        },
        {
          kind: 'paragraph',
          text: 'The smallest safe extension is one new renderer file plus one typed registry entry for a backend-issued logical renderer key. Do not copy BackOffice discovery, create a browser module registry, move validation or workflow into React, or edit reusable Nodics framework source. Prove the extension with contract-version, unauthorized, malformed-payload, responsive, integration, and production-build tests. Rollback removes the project registry entry while leaving the backend authority and persisted data unchanged.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification expectations',
          anchor: 'architecture-7-verification-expectations',
        },
        {
          kind: 'paragraph',
          text: 'Every Axis slice must identify:',
        },
        {
          kind: 'ordered-list',
          items: [
            'its authoritative backend owner and versioned contract;',
            'its Axis presentation and local-state responsibilities;',
            'authentication, authorization, tenant, and data-exposure boundaries;',
            'tests belonging to each repository;',
            'documentation belonging to each repository.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Implementation must cover applicable positive, negative, boundary, contract, security, responsive, accessibility, integration, recovery, and regression behavior. Run `npm run verify` before release-oriented commits.',
        },
      ],
      searchText:
        "Architecture and Repository Boundaries Learn the per-project deployment model, contract authority, security boundary, documentation ownership, and verification expectations. # Axis Architecture and Ownership\n\n## Decision\n\nNodics Axis is a reusable Back Office browser application deployed once for\neach Nodics-based customer project. The Axis process and the Nodics backend\nprocesses are built, started, scaled, deployed, and rolled back independently.\nOne Axis deployment must not switch between customer projects or federate\ntheir backend endpoints.\n\nThis decision keeps a clear authority boundary:\n\n- Nodics owns business rules, persistence, authentication enforcement,\n  authorization, workflows, pipelines, integrations, secrets, tenant\n  governance, runtime contracts, and module APIs.\n- Axis owns browser rendering, interaction, accessibility, responsive\n  behavior, and non-authoritative client view state.\n- Profile authenticates human users.\n- BackOffice returns the caller's authorized, browser-safe module registry and\n  compatibility metadata.\n- After bootstrap, Axis calls each authoritative module directly. BackOffice\n  does not proxy normal CMS, job, workflow, configuration, or business traffic.\n\n## Deployment model\n\n```text\nCustomer project A\n  Axis deployment A\n    -> Profile A\n    -> BackOffice A -> authorized module discovery\n    -> CMS A, Workflow A, CronJob A, and other discovered modules\n\nCustomer project B\n  Axis deployment B\n    -> Profile B\n    -> BackOffice B -> authorized module discovery\n    -> project B modules\n```\n\nAxis deployment A must never discover, select, or call project B endpoints.\nWhether a project's Nodics modules run together in `monoServer` or as\ndistributed module servers does not change the browser contract.\n\n## Contract authority\n\nAxis consumes versioned backend contracts such as OpenAPI, Profile\nauthentication, BackOffice bootstrap, permissions, schemas, and module\noperation metadata. Generated or handwritten Axis clients are consumers of\nthose contracts; they do not become contract authorities.\n\nAxis must not:\n\n- import source from the sibling Nodics checkout;\n- embed backend services or persistence;\n- reproduce authoritative validation or permission decisions;\n- execute workflows, pipelines, integrations, AI tools, or arbitrary scripts\n  in the browser;\n- store service or CronJob credentials;\n- create a second registry, schema authority, runtime loader, or endpoint\n  federation layer.\n\nClient-side validation may improve usability, but every target module must\nvalidate and authorize the request independently.\n\n## Security boundary\n\nHuman browser authentication remains separate from module-to-module and\nCronJob authentication. Axis may receive only browser-safe configuration,\nhuman-session material approved by the Profile browser-security contract, and\npermission-filtered module metadata. Passwords, access tokens, refresh tokens,\nservice credentials, and secrets must never be written to browser storage,\nURLs, logs, or telemetry.\n\nDetailed session, refresh, revocation, CORS, CSRF, CSP, and audience behavior\nwill be documented only after the corresponding backend contracts are\napproved and implemented.\n\n## Documentation ownership\n\n- This repository documents Axis installation, build, deployment, frontend\n  contribution rules, browser architecture, accessibility, and implemented UI\n  behavior.\n- The Nodics repository documents product capabilities, business-user and\n  administrator journeys, backend APIs, security enforcement, module\n  configuration, operations, and backend customization.\n- Temporary plans describe intended work only and must not be presented as\n  implemented capability.\n\n## Customize and extend safely\n\nCreate customer behavior in the customer backend project and customer\npresentation in its Axis project layer. A frontend extension may add a focused\npage, renderer, typed client, hook, and mirrored test, but it must continue to\nconsume the owning Nodics module's versioned API and permission contract.\n\nThe smallest safe extension is one new renderer file plus one typed registry\nentry for a backend-issued logical renderer key. Do not copy BackOffice\ndiscovery, create a browser module registry, move validation or workflow into\nReact, or edit reusable Nodics framework source. Prove the extension with\ncontract-version, unauthorized, malformed-payload, responsive, integration,\nand production-build tests. Rollback removes the project registry entry while\nleaving the backend authority and persisted data unchanged.\n\n## Verification expectations\n\nEvery Axis slice must identify:\n\n1. its authoritative backend owner and versioned contract;\n2. its Axis presentation and local-state responsibilities;\n3. authentication, authorization, tenant, and data-exposure boundaries;\n4. tests belonging to each repository;\n5. documentation belonging to each repository.\n\nImplementation must cover applicable positive, negative, boundary, contract,\nsecurity, responsive, accessibility, integration, recovery, and regression\nbehavior. Run `npm run verify` before release-oriented commits.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/architecture-and-ownership.md',
        evidence: 'docs/architecture-and-ownership.md',
        hash: 'f47604672729255bb987075b091a9ced856766fdb0b699f3f4f6037d3439293c',
        version: '0.3.19',
      },
      previous: {
        title: 'What Is Nodics Axis?',
        route: '/docs/nodics-axis',
      },
      next: {
        title: 'Frontend Technology Stack',
        route: '/docs/nodics-axis/technology-stack',
      },
    },
    active: true,
  },
  record3: {
    code: 'axisDocsComponenttechnologystack',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.technology-stack',
      title: 'Frontend Technology Stack',
      route: '/docs/nodics-axis/technology-stack',
      section: 'build-and-operate-axis',
      sectionTitle: 'Build and Operate Axis',
      category: 'Build and Operate Axis',
      audience: ['developer', 'operator', 'architect', 'ai-tool'],
      summary:
        'Review exact package versions, state ownership, styling, repository shape, renderer organization, dependency governance, and verification.',
      headings: [
        {
          text: 'Selected foundation',
          anchor: 'technology-stack-1-selected-foundation',
          level: 2,
        },
        {
          text: 'State ownership',
          anchor: 'technology-stack-2-state-ownership',
          level: 2,
        },
        {
          text: 'Styling decision',
          anchor: 'technology-stack-3-styling-decision',
          level: 2,
        },
        {
          text: 'Repository shape',
          anchor: 'technology-stack-4-repository-shape',
          level: 2,
        },
        {
          text: 'CMS renderer organization',
          anchor: 'technology-stack-5-cms-renderer-organization',
          level: 2,
        },
        {
          text: 'Dependency decision rule',
          anchor: 'technology-stack-6-dependency-decision-rule',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'technology-stack-7-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Verification',
          anchor: 'technology-stack-8-verification',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Selected foundation',
          anchor: 'technology-stack-1-selected-foundation',
        },
        {
          kind: 'paragraph',
          text: 'Nodics Axis uses one cohesive frontend application until demonstrated reuse and stable contracts justify extracting packages.',
        },
        {
          kind: 'table',
          headers: [
            'Concern',
            'Selected technology',
            'Current version',
            'Responsibility',
          ],
          rows: [
            [
              'Package management',
              'npm',
              '11.6.2',
              'Reproducible dependency installation from `package-lock.json`',
            ],
            [
              'UI runtime',
              'React / React DOM',
              '19.2.8',
              'Axis-owned browser rendering and interaction',
            ],
            [
              'Language',
              'TypeScript in strict mode',
              '6.0.3',
              'Compile-time safety across UI and contract consumers',
            ],
            [
              'Build and local server',
              'Vite',
              '8.1.5',
              'Development server and immutable production assets',
            ],
            [
              'Client routing',
              'React Router',
              '8.3.0',
              'Static recovery routes and authorized application navigation',
            ],
            [
              'Server state',
              'TanStack Query',
              '5.101.4',
              'Request lifecycle, caching, cancellation, and invalidation for backend-owned data',
            ],
            [
              'Component foundation',
              'MUI',
              '9.2.0',
              'Accessible primitives and Nodics-owned tokens and components',
            ],
            [
              'Styling runtime',
              'Emotion React / Styled',
              '11.14.0/11.14.1',
              'Material UI styling and theme-aware presentation',
            ],
            [
              'Unit and component tests',
              'Vitest / Testing Library React',
              '4.1.10/16.3.2',
              'User-observable frontend behavior and contract-consumer tests',
            ],
            [
              'Browser test environment',
              'jsdom',
              '29.1.1',
              'Browser DOM behavior in automated tests',
            ],
            [
              'Static quality',
              'ESLint / typescript-eslint',
              '9.39.5/8.65.0',
              'TypeScript and React code-quality rules',
            ],
            [
              'Formatting',
              'Prettier',
              '3.8.1',
              'Consistent source and documentation formatting',
            ],
          ],
        },
        {
          kind: 'paragraph',
          text: 'Supported engines and direct versions are declared in `package.json` and the complete dependency graph is locked in `package-lock.json`. Those files remain the dependency authority. The table is an operator-friendly snapshot and must be updated in the same change whenever a listed package version changes.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'State ownership',
          anchor: 'technology-stack-2-state-ownership',
        },
        {
          kind: 'unordered-list',
          items: [
            'TanStack Query owns remote server state and request lifecycle.',
            'Presentation state stays close to the route or feature that owns it.',
            'Backend modules remain authoritative for persisted state, validation, authorization, workflows, and business outcomes.',
            'Axis must not create a browser store that becomes a second copy of backend registry, permission, workflow, publication, or tenant authority.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'A dedicated global client-state dependency may be considered only when a measured cross-feature problem cannot be handled safely by React composition, route state, or TanStack Query.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Styling decision',
          anchor: 'technology-stack-3-styling-decision',
        },
        {
          kind: 'paragraph',
          text: 'Axis uses MUI primitives, Emotion, and original Nodics design tokens. Tailwind is not part of the selected runtime. Commercial administration templates may inform information grouping only; their source code, components, assets, layouts, and branding are not dependencies.',
        },
        {
          kind: 'paragraph',
          text: 'The design system must preserve keyboard operation, screen-reader support, responsive behavior, reduced motion, mobile WebView compatibility, and the fixed comfortable workspace density.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Repository shape',
          anchor: 'technology-stack-4-repository-shape',
        },
        {
          kind: 'paragraph',
          text: 'Axis starts as one application repository with cohesive feature boundaries. It is not a mandatory monorepo. A package may be extracted later only when:',
        },
        {
          kind: 'ordered-list',
          items: [
            'two or more real consumers need the same stable capability;',
            'its public contract and ownership are explicit;',
            'extraction does not duplicate a Nodics backend authority;',
            'independent versioning and testing provide a demonstrated benefit.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'This avoids package boundaries that add governance and release overhead before the product has stable reuse seams.',
        },
        {
          kind: 'paragraph',
          text: 'Production code belongs under `src/`. Tests belong under the root `test/` directory and mirror the production feature boundaries, for example `src/cms/` and `test/cms/`. Test-only fixtures belong below the matching test feature and must not be imported by production code. `config/typescript/tsconfig.app.json` strictly checks runtime source, while `config/typescript/tsconfig.test.json` strictly checks the separate test tree.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'CMS renderer organization',
          anchor: 'technology-stack-5-cms-renderer-organization',
        },
        {
          kind: 'paragraph',
          text: 'CMS sends composition data and logical renderer contracts; Axis owns every executable renderer. Renderer source follows a strict, navigable hierarchy:',
        },
        {
          kind: 'code',
          language: 'text',
          text: 'src/cms/renderers/\n├── pages/                  # one page renderer per file\n├── templates/              # one template renderer per file\n├── components/\n│   ├── authentication/     # authentication-specific component renderers\n│   ├── dashboard/          # dashboard-specific component renderers\n│   ├── media/              # Media Management workspace renderer\n│   └── shared/             # genuinely reusable component renderers\n├── registry/               # typed logical-key mappings and contract manifest\n└── shared/                 # renderer-only types, guards, and property readers',
        },
        {
          kind: 'paragraph',
          text: 'Do not add a generic file containing multiple unrelated renderer implementations. A new CMS renderer requires:',
        },
        {
          kind: 'ordered-list',
          items: [
            'one focused renderer file in the correct capability directory;',
            'one typed registry mapping from the backend logical key;',
            'one renderer-manifest entry declaring kind and supported contract version;',
            'focused tests in the mirrored `test/cms/renderers` hierarchy; and',
            'safe failure for unknown keys, incompatible versions, or invalid properties.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Reusable renderers are grouped by capability rather than copied into every page. Page-specific placement is reserved for a renderer contract deliberately owned by only that page. Backend data must never contain a TypeScript import, React component name, executable file path, script URL, or HTML implementation.',
        },
        {
          kind: 'paragraph',
          text: 'Reusable interaction patterns follow the same rule. A capability such as schema query building, record filtering, media selection, relationship selection, or any later business-data picker should be implemented once as a generic Axis-owned component or CMS component renderer and then composed by pages that need it. For example, the Schema Query Builder is a shared workbench capability: Schema Workbench, Imports and Exports, and future schema-backed pages should reuse the same implementation instead of creating separate query widgets.',
        },
        {
          kind: 'paragraph',
          text: 'Workspace title help follows the same reusable rule. Use the shared `WorkspaceHelpActions` or `WorkspaceHeading` primitives for page, workspace, and major component headings that need business context or a documentation handoff. BackOffice navigation and CMS component content may provide bounded `help.summary`, `help.documentationRoute`, and `help.documentationFragment` metadata. Axis renders the reusable info and documentation icons, opens docs links in a new tab, and must not replace those metadata contracts with hardcoded per-page tooltip maps. For business objects and framework-owned capabilities, documentation routes should point to the canonical framework or module documentation that explains concept, implementation, lifecycle, configuration, customization, security, and verification. Short Nodics Axis documentation is appropriate only for Axis-specific UI behavior.',
        },
        {
          kind: 'paragraph',
          text: 'The content catalog may declare that a generic component is needed and may provide labels, placeholders, help text, default presentation options, and a logical renderer key. It must not become the query authority. Searchable fields, filter operators, sort rules, page-size limits, authorization, and execution remain backend-owned contracts delivered by the relevant Nodics module. Axis owns the executable renderer and keeps it safe, typed, localized, responsive, and reusable.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Dependency decision rule',
          anchor: 'technology-stack-6-dependency-decision-rule',
        },
        {
          kind: 'paragraph',
          text: 'Before adding a frontend dependency:',
        },
        {
          kind: 'ordered-list',
          items: [
            'reuse an installed capability when it satisfies the requirement;',
            'compose or extend an existing Axis pattern when safe;',
            'document why the current stack cannot provide the capability;',
            'review bundle, security, maintenance, accessibility, browser, WebView, and licensing impact;',
            'add focused tests and update this decision when the architectural stack changes.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Axis must not add a dependency that executes backend business processes, stores secrets, downloads executable CMS code, or creates an alternate contract authority.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'technology-stack-7-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Extend the stack through a focused project-owned feature directory, existing React and TypeScript composition, shared theme tokens, a typed backend client, and mirrored tests. Prefer an installed dependency or existing pattern; when a new package is necessary, document its exact supported version, browser and WebView impact, bundle cost, security and licensing review, and upgrade and removal procedure.',
        },
        {
          kind: 'paragraph',
          text: 'Do not fork the application shell, create another state or API authority, download executable CMS code, or hide business rules in components. Verify type safety, lint and formatting, accessibility, narrow and touch layouts, contract rejection, integration behavior, bundle output, and clean removal of the extension.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification',
          anchor: 'technology-stack-8-verification',
        },
        {
          kind: 'paragraph',
          text: 'Use:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm ci\nnpm run verify',
        },
        {
          kind: 'paragraph',
          text: 'The verification gate checks formatting, linting, strict TypeScript, unit/component tests, and the production build.',
        },
      ],
      searchText:
        'Frontend Technology Stack Review exact package versions, state ownership, styling, repository shape, renderer organization, dependency governance, and verification. # Frontend Technology Stack\n\n## Selected foundation\n\nNodics Axis uses one cohesive frontend application until demonstrated reuse\nand stable contracts justify extracting packages.\n\n| Concern                  | Selected technology            | Current version | Responsibility                                                                    |\n| ------------------------ | ------------------------------ | --------------- | --------------------------------------------------------------------------------- |\n| Package management       | npm                            | 11.6.2          | Reproducible dependency installation from `package-lock.json`                     |\n| UI runtime               | React / React DOM              | 19.2.8          | Axis-owned browser rendering and interaction                                      |\n| Language                 | TypeScript in strict mode      | 6.0.3           | Compile-time safety across UI and contract consumers                              |\n| Build and local server   | Vite                           | 8.1.5           | Development server and immutable production assets                                |\n| Client routing           | React Router                   | 8.3.0           | Static recovery routes and authorized application navigation                      |\n| Server state             | TanStack Query                 | 5.101.4         | Request lifecycle, caching, cancellation, and invalidation for backend-owned data |\n| Component foundation     | MUI                            | 9.2.0           | Accessible primitives and Nodics-owned tokens and components                      |\n| Styling runtime          | Emotion React / Styled         | 11.14.0/11.14.1 | Material UI styling and theme-aware presentation                                  |\n| Unit and component tests | Vitest / Testing Library React | 4.1.10/16.3.2   | User-observable frontend behavior and contract-consumer tests                     |\n| Browser test environment | jsdom                          | 29.1.1          | Browser DOM behavior in automated tests                                           |\n| Static quality           | ESLint / typescript-eslint     | 9.39.5/8.65.0   | TypeScript and React code-quality rules                                           |\n| Formatting               | Prettier                       | 3.8.1           | Consistent source and documentation formatting                                    |\n\nSupported engines and direct versions are declared in `package.json` and the\ncomplete dependency graph is locked in `package-lock.json`. Those files remain\nthe dependency authority. The table is an operator-friendly snapshot and must\nbe updated in the same change whenever a listed package version changes.\n\n## State ownership\n\n- TanStack Query owns remote server state and request lifecycle.\n- Presentation state stays close to the route or feature that owns it.\n- Backend modules remain authoritative for persisted state, validation,\n  authorization, workflows, and business outcomes.\n- Axis must not create a browser store that becomes a second copy of backend\n  registry, permission, workflow, publication, or tenant authority.\n\nA dedicated global client-state dependency may be considered only when a\nmeasured cross-feature problem cannot be handled safely by React composition,\nroute state, or TanStack Query.\n\n## Styling decision\n\nAxis uses MUI primitives, Emotion, and original Nodics design tokens. Tailwind\nis not part of the selected runtime. Commercial administration templates may\ninform information grouping only; their source code, components, assets,\nlayouts, and branding are not dependencies.\n\nThe design system must preserve keyboard operation, screen-reader support,\nresponsive behavior, reduced motion, mobile WebView compatibility, and the\nfixed comfortable workspace density.\n\n## Repository shape\n\nAxis starts as one application repository with cohesive feature boundaries.\nIt is not a mandatory monorepo. A package may be extracted later only when:\n\n1. two or more real consumers need the same stable capability;\n2. its public contract and ownership are explicit;\n3. extraction does not duplicate a Nodics backend authority;\n4. independent versioning and testing provide a demonstrated benefit.\n\nThis avoids package boundaries that add governance and release overhead before\nthe product has stable reuse seams.\n\nProduction code belongs under `src/`. Tests belong under the root `test/`\ndirectory and mirror the production feature boundaries, for example\n`src/cms/` and `test/cms/`. Test-only fixtures belong below the matching test\nfeature and must not be imported by production code.\n`config/typescript/tsconfig.app.json` strictly checks runtime source, while\n`config/typescript/tsconfig.test.json` strictly checks the\nseparate test tree.\n\n## CMS renderer organization\n\nCMS sends composition data and logical renderer contracts; Axis owns every\nexecutable renderer. Renderer source follows a strict, navigable hierarchy:\n\n```text\nsrc/cms/renderers/\n├── pages/                  # one page renderer per file\n├── templates/              # one template renderer per file\n├── components/\n│   ├── authentication/     # authentication-specific component renderers\n│   ├── dashboard/          # dashboard-specific component renderers\n│   ├── media/              # Media Management workspace renderer\n│   └── shared/             # genuinely reusable component renderers\n├── registry/               # typed logical-key mappings and contract manifest\n└── shared/                 # renderer-only types, guards, and property readers\n```\n\nDo not add a generic file containing multiple unrelated renderer\nimplementations. A new CMS renderer requires:\n\n1. one focused renderer file in the correct capability directory;\n2. one typed registry mapping from the backend logical key;\n3. one renderer-manifest entry declaring kind and supported contract version;\n4. focused tests in the mirrored `test/cms/renderers` hierarchy; and\n5. safe failure for unknown keys, incompatible versions, or invalid properties.\n\nReusable renderers are grouped by capability rather than copied into every\npage. Page-specific placement is reserved for a renderer contract deliberately\nowned by only that page. Backend data must never contain a TypeScript import,\nReact component name, executable file path, script URL, or HTML implementation.\n\nReusable interaction patterns follow the same rule. A capability such as\nschema query building, record filtering, media selection, relationship\nselection, or any later business-data picker should be implemented once as a\ngeneric Axis-owned component or CMS component renderer and then composed by\npages that need it. For example, the Schema Query Builder is a shared\nworkbench capability: Schema Workbench, Imports and Exports, and future\nschema-backed pages should reuse the same implementation instead of creating\nseparate query widgets.\n\nWorkspace title help follows the same reusable rule. Use the shared\n`WorkspaceHelpActions` or `WorkspaceHeading` primitives for page, workspace,\nand major component headings that need business context or a documentation\nhandoff. BackOffice navigation and CMS component content may provide bounded\n`help.summary`, `help.documentationRoute`, and `help.documentationFragment`\nmetadata. Axis renders the reusable info and documentation icons, opens docs\nlinks in a new tab, and must not replace those metadata contracts with\nhardcoded per-page tooltip maps. For business objects and framework-owned\ncapabilities, documentation routes should point to the canonical framework or\nmodule documentation that explains concept, implementation, lifecycle,\nconfiguration, customization, security, and verification. Short Nodics Axis\ndocumentation is appropriate only for Axis-specific UI behavior.\n\nThe content catalog may declare that a generic component is needed and may\nprovide labels, placeholders, help text, default presentation options, and a\nlogical renderer key. It must not become the query authority. Searchable\nfields, filter operators, sort rules, page-size limits, authorization, and\nexecution remain backend-owned contracts delivered by the relevant Nodics\nmodule. Axis owns the executable renderer and keeps it safe, typed,\nlocalized, responsive, and reusable.\n\n## Dependency decision rule\n\nBefore adding a frontend dependency:\n\n1. reuse an installed capability when it satisfies the requirement;\n2. compose or extend an existing Axis pattern when safe;\n3. document why the current stack cannot provide the capability;\n4. review bundle, security, maintenance, accessibility, browser, WebView, and\n   licensing impact;\n5. add focused tests and update this decision when the architectural stack\n   changes.\n\nAxis must not add a dependency that executes backend business processes,\nstores secrets, downloads executable CMS code, or creates an alternate\ncontract authority.\n\n## Customize and extend safely\n\nExtend the stack through a focused project-owned feature directory, existing\nReact and TypeScript composition, shared theme tokens, a typed backend client,\nand mirrored tests. Prefer an installed dependency or existing pattern; when a\nnew package is necessary, document its exact supported version, browser and\nWebView impact, bundle cost, security and licensing review, and upgrade and\nremoval procedure.\n\nDo not fork the application shell, create another state or API authority,\ndownload executable CMS code, or hide business rules in components. Verify\ntype safety, lint and formatting, accessibility, narrow and touch layouts,\ncontract rejection, integration behavior, bundle output, and clean removal of\nthe extension.\n\n## Verification\n\nUse:\n\n```bash\nnpm ci\nnpm run verify\n```\n\nThe verification gate checks formatting, linting, strict TypeScript,\nunit/component tests, and the production build.\n',
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/frontend-technology-stack.md',
        evidence: 'docs/frontend-technology-stack.md',
        hash: 'cc6256eee8767787d59c5272e8218d429188eeadbb159154304baa409b54eb51',
        version: '0.3.19',
      },
      previous: {
        title: 'Architecture and Repository Boundaries',
        route: '/docs/nodics-axis/architecture',
      },
      next: {
        title: 'Design System and Application Shell',
        route: '/docs/nodics-axis/design-system',
      },
    },
    active: true,
  },
  record4: {
    code: 'axisDocsComponentdesignsystem',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.design-system',
      title: 'Design System and Application Shell',
      route: '/docs/nodics-axis/design-system',
      section: 'build-and-operate-axis',
      sectionTitle: 'Build and Operate Axis',
      category: 'Build and Operate Axis',
      audience: ['designer', 'developer', 'business-user', 'ai-tool'],
      summary:
        'Understand authentication layouts, design foundations, shell structure, responsive states, accessibility, recovery, and extension rules.',
      headings: [
        {
          text: 'Implemented scope',
          anchor: 'design-system-1-implemented-scope',
          level: 2,
        },
        {
          text: 'Authentication layout',
          anchor: 'design-system-2-authentication-layout',
          level: 2,
        },
        {
          text: 'Foundations',
          anchor: 'design-system-3-foundations',
          level: 2,
        },
        {
          text: 'Shell structure',
          anchor: 'design-system-4-shell-structure',
          level: 2,
        },
        {
          text: 'Recovery states',
          anchor: 'design-system-5-recovery-states',
          level: 2,
        },
        {
          text: 'Accessibility and responsive behavior',
          anchor: 'design-system-6-accessibility-and-responsive-behavior',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'design-system-7-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Verification',
          anchor: 'design-system-8-verification',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Implemented scope',
          anchor: 'design-system-1-implemented-scope',
        },
        {
          kind: 'paragraph',
          text: 'Axis provides a responsive recovery workspace, CMS-composed employee authentication experience, and authenticated dashboard shell. It contains no backend business logic and does not infer permissions.',
        },
        {
          kind: 'paragraph',
          text: 'The implemented visual foundation uses Nodics Gold for focus and primary actions, Charcoal for structural surfaces and text, and restrained semantic colors for success, information, warning, and error states. Panelix informed functional grouping only; no template source or visual asset was copied.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Authentication layout',
          anchor: 'design-system-2-authentication-layout',
        },
        {
          kind: 'paragraph',
          text: 'The implemented login, recovery, and lock-screen template follows a two-zone enterprise authentication pattern:',
        },
        {
          kind: 'unordered-list',
          items: [
            'desktop and tablet layouts at or above the medium breakpoint use a 60-percent Charcoal showcase panel and a 40-percent calm white form workspace;',
            'the showcase uses the reverse Nodics Axis lockup, Gold emphasis, a short platform narrative, and configurable highlights;',
            'the form workspace limits content to 440 pixels for readable field lengths;',
            'brand, introduction, form, assistance, and legal content remain separate CMS slots;',
            'mobile webviews hide the decorative showcase and retain the complete employee authentication journey in one column.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The layout pattern was informed by the approved external reference, but colors, logo treatment, typography, spacing, content, accessibility, and React implementation follow the Nodics Axis style guide. No source code, imagery, social-login behavior, registration journey, or branding was copied.',
        },
        {
          kind: 'paragraph',
          text: 'Recovery uses the same composition with a concise reset introduction, one employee identifier field, primary action, and return-to-login assistance. Screen lock uses the in-memory employee identifier, one password field, primary unlock action, and explicit sign-out alternative. Lock content is authenticated CMS composition and is never available from public delivery.',
        },
        {
          kind: 'paragraph',
          text: "Implemented foundation values include Gold `#FEC400`, Charcoal `#25292C`, app background `#F5F6F7`, border `#DDE1E5`, and the guide's semantic colors. Gold remains an action surface with Charcoal text; it is not used as warning status or normal text on white.",
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Foundations',
          anchor: 'design-system-3-foundations',
        },
        {
          kind: 'unordered-list',
          items: [
            'Light and dark color modes.',
            'A fixed comfortable workspace density.',
            'Responsive typography and spacing.',
            'Consistent borders, surfaces, action sizing, and elevation.',
            'Visible keyboard focus.',
            'Reduced-motion behavior through the operating-system preference.',
            'Semantic success, information, warning, and error colors.',
            'Forty-four-pixel icon-button targets for touch and mobile WebViews.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Appearance choices remain in application memory. They are not identity, tenant, or backend configuration and are deliberately not persisted yet.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Shell structure',
          anchor: 'design-system-4-shell-structure',
        },
        {
          kind: 'paragraph',
          text: 'The shared authenticated shell provides:',
        },
        {
          kind: 'ordered-list',
          items: [
            'an expandable desktop navigation rail, compact icon-only desktop rail, and temporary mobile navigation drawer;',
            'synchronized navigation search in the expanded left rail and top bar, an optional backend-advertised Axis Assistant shortcut, quick-create placeholder, My Work, notifications, context information, color mode, and employee menu;',
            'a top-bar information popup showing the backend-reported environment, tenant, configured enterprise, CMS Site, and CMS Catalog;',
            'employee lock and logout actions;',
            'a top-bar light/dark icon toggle;',
            'the main workspace region;',
            'bordered workspace panels;',
            'empty-state, notification, and confirmation-dialog primitives;',
            'loading and offline feedback.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'After authentication, Axis consumes the authorized BackOffice `catalogue`, `availability`, and client-safe module leases. It does not define a second functional menu authority. The local Dashboard entry is combined with module-owned navigation entries. Axis uses an explicitly supplied backend business group first and retains the legacy category mapping only as a safe fallback for older compatible contributions:',
        },
        {
          kind: 'unordered-list',
          items: [
            '`content` and `experience` become Content and Experience;',
            '`commerce` becomes Commerce;',
            '`core` becomes Customers and Organization;',
            '`operations` becomes Process and Automation;',
            '`platform` becomes Operations and Integration; and',
            'unknown categories remain visible under Other Capabilities.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'An owning module may also supply a same-module parent relationship, perspectives, localization key, required context dimensions, feature state, and a non-executable badge-provider reference. Axis validates the hierarchy again and rejects duplicate identifiers, missing parents, or cycles even though BackOffice has already validated the registration. Children are displayed directly after their parent with an accessible hierarchy level. `DISABLED` destinations remain visible but cannot be opened; `PREVIEW` destinations carry a visible preview state; `HIDDEN` destinations are removed by BackOffice before Axis receives them.',
        },
        {
          kind: 'paragraph',
          text: 'The expanded and mobile navigation provides a real **Search menu** field. It matches authorized destinations by business group, user-facing label, or owning module and filters the left panel immediately. The top-bar navigation search uses the same query state. Search never changes permissions, tenant context, or backend feature state, and a successful navigation clears it.',
        },
        {
          kind: 'paragraph',
          text: 'Employees may star a destination. Axis stores only bounded `moduleName:navigationId` values for **Favourites** and **Recent** in browser local storage. It never stores routes, labels, tokens, employee details, tenant data, record data, or backend payloads in navigation preferences. Malformed persisted values are discarded. Favourites and recent destinations remain conveniences over the current authenticated bootstrap; a missing or newly unauthorized contribution disappears automatically.',
        },
        {
          kind: 'paragraph',
          text: 'Incompatible modules are excluded by the bootstrap parser. Unavailable destinations are disabled and degraded destinations remain visible with a warning state. A navigation item with permissions not covered by its already authorized module contribution is rejected rather than displayed.',
        },
        {
          kind: 'paragraph',
          text: 'When the authorized `aiAssistant` contribution contains its `assistant` navigation item, the same backend-provided label, route, icon key, and availability also drive the top-bar shortcut. The shortcut is absent when the employee has no contribution, enabled for `UP` and `DEGRADED`, and disabled for `UNAVAILABLE` or `UNKNOWN`. Axis does not maintain a second Assistant route or label authority.',
        },
        {
          kind: 'paragraph',
          text: "The current environment, tenant, enterprise, Site, and Catalog are available from the top-bar information icon. Axis presents them as a light/dark-aware context card with aligned label/value rows, clear typography, and the same surface rules as other governed shell elements. The context remains discoverable on hover and keyboard focus but does not reserve a permanent context strip, because operators need the vertical workspace for forms, tables, API contracts, documentation, and health views. The information icon's accessible name includes the same context values so screen-reader and keyboard users do not lose the operating context.",
        },
        {
          kind: 'paragraph',
          text: 'The desktop menu control switches between the full rail and the compact rail. The compact rail retains every authorized destination as an icon with an accessible name and hover/focus tooltip; it does not hide or re-authorize capabilities. The Nodics Axis wordmark contracts to the Nodics mark and the top bar and content region reclaim the released width. Reduced-motion preferences disable the width transition.',
        },
        {
          kind: 'paragraph',
          text: 'Each module-owned navigation entry may supply a semantic `icon` key. Axis maps that non-executable key to an Axis-owned vector icon. The entry-level key takes precedence over the module-level key, and an unknown key uses the governed generic module icon instead of loading remote or CMS-provided executable assets.',
        },
        {
          kind: 'paragraph',
          text: 'Discovered module routes currently open an explicit placeholder workspace until their dedicated Axis feature is implemented. The placeholder confirms the owning module and availability without inferring operations or calling unapproved APIs.',
        },
        {
          kind: 'paragraph',
          text: 'Before authentication, unavailable context is labelled honestly. Future enterprise, environment, Site, Store, and Catalog selectors must consume governed backend context contracts rather than turn their displayed labels into frontend authority. Future features must compose these primitives rather than create parallel page shells.',
        },
        {
          kind: 'paragraph',
          text: 'Context identifiers are retained exactly for API requests, authorization, query keys, caches, and diagnostics. Axis uses the generic display-name helper only to turn a validated fallback code such as `startioLocal` into readable text such as `Startio Local`. The helper preserves common acronyms including AI, API, CMS, ID, and UI. A localized display name explicitly supplied by the owning backend contract takes precedence over this fallback.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Recovery states',
          anchor: 'design-system-5-recovery-states',
        },
        {
          kind: 'paragraph',
          text: 'The static recovery model distinguishes:',
        },
        {
          kind: 'unordered-list',
          items: [
            'deployment configuration;',
            'Profile identity authority;',
            'BackOffice registry;',
            'CMS delivery;',
            'contract compatibility;',
            'functional module availability;',
            'authorization denial;',
            'offline connectivity;',
            'unexpected presentation failure.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Each recovery state explains the affected boundary, whether retry is safe, and an optional bounded correlation reference. Axis never claims that a retry is safe for an unknown backend mutation.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Accessibility and responsive behavior',
          anchor: 'design-system-6-accessibility-and-responsive-behavior',
        },
        {
          kind: 'unordered-list',
          items: [
            'The main workspace uses the `main` landmark.',
            'Navigation has an accessible name.',
            'Dialogs have programmatic titles and descriptions.',
            'Notifications use MUI live-region behavior.',
            'Controls retain visible labels and keyboard focus.',
            'Navigation changes from permanent to temporary below the medium breakpoint.',
            'Authentication layouts use the exact 60/40 split at and above the medium breakpoint. Below it, the decorative panel is hidden and the form workspace uses the full width.',
            'Layouts stack on narrow screens, avoid hover-only interaction, and do not introduce horizontal page overflow.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'design-system-7-customize-and-extend-safely',
        },
        {
          kind: 'unordered-list',
          items: [
            'Add new design values to the shared token module.',
            'Add reusable layouts and states to the shell primitives.',
            'Keep module-specific presentation inside its feature workspace.',
            'Do not put permissions, workflow execution, service credentials, or authoritative validation into a shell component.',
            "Add functional navigation through the owning module's BackOffice capability contribution. Do not hardcode module routes in Axis.",
            'Keep the single local Dashboard route recovery-safe. Every other displayed functional destination must come from authenticated bootstrap.',
            'Keep the expanded/compact navigation and color-mode choice in application memory. Only bounded favourite/recent navigation identifiers use the reviewed preference store; do not add tokens, routes, context, records, or backend responses to it.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification',
          anchor: 'design-system-8-verification',
        },
        {
          kind: 'paragraph',
          text: 'Run `npm run verify`. The foundation tests cover recovery variants, retry and correlation presentation, authorized navigation parsing and grouping, navigation landmarks, module placeholder routing, context popup labels, employee logout, Assistant shortcut capability gating, color controls, hierarchy validation, backend-owned groups, perspective metadata, feature states, menu search, bounded favourite/recent preferences, dialogs, notifications, offline behavior, formatting, lint, types, and build. Responsive browser acceptance also covers the 60/40 authentication split at desktop and tablet widths and the single-column mobile journey.',
        },
        {
          kind: 'paragraph',
          text: 'The governed-navigation acceptance was also exercised against the real `startioLocal` `monoServer` bootstrap. The authenticated catalogue returned eleven permission-filtered destinations with module-owned groups, perspectives, context dimensions, and active feature state. Axis rendered the expected business groups, menu search, favourite controls, compact desktop behavior, and the temporary 390-pixel mobile drawer. Adding Content to Favourites stored only `cms:cms`; no route, token, context, or record data was persisted.',
        },
        {
          kind: 'paragraph',
          text: 'Axis does not expose a comfortable/compact density switch. The comfortable workspace density is the default because enterprise back-office screens need readable forms, tables, documentation, and operational cards across desktop, tablet, and mobile WebView surfaces. If a future project needs denser screens, it must introduce that behavior as a governed design-system change with accessibility and responsive acceptance, not as an ad hoc shell preference.',
        },
      ],
      searchText:
        "Design System and Application Shell Understand authentication layouts, design foundations, shell structure, responsive states, accessibility, recovery, and extension rules. # Axis Design System and Application Shell\n\n## Implemented scope\n\nAxis provides a responsive recovery workspace, CMS-composed employee\nauthentication experience, and authenticated dashboard shell. It contains no\nbackend business logic and does not infer permissions.\n\nThe implemented visual foundation uses Nodics Gold for focus and primary\nactions, Charcoal for structural surfaces and text, and restrained semantic\ncolors for success, information, warning, and error states. Panelix informed\nfunctional grouping only; no template source or visual asset was copied.\n\n## Authentication layout\n\nThe implemented login, recovery, and lock-screen template follows a two-zone\nenterprise authentication pattern:\n\n- desktop and tablet layouts at or above the medium breakpoint use a\n  60-percent Charcoal showcase panel and a 40-percent calm white form\n  workspace;\n- the showcase uses the reverse Nodics Axis lockup, Gold emphasis, a short\n  platform narrative, and configurable highlights;\n- the form workspace limits content to 440 pixels for readable field lengths;\n- brand, introduction, form, assistance, and legal content remain separate CMS\n  slots;\n- mobile webviews hide the decorative showcase and retain the complete\n  employee authentication journey in one column.\n\nThe layout pattern was informed by the approved external reference, but colors,\nlogo treatment, typography, spacing, content, accessibility, and React\nimplementation follow the Nodics Axis style guide. No source code, imagery,\nsocial-login behavior, registration journey, or branding was copied.\n\nRecovery uses the same composition with a concise reset introduction, one\nemployee identifier field, primary action, and return-to-login assistance.\nScreen lock uses the in-memory employee identifier, one password field,\nprimary unlock action, and explicit sign-out alternative. Lock content is\nauthenticated CMS composition and is never available from public delivery.\n\nImplemented foundation values include Gold `#FEC400`, Charcoal `#25292C`, app\nbackground `#F5F6F7`, border `#DDE1E5`, and the guide's semantic colors. Gold\nremains an action surface with Charcoal text; it is not used as warning status\nor normal text on white.\n\n## Foundations\n\n- Light and dark color modes.\n- A fixed comfortable workspace density.\n- Responsive typography and spacing.\n- Consistent borders, surfaces, action sizing, and elevation.\n- Visible keyboard focus.\n- Reduced-motion behavior through the operating-system preference.\n- Semantic success, information, warning, and error colors.\n- Forty-four-pixel icon-button targets for touch and mobile WebViews.\n\nAppearance choices remain in application memory. They are not identity,\ntenant, or backend configuration and are deliberately not persisted yet.\n\n## Shell structure\n\nThe shared authenticated shell provides:\n\n1. an expandable desktop navigation rail, compact icon-only desktop rail, and\n   temporary mobile navigation drawer;\n2. synchronized navigation search in the expanded left rail and top bar, an\n   optional backend-advertised Axis Assistant shortcut, quick-create\n   placeholder, My Work, notifications, context information, color mode, and\n   employee menu;\n3. a top-bar information popup showing the backend-reported environment,\n   tenant, configured enterprise, CMS Site, and CMS Catalog;\n4. employee lock and logout actions;\n5. a top-bar light/dark icon toggle;\n6. the main workspace region;\n7. bordered workspace panels;\n8. empty-state, notification, and confirmation-dialog primitives;\n9. loading and offline feedback.\n\nAfter authentication, Axis consumes the authorized BackOffice `catalogue`,\n`availability`, and client-safe module leases. It does not define a second\nfunctional menu authority. The local Dashboard entry is combined with\nmodule-owned navigation entries. Axis uses an explicitly supplied backend\nbusiness group first and retains the legacy category mapping only as a safe\nfallback for older compatible contributions:\n\n- `content` and `experience` become Content and Experience;\n- `commerce` becomes Commerce;\n- `core` becomes Customers and Organization;\n- `operations` becomes Process and Automation;\n- `platform` becomes Operations and Integration; and\n- unknown categories remain visible under Other Capabilities.\n\nAn owning module may also supply a same-module parent relationship,\nperspectives, localization key, required context dimensions, feature state,\nand a non-executable badge-provider reference. Axis validates the hierarchy\nagain and rejects duplicate identifiers, missing parents, or cycles even\nthough BackOffice has already validated the registration. Children are\ndisplayed directly after their parent with an accessible hierarchy level.\n`DISABLED` destinations remain visible but cannot be opened; `PREVIEW`\ndestinations carry a visible preview state; `HIDDEN` destinations are removed\nby BackOffice before Axis receives them.\n\nThe expanded and mobile navigation provides a real **Search menu** field. It\nmatches authorized destinations by business group, user-facing label, or\nowning module and filters the left panel immediately. The top-bar navigation\nsearch uses the same query state. Search never changes permissions, tenant\ncontext, or backend feature state, and a successful navigation clears it.\n\nEmployees may star a destination. Axis stores only bounded\n`moduleName:navigationId` values for **Favourites** and **Recent** in browser\nlocal storage. It never stores routes, labels, tokens, employee details,\ntenant data, record data, or backend payloads in navigation preferences.\nMalformed persisted values are discarded. Favourites and recent destinations\nremain conveniences over the current authenticated bootstrap; a missing or\nnewly unauthorized contribution disappears automatically.\n\nIncompatible modules are excluded by the bootstrap parser. Unavailable\ndestinations are disabled and degraded destinations remain visible with a\nwarning state. A navigation item with permissions not covered by its already\nauthorized module contribution is rejected rather than displayed.\n\nWhen the authorized `aiAssistant` contribution contains its `assistant`\nnavigation item, the same backend-provided label, route, icon key, and\navailability also drive the top-bar shortcut. The shortcut is absent when the\nemployee has no contribution, enabled for `UP` and `DEGRADED`, and disabled for\n`UNAVAILABLE` or `UNKNOWN`. Axis does not maintain a second Assistant route or\nlabel authority.\n\nThe current environment, tenant, enterprise, Site, and Catalog are available\nfrom the top-bar information icon. Axis presents them as a light/dark-aware\ncontext card with aligned label/value rows, clear typography, and the same\nsurface rules as other governed shell elements. The context remains\ndiscoverable on hover and keyboard focus but does not reserve a permanent\ncontext strip, because operators need the vertical workspace for forms,\ntables, API contracts, documentation, and health views. The information icon's\naccessible name includes the same context values so screen-reader and keyboard\nusers do not lose the operating context.\n\nThe desktop menu control switches between the full rail and the compact rail.\nThe compact rail retains every authorized destination as an icon with an\naccessible name and hover/focus tooltip; it does not hide or re-authorize\ncapabilities. The Nodics Axis wordmark contracts to the Nodics mark and the top\nbar and content region reclaim the released width. Reduced-motion preferences\ndisable the width transition.\n\nEach module-owned navigation entry may supply a semantic `icon` key. Axis maps\nthat non-executable key to an Axis-owned vector icon. The entry-level key takes\nprecedence over the module-level key, and an unknown key uses the governed\ngeneric module icon instead of loading remote or CMS-provided executable\nassets.\n\nDiscovered module routes currently open an explicit placeholder workspace until\ntheir dedicated Axis feature is implemented. The placeholder confirms the\nowning module and availability without inferring operations or calling\nunapproved APIs.\n\nBefore authentication, unavailable context is labelled honestly. Future\nenterprise, environment, Site, Store, and Catalog selectors must consume\ngoverned backend context contracts rather than turn their displayed labels into\nfrontend authority. Future features must compose these primitives rather than\ncreate parallel page shells.\n\nContext identifiers are retained exactly for API requests, authorization,\nquery keys, caches, and diagnostics. Axis uses the generic display-name helper\nonly to turn a validated fallback code such as `startioLocal` into readable\ntext such as `Startio Local`. The helper preserves common acronyms including\nAI, API, CMS, ID, and UI. A localized display name explicitly supplied by the\nowning backend contract takes precedence over this fallback.\n\n## Recovery states\n\nThe static recovery model distinguishes:\n\n- deployment configuration;\n- Profile identity authority;\n- BackOffice registry;\n- CMS delivery;\n- contract compatibility;\n- functional module availability;\n- authorization denial;\n- offline connectivity;\n- unexpected presentation failure.\n\nEach recovery state explains the affected boundary, whether retry is safe, and\nan optional bounded correlation reference. Axis never claims that a retry is\nsafe for an unknown backend mutation.\n\n## Accessibility and responsive behavior\n\n- The main workspace uses the `main` landmark.\n- Navigation has an accessible name.\n- Dialogs have programmatic titles and descriptions.\n- Notifications use MUI live-region behavior.\n- Controls retain visible labels and keyboard focus.\n- Navigation changes from permanent to temporary below the medium breakpoint.\n- Authentication layouts use the exact 60/40 split at and above the medium\n  breakpoint. Below it, the decorative panel is hidden and the form workspace\n  uses the full width.\n- Layouts stack on narrow screens, avoid hover-only interaction, and do not\n  introduce horizontal page overflow.\n\n## Customize and extend safely\n\n- Add new design values to the shared token module.\n- Add reusable layouts and states to the shell primitives.\n- Keep module-specific presentation inside its feature workspace.\n- Do not put permissions, workflow execution, service credentials, or\n  authoritative validation into a shell component.\n- Add functional navigation through the owning module's BackOffice capability\n  contribution. Do not hardcode module routes in Axis.\n- Keep the single local Dashboard route recovery-safe. Every other displayed\n  functional destination must come from authenticated bootstrap.\n- Keep the expanded/compact navigation and color-mode choice in application\n  memory. Only bounded favourite/recent navigation identifiers use the\n  reviewed preference store; do not add tokens, routes, context, records, or\n  backend responses to it.\n\n## Verification\n\nRun `npm run verify`. The foundation tests cover recovery variants, retry and\ncorrelation presentation, authorized navigation parsing and grouping,\nnavigation landmarks, module placeholder routing, context popup labels, employee\nlogout, Assistant shortcut capability gating, color controls,\nhierarchy validation, backend-owned groups, perspective metadata, feature\nstates, menu search, bounded favourite/recent preferences, dialogs,\nnotifications, offline\nbehavior, formatting, lint, types, and build.\nResponsive browser acceptance also covers the 60/40 authentication split at\ndesktop and tablet widths and the single-column mobile journey.\n\nThe governed-navigation acceptance was also exercised against the real\n`startioLocal` `monoServer` bootstrap. The authenticated catalogue returned\neleven permission-filtered destinations with module-owned groups,\nperspectives, context dimensions, and active feature state. Axis rendered the\nexpected business groups, menu search, favourite controls, compact\ndesktop behavior, and the temporary 390-pixel mobile drawer. Adding Content to\nFavourites stored only `cms:cms`; no route, token, context, or record data was\npersisted.\n\nAxis does not expose a comfortable/compact density switch. The comfortable\nworkspace density is the default because enterprise back-office screens need\nreadable forms, tables, documentation, and operational cards across desktop,\ntablet, and mobile WebView surfaces. If a future project needs denser screens,\nit must introduce that behavior as a governed design-system change with\naccessibility and responsive acceptance, not as an ad hoc shell preference.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/design-system-and-shell.md',
        evidence: 'docs/design-system-and-shell.md',
        hash: 'a6995601b81ef6b2fe4ef2f6b123a1b4bba597a7f3c0976002284f55513a7498',
        version: '0.3.19',
      },
      previous: {
        title: 'Frontend Technology Stack',
        route: '/docs/nodics-axis/technology-stack',
      },
      next: {
        title: 'CMS Delivery and Renderer Integration',
        route: '/docs/nodics-axis/cms-renderers',
      },
    },
    active: true,
  },
  record5: {
    code: 'axisDocsComponentcmsrenderers',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.cms-renderers',
      title: 'CMS Delivery and Renderer Integration',
      route: '/docs/nodics-axis/cms-renderers',
      section: 'build-and-operate-axis',
      sectionTitle: 'Build and Operate Axis',
      category: 'Build and Operate Axis',
      audience: ['developer', 'architect', 'security-reviewer', 'ai-tool'],
      summary:
        'Follow the CMS delivery, validation, cache-safety, logical renderer, and frontend implementation boundaries.',
      headings: [
        {
          text: 'Runtime boundary',
          anchor: 'cms-renderers-1-runtime-boundary',
          level: 2,
        },
        {
          text: 'Delivery validation',
          anchor: 'cms-renderers-2-delivery-validation',
          level: 2,
        },
        {
          text: 'Request and cache safety',
          anchor: 'cms-renderers-3-request-and-cache-safety',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'cms-renderers-4-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Renderer development',
          anchor: 'cms-renderers-5-renderer-development',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Axis renders CMS-managed Back Office pages without moving backend authority or business logic into the browser.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Runtime boundary',
          anchor: 'cms-renderers-1-runtime-boundary',
        },
        {
          kind: 'paragraph',
          text: 'CMS owns routes, pages, templates, components, component properties, and the logical renderer metadata attached to each page or component type. Axis owns the executable React renderers. CMS never returns JavaScript, module paths, or arbitrary renderer URLs.',
        },
        {
          kind: 'paragraph',
          text: 'Axis obtains the CMS endpoint from the approved runtime bootstrap flow. The CMS client accepts that discovered endpoint as an input; it does not invent a fallback URL or proxy CMS through the Axis server.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Delivery validation',
          anchor: 'cms-renderers-2-delivery-validation',
        },
        {
          kind: 'paragraph',
          text: 'Before rendering, Axis validates the complete resolved-page response:',
        },
        {
          kind: 'unordered-list',
          items: [
            'delivery contract version;',
            'site, path, locale, and channel;',
            'page, template, and component renderer keys;',
            'renderer major versions and supported channels;',
            'required component properties;',
            'component graph depth and total component count.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Unknown renderer keys, unsupported versions or channels, malformed data, and oversized graphs fail closed. A component rendering failure is isolated and replaced with a safe error message. Deprecated renderer metadata is retained for migration tooling; it does not allow CMS to select untrusted executable code.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Request and cache safety',
          anchor: 'cms-renderers-3-request-and-cache-safety',
        },
        {
          kind: 'paragraph',
          text: 'The delivery client:',
        },
        {
          kind: 'unordered-list',
          items: [
            'sends bearer tokens only in the `Authorization` header;',
            'never places tokens in URLs, storage, or cache keys;',
            'omits browser credentials and rejects redirects;',
            'supports cancellation, timeouts, `ETag`, and `304 Not Modified`;',
            'separates cache keys by enterprise, tenant, site, path, locale, channel, access mode, principal, and authenticated session generation.',
          ],
        },
        {
          kind: 'paragraph',
          text: "Authenticated cache keys require principal and session identity. This prevents one employee or tenant from reusing another user's resolved page.",
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'cms-renderers-4-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Create one project-owned renderer file in the relevant capability directory, register its backend-issued logical key and supported contract version in the typed renderer manifest, and add mirrored tests. Customize labels, help text, layout options, and safe fragments through CMS component properties; keep API destinations, authorization, validation, and business decisions in their owning backend modules.',
        },
        {
          kind: 'paragraph',
          text: 'Never execute CMS HTML or JavaScript, accept arbitrary component imports, add a fallback renderer for unknown keys, or duplicate CMS route resolution in Axis. Verify valid, unknown, deprecated, incompatible, malformed, oversized, unauthorized, cached-session, responsive, and renderer-isolation behavior. Rollback removes the later project registration and restores the prior CMS component version without editing the reusable renderer framework.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Renderer development',
          anchor: 'cms-renderers-5-renderer-development',
        },
        {
          kind: 'paragraph',
          text: 'Add a renderer only to the trusted Axis renderer manifest and implement it in Axis source. Keep the renderer declarative: component properties may influence content and presentation, but must not introduce API destinations, executable scripts, authorization rules, or backend business decisions.',
        },
        {
          kind: 'paragraph',
          text: 'When a component can be reused across pages, promote it to a shared component contract instead of creating a second page-local renderer. Schema Query Builder is the reference pattern: the content catalog can place or configure a query-builder component, and Axis can render it through a shared renderer or shared primitive, but the owning backend module still supplies searchable fields, allowed operators, sort rules, limits, and execution contracts. This same reuse rule applies to future media pickers, relationship selectors, record browsers, workflow selectors, and any other repeated business-control surface.',
        },
        {
          kind: 'paragraph',
          text: 'Run the focused checks while changing this boundary:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run typecheck\nnpm test -- --run test/cms',
        },
        {
          kind: 'paragraph',
          text: 'Run `npm run verify` before handing off or committing the completed slice.',
        },
        {
          kind: 'paragraph',
          text: '`/login` and `/forgot-password` are resolved from public CMS delivery. The login renderer sends employee credentials only to Profile. After Profile issues the human bearer token, Axis validates access through secured BackOffice bootstrap before loading the authenticated CMS dashboard. Tokens remain in memory and are cleared locally before logout revocation is sent to Profile.',
        },
        {
          kind: 'paragraph',
          text: 'The forgot-password page is presentation-ready, but submission remains disabled until Profile owns an approved employee-recovery API. Axis does not simulate recovery or create a second identity workflow.',
        },
      ],
      searchText:
        "CMS Delivery and Renderer Integration Follow the CMS delivery, validation, cache-safety, logical renderer, and frontend implementation boundaries. # CMS Delivery and Renderer Integration\n\nAxis renders CMS-managed Back Office pages without moving backend authority or\nbusiness logic into the browser.\n\n## Runtime boundary\n\nCMS owns routes, pages, templates, components, component properties, and the\nlogical renderer metadata attached to each page or component type. Axis owns\nthe executable React renderers. CMS never returns JavaScript, module paths, or\narbitrary renderer URLs.\n\nAxis obtains the CMS endpoint from the approved runtime bootstrap flow. The CMS\nclient accepts that discovered endpoint as an input; it does not invent a\nfallback URL or proxy CMS through the Axis server.\n\n## Delivery validation\n\nBefore rendering, Axis validates the complete resolved-page response:\n\n- delivery contract version;\n- site, path, locale, and channel;\n- page, template, and component renderer keys;\n- renderer major versions and supported channels;\n- required component properties;\n- component graph depth and total component count.\n\nUnknown renderer keys, unsupported versions or channels, malformed data, and\noversized graphs fail closed. A component rendering failure is isolated and\nreplaced with a safe error message. Deprecated renderer metadata is retained\nfor migration tooling; it does not allow CMS to select untrusted executable\ncode.\n\n## Request and cache safety\n\nThe delivery client:\n\n- sends bearer tokens only in the `Authorization` header;\n- never places tokens in URLs, storage, or cache keys;\n- omits browser credentials and rejects redirects;\n- supports cancellation, timeouts, `ETag`, and `304 Not Modified`;\n- separates cache keys by enterprise, tenant, site, path, locale, channel,\n  access mode, principal, and authenticated session generation.\n\nAuthenticated cache keys require principal and session identity. This prevents\none employee or tenant from reusing another user's resolved page.\n\n## Customize and extend safely\n\nCreate one project-owned renderer file in the relevant capability directory,\nregister its backend-issued logical key and supported contract version in the\ntyped renderer manifest, and add mirrored tests. Customize labels, help text,\nlayout options, and safe fragments through CMS component properties; keep API\ndestinations, authorization, validation, and business decisions in their\nowning backend modules.\n\nNever execute CMS HTML or JavaScript, accept arbitrary component imports, add a\nfallback renderer for unknown keys, or duplicate CMS route resolution in Axis.\nVerify valid, unknown, deprecated, incompatible, malformed, oversized,\nunauthorized, cached-session, responsive, and renderer-isolation behavior.\nRollback removes the later project registration and restores the prior CMS\ncomponent version without editing the reusable renderer framework.\n\n## Renderer development\n\nAdd a renderer only to the trusted Axis renderer manifest and implement it in\nAxis source. Keep the renderer declarative: component properties may influence\ncontent and presentation, but must not introduce API destinations, executable\nscripts, authorization rules, or backend business decisions.\n\nWhen a component can be reused across pages, promote it to a shared component\ncontract instead of creating a second page-local renderer. Schema Query\nBuilder is the reference pattern: the content catalog can place or configure a\nquery-builder component, and Axis can render it through a shared renderer or\nshared primitive, but the owning backend module still supplies searchable\nfields, allowed operators, sort rules, limits, and execution contracts. This\nsame reuse rule applies to future media pickers, relationship selectors,\nrecord browsers, workflow selectors, and any other repeated business-control\nsurface.\n\nRun the focused checks while changing this boundary:\n\n```bash\nnpm run typecheck\nnpm test -- --run test/cms\n```\n\nRun `npm run verify` before handing off or committing the completed slice.\n\n`/login` and `/forgot-password` are resolved from public CMS delivery. The\nlogin renderer sends employee credentials only to Profile. After Profile issues\nthe human bearer token, Axis validates access through secured BackOffice\nbootstrap before loading the authenticated CMS dashboard. Tokens remain in\nmemory and are cleared locally before logout revocation is sent to Profile.\n\nThe forgot-password page is presentation-ready, but submission remains disabled\nuntil Profile owns an approved employee-recovery API. Axis does not simulate\nrecovery or create a second identity workflow.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/cms-delivery-and-renderers.md',
        evidence: 'docs/cms-delivery-and-renderers.md',
        hash: '84b2be72effcb6eca8b000a43cfcb3414ef8d0ce52861bea24ffc95dbe9c4c15',
        version: '0.3.19',
      },
      previous: {
        title: 'Design System and Application Shell',
        route: '/docs/nodics-axis/design-system',
      },
      next: {
        title: 'Documentation Content in Axis',
        route: '/docs/nodics-axis/documentation-content',
      },
    },
    active: true,
  },
  record6: {
    code: 'axisDocsComponentdocumentationcontent',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.documentation-content',
      title: 'Documentation Content in Axis',
      route: '/docs/nodics-axis/documentation-content',
      section: 'build-and-operate-axis',
      sectionTitle: 'Build and Operate Axis',
      category: 'Build and Operate Axis',
      audience: ['administrator', 'developer', 'operator', 'ai-tool'],
      summary:
        'Understand dynamic documentation products, content-pack installation, renderer ownership, failure recovery, and contributor verification.',
      headings: [
        {
          text: 'Employee Journey',
          anchor: 'documentation-content-1-employee-journey',
          level: 2,
        },
        {
          text: 'Nodics Axis Content Pack',
          anchor: 'documentation-content-2-nodics-axis-content-pack',
          level: 2,
        },
        {
          text: 'Renderer Ownership',
          anchor: 'documentation-content-3-renderer-ownership',
          level: 2,
        },
        {
          text: 'Failure And Recovery',
          anchor: 'documentation-content-4-failure-and-recovery',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'documentation-content-5-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Contributor Verification',
          anchor: 'documentation-content-6-contributor-verification',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Axis renders an authorized, backend-provided list of documentation products under `/docs/*`. BackOffice aggregates the list from active module metadata; Axis does not hardcode product tabs or maintain another registry.',
        },
        {
          kind: 'unordered-list',
          items: [
            '**Framework** renders the canonical `nodics.docs` content pack through CMS.',
            "**Swaggers** renders the active System-owned OpenAPI contract in an Axis-owned, searchable reference and links to the backend's standalone interactive Swagger UI. API descriptions are not copied into a content catalog.",
            "**Nodics Axis** renders this repository's committed documentation content pack through its own CMS Site and content catalog.",
            'A future customer project contributes its own source from its backend project module and supplies import-ready data from the corresponding project repository.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Each CMS documentation product has a separate Site/catalog pair. CMS resolves the Site to its catalog, so Axis never adds a second catalog-routing authority. Nodics CMS remains runtime content and route authority; nImport remains the only content-pack installation and update authority.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Employee Journey',
          anchor: 'documentation-content-1-employee-journey',
        },
        {
          kind: 'ordered-list',
          items: [
            'Sign in with an authorized employee account.',
            'Open **Documentation > Nodics Documentation**.',
            'Axis renders the ordered source tabs returned by the secured BackOffice bootstrap.',
            'Select a CMS product or **Swaggers**. Axis resolves the configured runtime connection by `connectionModule`; it never stores a second endpoint list.',
            "For a CMS source, Axis asks the registered System module for that source's configured content-pack state.",
            'When the pack is absent, an authorized administrator may select **Import documentation**. Axis never reads a repository or imports records itself.',
            'When the pack is current, Axis requests the selected product path from the CMS endpoint supplied by BackOffice bootstrap.',
            'CMS resolves the Site, locale, channel, route, page, template, component, renderer mappings, and access mode.',
            'Axis validates the renderer contract and displays the declarative article.',
            'Internal documentation links remain inside the authenticated Axis shell.',
          ],
        },
        {
          kind: 'paragraph',
          text: "For **Swaggers**, Axis uses the selected source's registered System connection, OpenAPI path, and Swagger path. Axis fetches and bounds the JSON OpenAPI contract, then renders searchable method, path, summary, description, tags, operation metadata, parameters, request body, response codes, content types, schema summaries, and declared security scheme names as text through its own components. Axis does not execute API calls from this read-only catalogue. API operations are grouped by the Nodics module hierarchy: operation ownership comes from the generated OpenAPI `x-nodics.moduleName` metadata, while display names, parent modules, and group labels come from BackOffice's authenticated module registry projection. Tags and path prefixes may help search and fallback display, but they are not the grouping authority. This keeps the API reference aligned with Module Health, import/export release lists, and the same business-facing module names shown elsewhere in Axis. Module groups start collapsed so an operator or developer can scan capability areas first, expand only the area they need, and then open individual API operations. A search expands matching groups so the matching operations are visible without forcing the user to manually open every parent. The grouped catalogue does not paginate by individual API operation, because operation-level paging hides module groups unpredictably. Instead, Axis shows the complete matching group list and renders operation rows only when a group is expanded or a search is active.",
        },
        {
          kind: 'paragraph',
          text: 'Only one API operation detail panel stays expanded at a time. Opening another operation closes the previously open operation so the API reference remains easy to scan during long Swagger reviews.',
        },
        {
          kind: 'paragraph',
          text: 'Each operation may include an **Open this operation in Swagger** action. That link is derived from the same backend-provided Swagger path and OpenAPI operation id, so Axis does not invent a second route contract. If the operation does not declare a stable operation id or tag, Axis falls back to the top-level Swagger page instead of guessing.',
        },
        {
          kind: 'paragraph',
          text: "The backend Swagger page is opened as a separate browser page for interactive use; it is never embedded in an iframe because Nodics correctly protects backend pages with `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Both routes remain subject to Nodics API exposure policy. If exposure is disabled or the runtime is unavailable, Axis reports the failure and does not substitute a stale copied contract.",
        },
        {
          kind: 'paragraph',
          text: 'When a newer pack version is available, Axis keeps the installed Wiki readable and offers the backend-authorized **Update documentation** action. Labels and empty-state messages come from the bounded backend status contract. Axis sends only the employee bearer token and enterprise context to the registered System endpoint and never receives local paths, credentials, manifests, source files, or backend diagnostics.',
        },
        {
          kind: 'paragraph',
          text: 'The shared CMS navigation component supplies the searchable article index, category grouping, audience filters, and configurable labels. Each article supplies breadcrumb context, its table of contents, and previous/next references. Axis owns only their responsive and accessible presentation.',
        },
        {
          kind: 'paragraph',
          text: 'The documentation-product switcher is a responsive, horizontally scrollable segmented control. Its ordered products, labels, routes, and selected identity come from BackOffice bootstrap; its spacing, selected state, keyboard roles, focus behavior, and responsive presentation belong to Axis. It must remain visually consistent across installed documentation, import/update states, OpenAPI reference, unavailable connections, and future project products.',
        },
        {
          kind: 'paragraph',
          text: 'Refreshing a documentation URL restores the Profile-owned browser session before resolving the same CMS path. An expired or rejected session returns the employee to the public authentication journey.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Nodics Axis Content Pack',
          anchor: 'documentation-content-2-nodics-axis-content-pack',
        },
        {
          kind: 'paragraph',
          text: 'Axis documentation data is directly importable and committed under `data/core`. Its immutable release manifest is `manifest/docs-content-pack.json`. The manifest pack identity is `nodics.axis`; the configured nImport pack code is `axisDocumentation`; and its CMS binding is `axisDocumentationSite` → `axisDocumentationContentCatalog`.',
        },
        {
          kind: 'paragraph',
          text: 'The pack explains project purpose, architecture and repository boundaries, supported setup, page/template/component/renderer organization, backend contracts and security, responsive/accessibility behavior, extension, troubleshooting, and verification. Change the pack version whenever committed content hashes change. A same-version checksum change is rejected by default.',
        },
        {
          kind: 'paragraph',
          text: 'Canonical authored pages live under `content/documentation`. The committed records under `data/core` are deterministic generated projections, not an independent documentation authority. Run `npm run docs:generate` after changing an implemented Axis capability, then run `npm run docs:check` and `npm run verify`. The migration register must preserve the disposition, destination, headings, and detail evidence for every README or legacy docs source before those transitional files are reduced or retired.',
        },
        {
          kind: 'paragraph',
          text: 'The content-pack generator is scoped with the content source at `content/documentation/tooling/generate-documentation-content.js`. It remains tooling, not configuration: `config` is reserved for declarative runtime values and must not contain executable generators.',
        },
        {
          kind: 'paragraph',
          text: '`content/documentation/navigation.json` is the only authored Axis documentation release-version authority. Generation copies that version into CMS records, the migration register, and the immutable release manifest. Contributors must increment it before generating changed content and must not repair generated version projections by hand.',
        },
        {
          kind: 'paragraph',
          text: 'The same generation pass projects every canonical navigation page into matching CMS page, component, and route records. Route lists must never be maintained separately. The generated manifest page and route totals therefore describe the records that are actually importable, and `npm run docs:check` rejects any generated route drift before a release can be accepted.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Renderer Ownership',
          anchor: 'documentation-content-3-renderer-ownership',
        },
        {
          kind: 'unordered-list',
          items: [
            '`DocumentationArticlePageRenderer` owns page-to-slot composition.',
            '`DocumentationArticleTemplateRenderer` owns the responsive article layout.',
            '`DocumentationArticleRenderer` owns safe article-block presentation.',
            '`DocumentationNavigationRenderer` owns bounded search, category grouping, audience filtering, selected-route presentation, and documentation-home navigation.',
            '`OpenApiDocumentationRenderer` owns the browsable API-reference presentation, including module-hierarchy grouping, bounded search, operation expansion, and the external Swagger link.',
            'The typed renderer manifest and registries are the only mapping from CMS logical keys to Axis implementations.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The renderer accepts bounded headings, paragraphs, ordered and unordered lists, blockquotes, code blocks, tables, and image references. It does not execute HTML, scripts, event handlers, expressions, CMS-provided JavaScript, or arbitrary renderer URLs. Only `/docs`, anchor, HTTP(S), and mail links are eligible for navigation.',
        },
        {
          kind: 'paragraph',
          text: 'Code blocks use a theme-owned high-contrast surface and bounded responsive typography. Do not use undefined palette tokens: an unresolved background with a light foreground can make valid documentation appear blank.',
        },
        {
          kind: 'paragraph',
          text: 'Documentation links and the on-page heading index use the readable secondary text palette with a persistent gold underline. Signature gold remains an accent, focus, and action color; it must not be used as small text on light surfaces where it does not provide sufficient contrast.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Failure And Recovery',
          anchor: 'documentation-content-4-failure-and-recovery',
        },
        {
          kind: 'unordered-list',
          items: [
            'A missing or unavailable CMS route uses the existing CMS recovery screen and retry action.',
            'A disabled content-pack capability shows configuration guidance and no import action.',
            'A missing or checksum-invalid source shows a low-disclosure unavailable state.',
            'An unauthorized employee cannot view or run content-pack operations even if a control is forced in the browser.',
            'A failed update keeps the Wiki route available and presents a retryable, low-disclosure failure. Import diagnostics and data reconciliation remain backend responsibilities.',
            'An immutable-release conflict tells the operator that documentation content changed without a new release version and directs the release owner to increment and regenerate the pack. Axis maps the stable backend error code; it never renders backend stacks, contexts, record data, or arbitrary diagnostic messages.',
            'A missing renderer, unsupported contract version, unsupported channel, or malformed property is rejected by the CMS render boundary.',
            'A disabled or unavailable BackOffice documentation contribution displays the standard module workspace state.',
            'Unsupported content blocks are not rendered.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Binary image delivery is not yet owned by the CMS delivery contract. Image metadata is migrated and validated by `nodics.docs`, while Axis presents a non-executable placeholder until a governed CMS/DAM binary-delivery contract is implemented. Do not add repository file paths or ad-hoc static-file loaders to bypass that boundary.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'documentation-content-5-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: "Author or extend project documentation in that project's canonical structured source and generate its committed `data/core` content pack with `manifest/docs-content-pack.json`. Register the pack through the Nodics-owned documentation contribution contract; Axis discovers and renders the resulting navigation and article blocks.",
        },
        {
          kind: 'paragraph',
          text: "Do not hand-edit generated CMS records, add repository file readers to Axis, create a browser import engine, or duplicate a project's documentation inside the framework pack. Test deterministic generation, stale-pack rejection, permissions, checksum and version boundaries, unsafe links and blocks, missing media, import/update recovery, OpenAPI module grouping, navigation, responsive rendering, and rollback to a previously accepted immutable release.",
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Contributor Verification',
          anchor: 'documentation-content-6-contributor-verification',
        },
        {
          kind: 'paragraph',
          text: 'Run:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run verify',
        },
        {
          kind: 'paragraph',
          text: 'The suite covers registry parity, declarative article rendering, unsafe-link rejection, executable-block rejection, TypeScript, accessibility-oriented markup, linting, formatting, and production build behavior.',
        },
      ],
      searchText:
        "Documentation Content in Axis Understand dynamic documentation products, content-pack installation, renderer ownership, failure recovery, and contributor verification. # Documentation Content In Axis\n\nAxis renders an authorized, backend-provided list of documentation products\nunder `/docs/*`. BackOffice aggregates the list from active module metadata;\nAxis does not hardcode product tabs or maintain another registry.\n\n- **Framework** renders the canonical `nodics.docs` content pack through CMS.\n- **Swaggers** renders the active System-owned OpenAPI contract in an\n  Axis-owned, searchable reference and links to the backend's standalone\n  interactive Swagger UI. API descriptions are not copied into a content\n  catalog.\n- **Nodics Axis** renders this repository's committed documentation content\n  pack through its own CMS Site and content catalog.\n- A future customer project contributes its own source from its backend project\n  module and supplies import-ready data from the corresponding project\n  repository.\n\nEach CMS documentation product has a separate Site/catalog pair. CMS resolves\nthe Site to its catalog, so Axis never adds a second catalog-routing authority.\nNodics CMS remains runtime content and route authority; nImport remains the\nonly content-pack installation and update authority.\n\n## Employee Journey\n\n1. Sign in with an authorized employee account.\n2. Open **Documentation > Nodics Documentation**.\n3. Axis renders the ordered source tabs returned by the secured BackOffice\n   bootstrap.\n4. Select a CMS product or **Swaggers**. Axis resolves the configured runtime\n   connection by `connectionModule`; it never stores a second endpoint list.\n5. For a CMS source, Axis asks the registered System module for that source's\n   configured content-pack state.\n6. When the pack is absent, an authorized administrator may select **Import\n   documentation**. Axis never reads a repository or imports records itself.\n7. When the pack is current, Axis requests the selected product path from the CMS endpoint supplied by\n   BackOffice bootstrap.\n8. CMS resolves the Site, locale, channel, route, page, template, component,\n   renderer mappings, and access mode.\n9. Axis validates the renderer contract and displays the declarative article.\n10. Internal documentation links remain inside the authenticated Axis shell.\n\nFor **Swaggers**, Axis uses the selected source's registered System connection,\nOpenAPI path, and Swagger path. Axis fetches and bounds the JSON OpenAPI\ncontract, then renders searchable method, path, summary, description, tags,\noperation metadata, parameters, request body, response codes, content types,\nschema summaries, and declared security scheme names as text through its own\ncomponents. Axis does not execute API calls from this read-only catalogue. API\noperations are grouped by the Nodics module hierarchy: operation ownership\ncomes from the generated OpenAPI `x-nodics.moduleName` metadata, while display\nnames, parent modules, and group labels come from BackOffice's authenticated\nmodule registry projection. Tags and path prefixes may help search and fallback\ndisplay, but they are not the grouping authority. This keeps the API reference\naligned with Module Health, import/export release lists, and the same\nbusiness-facing module names shown elsewhere in Axis. Module groups start\ncollapsed so an operator or developer can scan capability areas first, expand\nonly the area they need, and then open individual API operations. A search\nexpands matching groups so the matching operations are visible without forcing\nthe user to manually open every parent. The grouped catalogue does not paginate\nby individual API operation, because operation-level paging hides module groups\nunpredictably. Instead, Axis shows the complete matching group list and renders\noperation rows only when a group is expanded or a search is active.\n\nOnly one API operation detail panel stays expanded at a time. Opening another\noperation closes the previously open operation so the API reference remains\neasy to scan during long Swagger reviews.\n\nEach operation may include an **Open this operation in Swagger** action. That\nlink is derived from the same backend-provided Swagger path and OpenAPI\noperation id, so Axis does not invent a second route contract. If the operation\ndoes not declare a stable operation id or tag, Axis falls back to the top-level\nSwagger page instead of guessing.\n\nThe backend Swagger page is opened as a separate browser page for interactive\nuse; it is never embedded in an iframe because Nodics correctly protects\nbackend pages with `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Both\nroutes remain subject to Nodics API exposure policy. If exposure is disabled or\nthe runtime is unavailable, Axis reports the failure and does not substitute a\nstale copied contract.\n\nWhen a newer pack version is available, Axis keeps the installed Wiki readable\nand offers the backend-authorized **Update documentation** action. Labels and\nempty-state messages come from the bounded backend status contract. Axis sends\nonly the employee bearer token and enterprise context to the registered System\nendpoint and never receives local paths, credentials, manifests, source files,\nor backend diagnostics.\n\nThe shared CMS navigation component supplies the searchable article index,\ncategory grouping, audience filters, and configurable labels. Each article\nsupplies breadcrumb context, its table of contents, and previous/next\nreferences. Axis owns only their responsive and accessible presentation.\n\nThe documentation-product switcher is a responsive, horizontally scrollable\nsegmented control. Its ordered products, labels, routes, and selected identity\ncome from BackOffice bootstrap; its spacing, selected state, keyboard roles,\nfocus behavior, and responsive presentation belong to Axis. It must remain\nvisually consistent across installed documentation, import/update states,\nOpenAPI reference, unavailable connections, and future project products.\n\nRefreshing a documentation URL restores the Profile-owned browser session\nbefore resolving the same CMS path. An expired or rejected session returns the\nemployee to the public authentication journey.\n\n## Nodics Axis Content Pack\n\nAxis documentation data is directly importable and committed under\n`data/core`. Its immutable release manifest is\n`manifest/docs-content-pack.json`. The manifest pack identity is `nodics.axis`;\nthe configured nImport pack code is `axisDocumentation`; and its CMS binding is\n`axisDocumentationSite` → `axisDocumentationContentCatalog`.\n\nThe pack explains project purpose, architecture and repository boundaries,\nsupported setup, page/template/component/renderer organization, backend\ncontracts and security, responsive/accessibility behavior, extension,\ntroubleshooting, and verification. Change the pack version whenever committed\ncontent hashes change. A same-version checksum change is rejected by default.\n\nCanonical authored pages live under `content/documentation`. The committed\nrecords under `data/core` are deterministic generated projections, not an\nindependent documentation authority. Run `npm run docs:generate` after changing\nan implemented Axis capability, then run `npm run docs:check` and\n`npm run verify`. The migration register must preserve the disposition,\ndestination, headings, and detail evidence for every README or legacy docs\nsource before those transitional files are reduced or retired.\n\nThe content-pack generator is scoped with the content source at\n`content/documentation/tooling/generate-documentation-content.js`. It remains\ntooling, not configuration: `config` is reserved for declarative runtime values\nand must not contain executable generators.\n\n`content/documentation/navigation.json` is the only authored Axis documentation\nrelease-version authority. Generation copies that version into CMS records,\nthe migration register, and the immutable release manifest. Contributors must\nincrement it before generating changed content and must not repair generated\nversion projections by hand.\n\nThe same generation pass projects every canonical navigation page into matching\nCMS page, component, and route records. Route lists must never be maintained\nseparately. The generated manifest page and route totals therefore describe the\nrecords that are actually importable, and `npm run docs:check` rejects any\ngenerated route drift before a release can be accepted.\n\n## Renderer Ownership\n\n- `DocumentationArticlePageRenderer` owns page-to-slot composition.\n- `DocumentationArticleTemplateRenderer` owns the responsive article layout.\n- `DocumentationArticleRenderer` owns safe article-block presentation.\n- `DocumentationNavigationRenderer` owns bounded search, category grouping,\n  audience filtering, selected-route presentation, and documentation-home\n  navigation.\n- `OpenApiDocumentationRenderer` owns the browsable API-reference\n  presentation, including module-hierarchy grouping, bounded search,\n  operation expansion, and the external Swagger link.\n- The typed renderer manifest and registries are the only mapping from CMS\n  logical keys to Axis implementations.\n\nThe renderer accepts bounded headings, paragraphs, ordered and unordered\nlists, blockquotes, code blocks, tables, and image references. It does not\nexecute HTML, scripts, event handlers, expressions, CMS-provided JavaScript, or\narbitrary renderer URLs. Only `/docs`, anchor, HTTP(S), and mail links are\neligible for navigation.\n\nCode blocks use a theme-owned high-contrast surface and bounded responsive\ntypography. Do not use undefined palette tokens: an unresolved background with\na light foreground can make valid documentation appear blank.\n\nDocumentation links and the on-page heading index use the readable secondary\ntext palette with a persistent gold underline. Signature gold remains an\naccent, focus, and action color; it must not be used as small text on light\nsurfaces where it does not provide sufficient contrast.\n\n## Failure And Recovery\n\n- A missing or unavailable CMS route uses the existing CMS recovery screen and\n  retry action.\n- A disabled content-pack capability shows configuration guidance and no\n  import action.\n- A missing or checksum-invalid source shows a low-disclosure unavailable\n  state.\n- An unauthorized employee cannot view or run content-pack operations even if\n  a control is forced in the browser.\n- A failed update keeps the Wiki route available and presents a retryable,\n  low-disclosure failure. Import diagnostics and data reconciliation remain\n  backend responsibilities.\n- An immutable-release conflict tells the operator that documentation content\n  changed without a new release version and directs the release owner to\n  increment and regenerate the pack. Axis maps the stable backend error code;\n  it never renders backend stacks, contexts, record data, or arbitrary\n  diagnostic messages.\n- A missing renderer, unsupported contract version, unsupported channel, or\n  malformed property is rejected by the CMS render boundary.\n- A disabled or unavailable BackOffice documentation contribution displays the\n  standard module workspace state.\n- Unsupported content blocks are not rendered.\n\nBinary image delivery is not yet owned by the CMS delivery contract. Image\nmetadata is migrated and validated by `nodics.docs`, while Axis presents a\nnon-executable placeholder until a governed CMS/DAM binary-delivery contract\nis implemented. Do not add repository file paths or ad-hoc static-file loaders\nto bypass that boundary.\n\n## Customize and extend safely\n\nAuthor or extend project documentation in that project's canonical structured\nsource and generate its committed `data/core` content pack with\n`manifest/docs-content-pack.json`. Register the pack through the Nodics-owned\ndocumentation contribution contract; Axis discovers and renders the resulting\nnavigation and article blocks.\n\nDo not hand-edit generated CMS records, add repository file readers to Axis,\ncreate a browser import engine, or duplicate a project's documentation inside\nthe framework pack. Test deterministic generation, stale-pack rejection,\npermissions, checksum and version boundaries, unsafe links and blocks, missing\nmedia, import/update recovery, OpenAPI module grouping, navigation, responsive\nrendering, and rollback to a previously accepted immutable release.\n\n## Contributor Verification\n\nRun:\n\n```bash\nnpm run verify\n```\n\nThe suite covers registry parity, declarative article rendering, unsafe-link\nrejection, executable-block rejection, TypeScript, accessibility-oriented\nmarkup, linting, formatting, and production build behavior.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/documentation-content.md',
        evidence: 'docs/documentation-content.md',
        hash: '9de01e9cd73fedbbf930b33c7ee735871f6fb52d94fdef779ef207a3d2148eff',
        version: '0.3.19',
      },
      previous: {
        title: 'CMS Delivery and Renderer Integration',
        route: '/docs/nodics-axis/cms-renderers',
      },
      next: {
        title: 'Employee Login, Recovery, Lock, and Dashboard',
        route: '/docs/nodics-axis/employee-access',
      },
    },
    active: true,
  },
  record7: {
    code: 'axisDocsComponentemployeeaccess',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.employee-access',
      title: 'Employee Login, Recovery, Lock, and Dashboard',
      route: '/docs/nodics-axis/employee-access',
      section: 'axis-capabilities',
      sectionTitle: 'Axis Capabilities',
      category: 'Axis Capabilities',
      audience: ['business-user', 'administrator', 'developer', 'security-reviewer'],
      summary:
        'Operate the employee-only authentication journey, recovery, persistent browser session, idle lock, logout, configuration, and safe failures.',
      headings: [
        {
          text: 'Startup journey',
          anchor: 'employee-access-1-startup-journey',
          level: 2,
        },
        {
          text: 'Password recovery',
          anchor: 'employee-access-2-password-recovery',
          level: 2,
        },
        {
          text: 'Idle screen lock',
          anchor: 'employee-access-3-idle-screen-lock',
          level: 2,
        },
        {
          text: 'Logout',
          anchor: 'employee-access-4-logout',
          level: 2,
        },
        {
          text: 'Configuration',
          anchor: 'employee-access-5-configuration',
          level: 2,
        },
        {
          text: 'Failure behavior',
          anchor: 'employee-access-6-failure-behavior',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'employee-access-7-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Verification',
          anchor: 'employee-access-8-verification',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Axis is an employee Back Office application. Customer credentials must not be submitted to its login flow.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Startup journey',
          anchor: 'employee-access-1-startup-journey',
        },
        {
          kind: 'ordered-list',
          items: [
            'Axis reads public deployment configuration from `/axis-config.json`.',
            'Axis calls the BackOffice public bootstrap.',
            'BackOffice returns only active Profile/CMS endpoints and Axis CMS composition identifiers.',
            'Axis loads `/login` directly from CMS public delivery.',
            'Axis sends entered employee credentials directly to Profile.',
            'Axis keeps the returned access token in memory only. Profile stores the refresh credential in a scoped `HttpOnly` cookie that Axis cannot read.',
            'Axis calls secured BackOffice bootstrap with the access token.',
            'BackOffice returns the effective tenant-scoped Axis employee policy, authorized module catalogue, navigation contributions, compatibility, availability, and client-safe environment observations.',
            'Axis constructs its shell from the local Dashboard route plus authorized module-owned navigation.',
            'If authorized, Axis loads `/dashboard` from authenticated CMS delivery.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'A customer login is never used as a fallback. Authentication or authorization failure keeps the employee outside the dashboard and displays a safe message.',
        },
        {
          kind: 'paragraph',
          text: 'Password fields on login and lock-screen pages include an accessible show/hide control so employees can verify local typing mistakes before submission. Revealing a password changes only the current input presentation. Axis still sends the value only to Profile, never stores it, and never exposes it through BackOffice, CMS, URLs, logs, query cache, or browser storage.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Password recovery',
          anchor: 'employee-access-2-password-recovery',
        },
        {
          kind: 'paragraph',
          text: 'The public `/forgot-password` page uses the same responsive authentication layout as login, with CMS-owned introduction, identifier label, placeholder, action label, assistance, and legal text. Axis intentionally keeps submission unavailable today because Profile does not yet expose an approved employee self-recovery API.',
        },
        {
          kind: 'paragraph',
          text: 'Do not simulate success, send identifiers to BackOffice or CMS, or build a frontend-only reset path. The future Profile contract must be anti-enumeration, rate-limited, tenant-aware, auditable, and compatible with the existing OTP and notification authorities before this form is connected.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Idle screen lock',
          anchor: 'employee-access-3-idle-screen-lock',
        },
        {
          kind: 'paragraph',
          text: 'The secured bootstrap returns `axisPolicy` after employee authentication. Version 1 supports `screenLockEnabled`, `idleTimeoutSeconds` from 60 through 86,400, the policy contract version and optimistic revision, and whether the effective policy came from layered defaults or persistence.',
        },
        {
          kind: 'paragraph',
          text: 'Axis observes keyboard, pointer, touch, and wheel activity. Pointer movement is throttled to one deadline update per second to avoid high-frequency work. Background-tab timer throttling is handled by comparing the absolute deadline when the page becomes visible again.',
        },
        {
          kind: 'paragraph',
          text: 'When the deadline passes, Axis:',
        },
        {
          kind: 'ordered-list',
          items: [
            'records a bounded lock marker and same-application return path in `sessionStorage`;',
            'replaces it with `/lock-screen`;',
            'keeps tokens and the employee identifier in memory only;',
            'hides protected application content;',
            'asks only for the current employee password; and',
            'sends that password directly to Profile.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'A successful unlock receives fresh Profile tokens, reloads secured BackOffice bootstrap and policy, removes the lock marker, and returns to the prior protected route. A failed unlock stays locked and shows a safe authentication error. “Not you? Sign out” clears the marker and local session, asks Profile to revoke it, and returns to `/login`.',
        },
        {
          kind: 'paragraph',
          text: 'The marker contains only `locked: true` and a validated relative return path. It never contains a password, access token, refresh token, employee identifier, backend response, or authorization data. External, malformed, authentication, and lock-screen return paths fall back to `/dashboard`.',
        },
        {
          kind: 'paragraph',
          text: 'The screen lock is presentation defense-in-depth. It never replaces bearer expiry, revocation, Profile authentication, or target-module authorization.',
        },
        {
          kind: 'paragraph',
          text: 'On browser refresh, Axis reads only the non-secret CSRF cookie and calls the Profile browser restore endpoint with credentials included. Profile requires the exact allowed Origin and matching `X-CSRF-Token`, consumes the refresh credential once, rotates it, and returns a replacement access token and employee identifier. Axis then reloads the secured BackOffice bootstrap and restores the lock gate before protected routing. A session that was locked before refresh remains on `/lock-screen` until successful password re-verification; refresh cannot silently return it to the dashboard. An expired, revoked, replayed, or otherwise invalid session returns to the public login experience.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Logout',
          anchor: 'employee-access-4-logout',
        },
        {
          kind: 'paragraph',
          text: 'Axis sends the configured CSRF value to Profile, which revokes refresh state and expires both browser-session cookies. Only after Profile confirms that operation does Axis clear its in-memory access token and redirect to `/login`. If Profile is unavailable, Axis keeps the secured session visible and reports that logout was not completed; it never presents a false signed-out state while an HttpOnly refresh session remains active. The existing short-lived access token remains bounded by backend expiry and revocation policy.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Configuration',
          anchor: 'employee-access-5-configuration',
        },
        {
          kind: 'paragraph',
          text: 'The root `.env` contains only public deployment values:',
        },
        {
          kind: 'code',
          language: 'dotenv',
          text: 'AXIS_BACKOFFICE_BASE_URL=http://localhost:3000\nAXIS_ENTERPRISE_CODE=default\nAXIS_CLIENT_CONTRACT_VERSION=1\nAXIS_REQUEST_TIMEOUT_MS=10000\nAXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf',
        },
        {
          kind: 'paragraph',
          text: "The CSRF cookie name is public protocol configuration and must equal Profile's effective `profileBrowserSession.csrfCookieName`. Do not add Profile or CMS URLs. BackOffice discovers them from module self-registration. Never place passwords or tokens in `.env`, browser storage, URLs, logs, or query-cache keys.",
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Failure behavior',
          anchor: 'employee-access-6-failure-behavior',
        },
        {
          kind: 'unordered-list',
          items: [
            'Invalid configuration uses static configuration recovery.',
            'BackOffice discovery failure uses static discovery recovery with retry.',
            'Missing Profile or CMS registration fails public bootstrap closed.',
            'CMS failure or incompatibility uses static CMS recovery with retry.',
            'Invalid employee credentials produce a safe login error.',
            'Missing BackOffice permission rejects the session before dashboard delivery.',
            'Direct `/dashboard` navigation attempts Profile-owned session restoration; absent or invalid refresh state redirects to `/login`.',
            'Direct `/lock-screen` navigation without an authenticated locked session redirects safely.',
            'Refreshing a locked session restores the lock marker and requires password verification before any protected route is rendered.',
            'Invalid or incompatible Axis policy rejects authenticated bootstrap.',
            'Persistent-policy read failure is handled by BackOffice using its safe configured default.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Employee password recovery is not yet a Profile capability. The CMS page may explain the process, but Axis keeps submission disabled until Profile provides a governed, enumeration-safe recovery contract.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'employee-access-7-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: "Customize login, recovery, and lock-screen presentation through CMS component properties and project-owned renderer composition. Add a new authentication view only as a focused renderer with a typed logical-key registration while continuing to use Profile's browser-session, CSRF, refresh, revocation, and employee-only contracts.",
        },
        {
          kind: 'paragraph',
          text: 'Do not replace Profile authentication, store tokens in browser storage, embed credentials in configuration, infer authorization from the UI, or implement password recovery locally. Test valid and invalid credentials, customer-user rejection, missing permissions, refresh restoration, locked-page refresh, CSRF rejection, idle boundaries, logout revocation, malformed CMS properties, responsive layout, and rollback of the project renderer registration.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification',
          anchor: 'employee-access-8-verification',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run verify',
        },
        {
          kind: 'paragraph',
          text: 'Tests cover low-disclosure discovery, policy validation, credential delivery to Profile, HttpOnly refresh restoration, CSRF transport, secured bootstrap bearer use, protected-route preservation after remount, invalid-session fallback, CMS authentication pages, inactivity boundaries, activity deadline reset, protected routing, and logout revocation.',
        },
      ],
      searchText:
        "Employee Login, Recovery, Lock, and Dashboard Operate the employee-only authentication journey, recovery, persistent browser session, idle lock, logout, configuration, and safe failures. # Employee Login, Recovery, Screen Lock, and Dashboard\n\nAxis is an employee Back Office application. Customer credentials must not be\nsubmitted to its login flow.\n\n## Startup journey\n\n1. Axis reads public deployment configuration from `/axis-config.json`.\n2. Axis calls the BackOffice public bootstrap.\n3. BackOffice returns only active Profile/CMS endpoints and Axis CMS\n   composition identifiers.\n4. Axis loads `/login` directly from CMS public delivery.\n5. Axis sends entered employee credentials directly to Profile.\n6. Axis keeps the returned access token in memory only. Profile stores the\n   refresh credential in a scoped `HttpOnly` cookie that Axis cannot read.\n7. Axis calls secured BackOffice bootstrap with the access token.\n8. BackOffice returns the effective tenant-scoped Axis employee policy,\n   authorized module catalogue, navigation contributions, compatibility,\n   availability, and client-safe environment observations.\n9. Axis constructs its shell from the local Dashboard route plus authorized\n   module-owned navigation.\n10. If authorized, Axis loads `/dashboard` from authenticated CMS delivery.\n\nA customer login is never used as a fallback. Authentication or authorization\nfailure keeps the employee outside the dashboard and displays a safe message.\n\nPassword fields on login and lock-screen pages include an accessible show/hide\ncontrol so employees can verify local typing mistakes before submission.\nRevealing a password changes only the current input presentation. Axis still\nsends the value only to Profile, never stores it, and never exposes it through\nBackOffice, CMS, URLs, logs, query cache, or browser storage.\n\n## Password recovery\n\nThe public `/forgot-password` page uses the same responsive authentication\nlayout as login, with CMS-owned introduction, identifier label, placeholder,\naction label, assistance, and legal text. Axis intentionally keeps submission\nunavailable today because Profile does not yet expose an approved employee\nself-recovery API.\n\nDo not simulate success, send identifiers to BackOffice or CMS, or build a\nfrontend-only reset path. The future Profile contract must be anti-enumeration,\nrate-limited, tenant-aware, auditable, and compatible with the existing OTP and\nnotification authorities before this form is connected.\n\n## Idle screen lock\n\nThe secured bootstrap returns `axisPolicy` after employee authentication.\nVersion 1 supports `screenLockEnabled`, `idleTimeoutSeconds` from 60 through\n86,400, the policy contract version and optimistic revision, and whether the\neffective policy came from layered defaults or persistence.\n\nAxis observes keyboard, pointer, touch, and wheel activity. Pointer movement is\nthrottled to one deadline update per second to avoid high-frequency work.\nBackground-tab timer throttling is handled by comparing the absolute deadline\nwhen the page becomes visible again.\n\nWhen the deadline passes, Axis:\n\n1. records a bounded lock marker and same-application return path in\n   `sessionStorage`;\n2. replaces it with `/lock-screen`;\n3. keeps tokens and the employee identifier in memory only;\n4. hides protected application content;\n5. asks only for the current employee password; and\n6. sends that password directly to Profile.\n\nA successful unlock receives fresh Profile tokens, reloads secured BackOffice\nbootstrap and policy, removes the lock marker, and returns to the prior\nprotected route. A failed unlock stays locked and shows a safe authentication\nerror. “Not you? Sign out” clears the marker and local session, asks Profile to\nrevoke it, and returns to `/login`.\n\nThe marker contains only `locked: true` and a validated relative return path.\nIt never contains a password, access token, refresh token, employee identifier,\nbackend response, or authorization data. External, malformed, authentication,\nand lock-screen return paths fall back to `/dashboard`.\n\nThe screen lock is presentation defense-in-depth. It never replaces bearer\nexpiry, revocation, Profile authentication, or target-module authorization.\n\nOn browser refresh, Axis reads only the non-secret CSRF cookie and calls the\nProfile browser restore endpoint with credentials included. Profile requires\nthe exact allowed Origin and matching `X-CSRF-Token`, consumes the refresh\ncredential once, rotates it, and returns a replacement access token and\nemployee identifier. Axis then reloads the secured BackOffice bootstrap and\nrestores the lock gate before protected routing. A session that was locked\nbefore refresh remains on `/lock-screen` until successful password\nre-verification; refresh cannot silently return it to the dashboard. An\nexpired, revoked, replayed, or otherwise invalid session returns to the public\nlogin experience.\n\n## Logout\n\nAxis sends the configured CSRF value to Profile, which revokes refresh state\nand expires both browser-session cookies. Only after Profile confirms that\noperation does Axis clear its in-memory access token and redirect to `/login`.\nIf Profile is unavailable, Axis keeps the secured session visible and reports\nthat logout was not completed; it never presents a false signed-out state while\nan HttpOnly refresh session remains active. The existing short-lived access\ntoken remains bounded by backend expiry and revocation policy.\n\n## Configuration\n\nThe root `.env` contains only public deployment values:\n\n```dotenv\nAXIS_BACKOFFICE_BASE_URL=http://localhost:3000\nAXIS_ENTERPRISE_CODE=default\nAXIS_CLIENT_CONTRACT_VERSION=1\nAXIS_REQUEST_TIMEOUT_MS=10000\nAXIS_BROWSER_SESSION_CSRF_COOKIE_NAME=nodics_axis_csrf\n```\n\nThe CSRF cookie name is public protocol configuration and must equal Profile's\neffective `profileBrowserSession.csrfCookieName`. Do not add Profile or CMS\nURLs. BackOffice discovers them from module self-registration. Never place\npasswords or tokens in `.env`, browser storage, URLs, logs, or query-cache keys.\n\n## Failure behavior\n\n- Invalid configuration uses static configuration recovery.\n- BackOffice discovery failure uses static discovery recovery with retry.\n- Missing Profile or CMS registration fails public bootstrap closed.\n- CMS failure or incompatibility uses static CMS recovery with retry.\n- Invalid employee credentials produce a safe login error.\n- Missing BackOffice permission rejects the session before dashboard delivery.\n- Direct `/dashboard` navigation attempts Profile-owned session restoration;\n  absent or invalid refresh state redirects to `/login`.\n- Direct `/lock-screen` navigation without an authenticated locked session\n  redirects safely.\n- Refreshing a locked session restores the lock marker and requires password\n  verification before any protected route is rendered.\n- Invalid or incompatible Axis policy rejects authenticated bootstrap.\n- Persistent-policy read failure is handled by BackOffice using its safe\n  configured default.\n\nEmployee password recovery is not yet a Profile capability. The CMS page may\nexplain the process, but Axis keeps submission disabled until Profile provides\na governed, enumeration-safe recovery contract.\n\n## Customize and extend safely\n\nCustomize login, recovery, and lock-screen presentation through CMS component\nproperties and project-owned renderer composition. Add a new authentication\nview only as a focused renderer with a typed logical-key registration while\ncontinuing to use Profile's browser-session, CSRF, refresh, revocation, and\nemployee-only contracts.\n\nDo not replace Profile authentication, store tokens in browser storage, embed\ncredentials in configuration, infer authorization from the UI, or implement\npassword recovery locally. Test valid and invalid credentials, customer-user\nrejection, missing permissions, refresh restoration, locked-page refresh,\nCSRF rejection, idle boundaries, logout revocation, malformed CMS properties,\nresponsive layout, and rollback of the project renderer registration.\n\n## Verification\n\n```bash\nnpm run verify\n```\n\nTests cover low-disclosure discovery, policy validation, credential delivery\nto Profile, HttpOnly refresh restoration, CSRF transport, secured bootstrap\nbearer use, protected-route preservation after remount, invalid-session\nfallback, CMS authentication pages, inactivity boundaries, activity deadline\nreset, protected routing, and logout revocation.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/employee-login.md',
        evidence: 'docs/employee-login.md',
        hash: '66fe7b8b4a1d494575851de67d521be1d62b746202d60226599b7ea35057f77f',
        version: '0.3.19',
      },
      previous: {
        title: 'Documentation Content in Axis',
        route: '/docs/nodics-axis/documentation-content',
      },
      next: {
        title: 'Axis Assistant Frontend',
        route: '/docs/nodics-axis/assistant',
      },
    },
    active: true,
  },
  record8: {
    code: 'axisDocsComponentassistant',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.assistant',
      title: 'Axis Assistant Frontend',
      route: '/docs/nodics-axis/assistant',
      section: 'axis-capabilities',
      sectionTitle: 'Axis Capabilities',
      category: 'Axis Capabilities',
      audience: ['business-user', 'developer', 'architect', 'security-reviewer'],
      summary:
        'Learn the governed Assistant request flow, typed API contracts, resumable streaming, presentation lifecycle, evidence, accessibility, and security behavior.',
      headings: [
        {
          text: 'Implemented scope',
          anchor: 'assistant-1-implemented-scope',
          level: 2,
        },
        {
          text: 'Authority and request flow',
          anchor: 'assistant-2-authority-and-request-flow',
          level: 2,
        },
        {
          text: 'Source map',
          anchor: 'assistant-3-source-map',
          level: 2,
        },
        {
          text: 'CMS customization',
          anchor: 'assistant-4-cms-customization',
          level: 2,
        },
        {
          text: 'Typed API coverage',
          anchor: 'assistant-5-typed-api-coverage',
          level: 2,
        },
        {
          text: 'Presentation lifecycle',
          anchor: 'assistant-6-presentation-lifecycle',
          level: 2,
        },
        {
          text: 'Accessibility and responsive behavior',
          anchor: 'assistant-7-accessibility-and-responsive-behavior',
          level: 2,
        },
        {
          text: 'Failure and security behavior',
          anchor: 'assistant-8-failure-and-security-behavior',
          level: 2,
        },
        {
          text: 'Verification',
          anchor: 'assistant-9-verification',
          level: 2,
        },
        {
          text: 'Structured interactions',
          anchor: 'assistant-10-structured-interactions',
          level: 2,
        },
        {
          text: 'Evidence and operational transparency',
          anchor: 'assistant-11-evidence-and-operational-transparency',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'assistant-12-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Known next boundary',
          anchor: 'assistant-13-known-next-boundary',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Implemented scope',
          anchor: 'assistant-1-implemented-scope',
        },
        {
          kind: 'paragraph',
          text: 'Axis implements the authenticated `/assistant` CMS route, dedicated Assistant page/template/component renderer hierarchy, BackOffice-driven top navigation shortcut, validated direct-module connection projection, and a typed provider-neutral Assistant HTTP client.',
        },
        {
          kind: 'paragraph',
          text: 'The workspace presents backend-owned CMS content, an interactive composer, employee and Assistant message surfaces, smooth streamed text, progress feedback, cancellation, and safe failure presentation. The authenticated SSE transport and presentation state controller drive the visible experience. No browser request is sent to OpenAI, Anthropic, Gemini, or another provider.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Authority and request flow',
          anchor: 'assistant-2-authority-and-request-flow',
        },
        {
          kind: 'ordered-list',
          items: [
            'BackOffice authenticated bootstrap advertises the authorized `aiAssistant` capability, navigation entry, availability, and client-callable module leases.',
            'Axis validates those values and selects only an `UP` or `DEGRADED` connection. Credentials, query strings, fragments, and non-HTTP endpoints are rejected.',
            'CMS authenticated delivery resolves `/assistant` for the configured Site, locale, and channel.',
            'The CMS logical renderer keys map to allowlisted Axis-owned React implementations.',
            'The typed Assistant client sends the employee bearer directly to the discovered `aiAssistant` module endpoint.',
            'Nodics owns authorization, validation, persistence, provider selection, token governance, tools, Workflow handoff, and audit.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Axis does not proxy Assistant calls through BackOffice and does not select or call an AI provider.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Source map',
          anchor: 'assistant-3-source-map',
        },
        {
          kind: 'unordered-list',
          items: [
            '`src/bootstrap/publicBootstrap.ts`: authorized navigation and module connection validation.',
            '`src/cms/renderers/pages/AssistantPageRenderer.tsx`: Assistant page slot composition.',
            '`src/cms/renderers/templates/AssistantWorkspaceTemplateRenderer.tsx`: responsive workspace structure.',
            '`src/cms/renderers/components/assistant/AssistantWorkspaceRenderer.tsx`: CMS-driven workspace composition.',
            '`src/cms/renderers/components/assistant/AssistantMessageTimeline.tsx`: stable, auto-following activity region.',
            '`src/cms/renderers/components/assistant/AssistantMessageBubble.tsx`: employee and Assistant text presentation.',
            '`src/cms/renderers/components/assistant/AssistantStreamingStatus.tsx`: accessible non-terminal progress.',
            '`src/cms/renderers/components/assistant/AssistantComposer.tsx`: keyboard and touch-friendly Send and Stop controls.',
            '`src/cms/renderers/components/assistant/AssistantConversationHistory.tsx`: responsive conversation selection and bounded pagination.',
            '`src/assistant/api/assistantContracts.ts`: provider-neutral domain contracts.',
            '`src/assistant/api/assistantContractParsers.ts`: untrusted response validation.',
            '`src/assistant/api/assistantTransport.ts`: shared authenticated HTTP boundary.',
            '`src/assistant/api/assistantClient.ts`: bounded Assistant commands.',
            '`src/assistant/api/assistantSseParser.ts`: incremental, byte-bounded SSE framing.',
            '`src/assistant/api/assistantEventStream.ts`: authenticated event delivery, ordering, resume, and reconnect.',
            '`src/assistant/presentation/assistantPresentationContracts.ts`: UI-facing state and action contracts.',
            '`src/assistant/presentation/assistantPresentationReducer.ts`: pure, deterministic event projection.',
            '`src/assistant/presentation/assistantQueryKeys.ts`: enterprise, employee, conversation, and turn cache isolation.',
            '`src/assistant/presentation/useAssistantPresentation.ts`: lifecycle composition for conversation creation, turn submission, streaming, and cancellation.',
            '`src/assistant/api/assistantError.ts`: stable backend error and correlation projection.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'CMS customization',
          anchor: 'assistant-4-cms-customization',
        },
        {
          kind: 'paragraph',
          text: 'The backend component properties currently control:',
        },
        {
          kind: 'unordered-list',
          items: [
            'title;',
            'welcome message;',
            'composer placeholder;',
            'send and stop labels;',
            'empty-state text;',
            'employee and Assistant speaker labels;',
            'working, cancelling, and failure labels;',
            'conversation history, new conversation, empty history, and load-more labels.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Changing these properties in the authoritative CMS content changes Axis after the next CMS delivery without rebuilding the frontend. Axis never accepts backend JavaScript, component imports, event handlers, arbitrary HTML, or CSS.',
        },
        {
          kind: 'paragraph',
          text: 'Locale and channel remain part of the CMS delivery request. Renderers must tolerate translated text expansion and future right-to-left content. Axis does not translate by parsing English text.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Typed API coverage',
          anchor: 'assistant-5-typed-api-coverage',
        },
        {
          kind: 'paragraph',
          text: 'The current client implements only backend routes that exist:',
        },
        {
          kind: 'unordered-list',
          items: [
            'create, list, and retrieve employee-owned conversations;',
            'submit and retrieve a turn;',
            'replay persisted turn events;',
            'cancel a turn;',
            'create, retrieve, approve, and reject a mutation confirmation;',
            'execute or hand off an approved confirmation.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Requests use:',
        },
        {
          kind: 'unordered-list',
          items: [
            'memory-only employee access token;',
            'validated enterprise context;',
            'bounded query values;',
            'abort and timeout handling;',
            '`Idempotency-Key` for turn and confirmation creation;',
            'no browser credentials in URLs, logs, or storage.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The event stream additionally enforces the backend contract version and event types, validates conversation and turn ownership, rejects sequence gaps, deduplicates replayed events, resumes with `Last-Event-ID` and `afterSequence`, observes an idle timeout, and limits reconnect duration. Authentication failures and malformed protocol data fail closed rather than being retried.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Presentation lifecycle',
          anchor: 'assistant-6-presentation-lifecycle',
        },
        {
          kind: 'paragraph',
          text: 'The presentation reducer keeps each conversation in a separate immutable record. It projects streamed text, status, clarification, tool planning, confirmation, citations, usage, completion, cancellation, and failure while retaining the normalized raw events for later UI projections.',
        },
        {
          kind: 'paragraph',
          text: 'Duplicate and stale events are ignored. Sequence gaps fail the active presentation rather than silently rendering incomplete output. Events for another conversation or turn cannot mutate the active state. Resetting the scope removes all prior employee conversation state.',
        },
        {
          kind: 'paragraph',
          text: 'The React controller creates a conversation only when required, submits one turn at a time, streams its ordered events, and requests cancellation without prematurely closing the stream that carries the authoritative terminal event. It holds no provider credentials and does not reproduce backend validation.',
        },
        {
          kind: 'paragraph',
          text: 'On authenticated entry, the controller loads a bounded employee-owned conversation page. Selecting a conversation loads its durable turn/message and structured-interaction projection from `aiAssistant`; it does not reconstruct long-term history from short-lived SSE events. Clarification, tool state, safe usage, citations, and confirmation lifecycle therefore survive reload. Older conversation and turn pages are merged without changing chronological order or crossing enterprise and employee scope.',
        },
        {
          kind: 'paragraph',
          text: 'Backend error `code`, safe `message`, HTTP status, and optional `traceId` remain structured. Axis uses a generic fallback only when the backend supplies no safe response.',
        },
        {
          kind: 'paragraph',
          text: 'Archive conversation and a dedicated usage-summary screen are not yet implemented in Axis. The employee-owned summary endpoint belongs directly to `aiProviders`; Axis must discover and call that module rather than proxying through Assistant when that screen is added.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Accessibility and responsive behavior',
          anchor: 'assistant-7-accessibility-and-responsive-behavior',
        },
        {
          kind: 'unordered-list',
          items: [
            'The page and workspace use named regions and headings.',
            'Every CMS-provided action retains an accessible name.',
            'The layout remains single-column and bounded on desktop, tablet, mobile, and WebView widths.',
            'The activity region announces additions and text updates politely.',
            'Enter sends, Shift+Enter creates a new line, and buttons retain touch-safe targets.',
            'The timeline keeps a stable minimum height and follows new output without remounting existing messages.',
            'System reduced-motion preferences disable smooth scrolling and the streaming cursor animation through the shared Axis theme.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Failure and security behavior',
          anchor: 'assistant-8-failure-and-security-behavior',
        },
        {
          kind: 'unordered-list',
          items: [
            'Unauthenticated access redirects to the configured public page.',
            'A locked employee remains on the lock-screen flow.',
            'Missing capability contribution removes the Assistant shortcut.',
            '`UNAVAILABLE` and `UNKNOWN` disable the shortcut.',
            'Incompatible renderers use the existing safe render boundary.',
            'Malformed CMS properties fail inside the render boundary.',
            'Unsafe direct-module endpoints fail bootstrap parsing before a token is transmitted.',
            'Backend errors do not become frontend authorization decisions.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification',
          anchor: 'assistant-9-verification',
        },
        {
          kind: 'paragraph',
          text: 'Focused coverage includes:',
        },
        {
          kind: 'unordered-list',
          items: [
            'authenticated `/assistant` CMS delivery;',
            'renderer registry and contract versions;',
            'backend-driven labels and malformed properties;',
            'direct module URL and employee headers;',
            'fragmented SSE parsing and heartbeat handling;',
            'authenticated streaming, terminal closure, replay deduplication, and resume;',
            'cross-turn, sequence, contract, and payload-boundary rejection;',
            'immutable presentation event projection and terminal states;',
            'duplicate, stale, gap, and foreign-event handling;',
            'employee and enterprise query-key isolation;',
            'conversation creation, turn submission, overlap prevention, and controller cleanup;',
            'CMS-driven workspace copy, keyboard submission, streamed text, and cancellation controls;',
            'persisted multi-turn history, selection, new-conversation reset, and bounded pagination;',
            'idempotent turn submission;',
            'input bounds;',
            'stable error codes and trace IDs;',
            'unsafe endpoint and path rejection.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Run:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run verify',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Structured interactions',
          anchor: 'assistant-10-structured-interactions',
        },
        {
          kind: 'paragraph',
          text: 'Axis renders backend `CLARIFICATION`, `TOOL_PLAN`, and `CONFIRMATION_REQUIRED` events through separate feature components. All visible headings and action labels come from the authenticated Assistant CMS component. Axis does not reconstruct mutation arguments, target routes, authorization, or confirmation identity.',
        },
        {
          kind: 'paragraph',
          text: 'Approval and rejection return the backend-issued argument digest and optimistic revision. Rejection is available only before execution begins. Execution sends only the backend-issued confirmation code. Invalid event payloads fail closed; expired, stale, unauthorized, conflicting, and uncertain outcomes remain backend decisions and are shown through the normal safe error contract. The browser never retries an execution automatically.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Evidence and operational transparency',
          anchor: 'assistant-11-evidence-and-operational-transparency',
        },
        {
          kind: 'paragraph',
          text: 'The workspace renders the backend-issued tool lifecycle as prepared, running, succeeded, or failed. Only stable tool identity, owner module, operation identity, lifecycle state, and a safe failure code are displayed. Raw tool arguments, target URLs, credentials, and result content are neither projected nor rendered.',
        },
        {
          kind: 'paragraph',
          text: 'Citation cards display backend-issued identity, title, section, locator, and version. A title becomes a link only when AI Knowledge explicitly classifies it as `INTERNAL_ROUTE` and supplies a validated same-application path. Unclassified locators and rejected external or scheme-based values remain plain text. Axis validates the path again and never invents navigation from locator text.',
        },
        {
          kind: 'paragraph',
          text: 'Usage cards display the normalized input, output, cached-input, reasoning, and embedding token values plus reconciliation state. Reservation identifiers are discarded. Axis does not infer cost, quota, or remaining budget. `aiProviders` now exposes the separate direct, employee-owned `GET /operations/ai-ledger/usage/me` projection for a future budget-summary surface.',
        },
        {
          kind: 'paragraph',
          text: 'Malformed citation, usage, tool lifecycle, and reconciliation payloads fail closed through the same event-data boundary.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'assistant-12-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Add Assistant presentation through a new focused renderer under the Assistant feature, a typed logical-key registration, and bounded properties supplied by the owning CMS component. Add provider, tool, prompt, budget, knowledge, or business-operation behavior only in the appropriate Nodics AI or business module; Axis renders the provider-neutral events it receives.',
        },
        {
          kind: 'paragraph',
          text: 'Do not parse prompts into business commands, select providers in the browser, invent token balances, expose tool arguments, or call unregistered endpoints. Test the project extension with allowed and rejected renderer keys, contract versions, malformed SSE events, unauthorized tool proposals, confirmation revision changes, reconnection boundaries, keyboard and narrow-view behavior, and a production build. Removing the renderer registration is the safe frontend rollback; backend conversations and audit records remain owned by Nodics.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Known next boundary',
          anchor: 'assistant-13-known-next-boundary',
        },
        {
          kind: 'paragraph',
          text: 'Nodics now supports provider-neutral `CLARIFICATION` and `MUTATION_PROPOSAL` planning for confirmed enterprise creation. Axis consumes the resulting clarification and persisted-confirmation events through the existing renderers; it does not parse natural language into business fields.',
        },
        {
          kind: 'paragraph',
          text: "The next boundary is local end-to-end acceptance with a configured provider: request enterprise creation, answer missing fields, inspect the persisted confirmation, approve it, execute it, and verify Profile's result. This requires provider credentials and usage credit; deterministic contract tests remain the offline acceptance authority.",
        },
        {
          kind: 'paragraph',
          text: 'The offline backend acceptance now covers the full provider-neutral clarification, confirmation, approval, and Profile-dispatch boundary. Axis separately verifies rendering, digest/revision approval, execution controls, malformed-event rejection, accessibility, and responsive behavior. A live browser journey remains intentionally deferred until provider credentials and usage credit are configured.',
        },
      ],
      searchText:
        "Axis Assistant Frontend Learn the governed Assistant request flow, typed API contracts, resumable streaming, presentation lifecycle, evidence, accessibility, and security behavior. # Axis Assistant Frontend\n\n## Implemented scope\n\nAxis implements the authenticated `/assistant` CMS route, dedicated Assistant\npage/template/component renderer hierarchy, BackOffice-driven top navigation\nshortcut, validated direct-module connection projection, and a typed\nprovider-neutral Assistant HTTP client.\n\nThe workspace presents backend-owned CMS content, an interactive composer,\nemployee and Assistant message surfaces, smooth streamed text, progress\nfeedback, cancellation, and safe failure presentation. The authenticated SSE\ntransport and presentation state controller drive the visible experience.\nNo browser request is sent to OpenAI, Anthropic, Gemini, or another provider.\n\n## Authority and request flow\n\n1. BackOffice authenticated bootstrap advertises the authorized `aiAssistant`\n   capability, navigation entry, availability, and client-callable module\n   leases.\n2. Axis validates those values and selects only an `UP` or `DEGRADED`\n   connection. Credentials, query strings, fragments, and non-HTTP endpoints\n   are rejected.\n3. CMS authenticated delivery resolves `/assistant` for the configured Site,\n   locale, and channel.\n4. The CMS logical renderer keys map to allowlisted Axis-owned React\n   implementations.\n5. The typed Assistant client sends the employee bearer directly to the\n   discovered `aiAssistant` module endpoint.\n6. Nodics owns authorization, validation, persistence, provider selection,\n   token governance, tools, Workflow handoff, and audit.\n\nAxis does not proxy Assistant calls through BackOffice and does not select or\ncall an AI provider.\n\n## Source map\n\n- `src/bootstrap/publicBootstrap.ts`: authorized navigation and module\n  connection validation.\n- `src/cms/renderers/pages/AssistantPageRenderer.tsx`: Assistant page slot\n  composition.\n- `src/cms/renderers/templates/AssistantWorkspaceTemplateRenderer.tsx`:\n  responsive workspace structure.\n- `src/cms/renderers/components/assistant/AssistantWorkspaceRenderer.tsx`:\n  CMS-driven workspace composition.\n- `src/cms/renderers/components/assistant/AssistantMessageTimeline.tsx`:\n  stable, auto-following activity region.\n- `src/cms/renderers/components/assistant/AssistantMessageBubble.tsx`:\n  employee and Assistant text presentation.\n- `src/cms/renderers/components/assistant/AssistantStreamingStatus.tsx`:\n  accessible non-terminal progress.\n- `src/cms/renderers/components/assistant/AssistantComposer.tsx`: keyboard and\n  touch-friendly Send and Stop controls.\n- `src/cms/renderers/components/assistant/AssistantConversationHistory.tsx`:\n  responsive conversation selection and bounded pagination.\n- `src/assistant/api/assistantContracts.ts`: provider-neutral domain contracts.\n- `src/assistant/api/assistantContractParsers.ts`: untrusted response\n  validation.\n- `src/assistant/api/assistantTransport.ts`: shared authenticated HTTP\n  boundary.\n- `src/assistant/api/assistantClient.ts`: bounded Assistant commands.\n- `src/assistant/api/assistantSseParser.ts`: incremental, byte-bounded SSE\n  framing.\n- `src/assistant/api/assistantEventStream.ts`: authenticated event delivery,\n  ordering, resume, and reconnect.\n- `src/assistant/presentation/assistantPresentationContracts.ts`: UI-facing\n  state and action contracts.\n- `src/assistant/presentation/assistantPresentationReducer.ts`: pure,\n  deterministic event projection.\n- `src/assistant/presentation/assistantQueryKeys.ts`: enterprise, employee,\n  conversation, and turn cache isolation.\n- `src/assistant/presentation/useAssistantPresentation.ts`: lifecycle\n  composition for conversation creation, turn submission, streaming, and\n  cancellation.\n- `src/assistant/api/assistantError.ts`: stable backend error and correlation\n  projection.\n\n## CMS customization\n\nThe backend component properties currently control:\n\n- title;\n- welcome message;\n- composer placeholder;\n- send and stop labels;\n- empty-state text;\n- employee and Assistant speaker labels;\n- working, cancelling, and failure labels;\n- conversation history, new conversation, empty history, and load-more labels.\n\nChanging these properties in the authoritative CMS content changes Axis after\nthe next CMS delivery without rebuilding the frontend. Axis never accepts\nbackend JavaScript, component imports, event handlers, arbitrary HTML, or CSS.\n\nLocale and channel remain part of the CMS delivery request. Renderers must\ntolerate translated text expansion and future right-to-left content. Axis does\nnot translate by parsing English text.\n\n## Typed API coverage\n\nThe current client implements only backend routes that exist:\n\n- create, list, and retrieve employee-owned conversations;\n- submit and retrieve a turn;\n- replay persisted turn events;\n- cancel a turn;\n- create, retrieve, approve, and reject a mutation confirmation;\n- execute or hand off an approved confirmation.\n\nRequests use:\n\n- memory-only employee access token;\n- validated enterprise context;\n- bounded query values;\n- abort and timeout handling;\n- `Idempotency-Key` for turn and confirmation creation;\n- no browser credentials in URLs, logs, or storage.\n\nThe event stream additionally enforces the backend contract version and event\ntypes, validates conversation and turn ownership, rejects sequence gaps,\ndeduplicates replayed events, resumes with `Last-Event-ID` and\n`afterSequence`, observes an idle timeout, and limits reconnect duration.\nAuthentication failures and malformed protocol data fail closed rather than\nbeing retried.\n\n## Presentation lifecycle\n\nThe presentation reducer keeps each conversation in a separate immutable\nrecord. It projects streamed text, status, clarification, tool planning,\nconfirmation, citations, usage, completion, cancellation, and failure while\nretaining the normalized raw events for later UI projections.\n\nDuplicate and stale events are ignored. Sequence gaps fail the active\npresentation rather than silently rendering incomplete output. Events for\nanother conversation or turn cannot mutate the active state. Resetting the\nscope removes all prior employee conversation state.\n\nThe React controller creates a conversation only when required, submits one\nturn at a time, streams its ordered events, and requests cancellation without\nprematurely closing the stream that carries the authoritative terminal event.\nIt holds no provider credentials and does not reproduce backend validation.\n\nOn authenticated entry, the controller loads a bounded employee-owned\nconversation page. Selecting a conversation loads its durable turn/message and\nstructured-interaction projection from `aiAssistant`; it does not reconstruct\nlong-term history from short-lived SSE events. Clarification, tool state, safe\nusage, citations, and confirmation lifecycle therefore survive reload. Older\nconversation and turn pages are merged without changing chronological order or\ncrossing enterprise and employee scope.\n\nBackend error `code`, safe `message`, HTTP status, and optional `traceId` remain\nstructured. Axis uses a generic fallback only when the backend supplies no\nsafe response.\n\nArchive conversation and a dedicated usage-summary screen are not yet\nimplemented in Axis. The employee-owned summary endpoint belongs directly to\n`aiProviders`; Axis must discover and call that module rather than proxying\nthrough Assistant when that screen is added.\n\n## Accessibility and responsive behavior\n\n- The page and workspace use named regions and headings.\n- Every CMS-provided action retains an accessible name.\n- The layout remains single-column and bounded on desktop, tablet, mobile, and\n  WebView widths.\n- The activity region announces additions and text updates politely.\n- Enter sends, Shift+Enter creates a new line, and buttons retain touch-safe\n  targets.\n- The timeline keeps a stable minimum height and follows new output without\n  remounting existing messages.\n- System reduced-motion preferences disable smooth scrolling and the streaming\n  cursor animation through the shared Axis theme.\n\n## Failure and security behavior\n\n- Unauthenticated access redirects to the configured public page.\n- A locked employee remains on the lock-screen flow.\n- Missing capability contribution removes the Assistant shortcut.\n- `UNAVAILABLE` and `UNKNOWN` disable the shortcut.\n- Incompatible renderers use the existing safe render boundary.\n- Malformed CMS properties fail inside the render boundary.\n- Unsafe direct-module endpoints fail bootstrap parsing before a token is\n  transmitted.\n- Backend errors do not become frontend authorization decisions.\n\n## Verification\n\nFocused coverage includes:\n\n- authenticated `/assistant` CMS delivery;\n- renderer registry and contract versions;\n- backend-driven labels and malformed properties;\n- direct module URL and employee headers;\n- fragmented SSE parsing and heartbeat handling;\n- authenticated streaming, terminal closure, replay deduplication, and resume;\n- cross-turn, sequence, contract, and payload-boundary rejection;\n- immutable presentation event projection and terminal states;\n- duplicate, stale, gap, and foreign-event handling;\n- employee and enterprise query-key isolation;\n- conversation creation, turn submission, overlap prevention, and controller\n  cleanup;\n- CMS-driven workspace copy, keyboard submission, streamed text, and\n  cancellation controls;\n- persisted multi-turn history, selection, new-conversation reset, and bounded\n  pagination;\n- idempotent turn submission;\n- input bounds;\n- stable error codes and trace IDs;\n- unsafe endpoint and path rejection.\n\nRun:\n\n```bash\nnpm run verify\n```\n\n## Structured interactions\n\nAxis renders backend `CLARIFICATION`, `TOOL_PLAN`, and\n`CONFIRMATION_REQUIRED` events through separate feature components. All visible\nheadings and action labels come from the authenticated Assistant CMS component.\nAxis does not reconstruct mutation arguments, target routes, authorization, or\nconfirmation identity.\n\nApproval and rejection return the backend-issued argument digest and\noptimistic revision. Rejection is available only before execution begins.\nExecution sends only the backend-issued confirmation code. Invalid event\npayloads fail closed; expired, stale, unauthorized, conflicting, and uncertain\noutcomes remain backend decisions and are shown through the normal safe error\ncontract. The browser never retries an execution automatically.\n\n## Evidence and operational transparency\n\nThe workspace renders the backend-issued tool lifecycle as prepared, running,\nsucceeded, or failed. Only stable tool identity, owner module, operation\nidentity, lifecycle state, and a safe failure code are displayed. Raw tool\narguments, target URLs, credentials, and result content are neither projected\nnor rendered.\n\nCitation cards display backend-issued identity, title, section, locator, and\nversion. A title becomes a link only when AI Knowledge explicitly classifies\nit as `INTERNAL_ROUTE` and supplies a validated same-application path.\nUnclassified locators and rejected external or scheme-based values remain\nplain text. Axis validates the path again and never invents navigation from\nlocator text.\n\nUsage cards display the normalized input, output, cached-input, reasoning, and\nembedding token values plus reconciliation state. Reservation identifiers are\ndiscarded. Axis does not infer cost, quota, or remaining budget. `aiProviders`\nnow exposes the separate direct, employee-owned\n`GET /operations/ai-ledger/usage/me` projection for a future budget-summary\nsurface.\n\nMalformed citation, usage, tool lifecycle, and reconciliation payloads fail\nclosed through the same event-data boundary.\n\n## Customize and extend safely\n\nAdd Assistant presentation through a new focused renderer under the Assistant\nfeature, a typed logical-key registration, and bounded properties supplied by\nthe owning CMS component. Add provider, tool, prompt, budget, knowledge, or\nbusiness-operation behavior only in the appropriate Nodics AI or business\nmodule; Axis renders the provider-neutral events it receives.\n\nDo not parse prompts into business commands, select providers in the browser,\ninvent token balances, expose tool arguments, or call unregistered endpoints.\nTest the project extension with allowed and rejected renderer keys, contract\nversions, malformed SSE events, unauthorized tool proposals, confirmation\nrevision changes, reconnection boundaries, keyboard and narrow-view behavior,\nand a production build. Removing the renderer registration is the safe\nfrontend rollback; backend conversations and audit records remain owned by\nNodics.\n\n## Known next boundary\n\nNodics now supports provider-neutral `CLARIFICATION` and\n`MUTATION_PROPOSAL` planning for confirmed enterprise creation. Axis consumes\nthe resulting clarification and persisted-confirmation events through the\nexisting renderers; it does not parse natural language into business fields.\n\nThe next boundary is local end-to-end acceptance with a configured provider:\nrequest enterprise creation, answer missing fields, inspect the persisted\nconfirmation, approve it, execute it, and verify Profile's result. This requires\nprovider credentials and usage credit; deterministic contract tests remain the\noffline acceptance authority.\n\nThe offline backend acceptance now covers the full provider-neutral\nclarification, confirmation, approval, and Profile-dispatch boundary. Axis\nseparately verifies rendering, digest/revision approval, execution controls,\nmalformed-event rejection, accessibility, and responsive behavior. A live\nbrowser journey remains intentionally deferred until provider credentials and\nusage credit are configured.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/assistant-frontend.md',
        evidence: 'docs/assistant-frontend.md',
        hash: '4b5f2628a6a7b3e6561fef37e68c4001f02a8385700174ffd36fb293b46b2604',
        version: '0.3.19',
      },
      previous: {
        title: 'Employee Login, Recovery, Lock, and Dashboard',
        route: '/docs/nodics-axis/employee-access',
      },
      next: {
        title: 'Axis Schema Workbench',
        route: '/docs/nodics-axis/schema-workbench',
      },
    },
    active: true,
  },
  record9: {
    code: 'axisDocsComponentschemaworkbench',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.schema-workbench',
      title: 'Axis Schema Workbench',
      route: '/docs/nodics-axis/schema-workbench',
      section: 'axis-capabilities',
      sectionTitle: 'Axis Capabilities',
      category: 'Axis Capabilities',
      audience: ['business-user', 'administrator', 'developer', 'operator'],
      summary:
        'Use and extend governed schema discovery, record operations, relationship coordination, failure recovery, responsive behavior, and verification.',
      headings: [
        {
          text: 'Implemented frontend behavior',
          anchor: 'schema-workbench-1-implemented-frontend-behavior',
          level: 2,
        },
        {
          text: 'Request ownership',
          anchor: 'schema-workbench-2-request-ownership',
          level: 2,
        },
        {
          text: 'Successful behavior',
          anchor: 'schema-workbench-3-successful-behavior',
          level: 2,
        },
        {
          text: 'Unauthorized or invalid behavior',
          anchor: 'schema-workbench-4-unauthorized-or-invalid-behavior',
          level: 2,
        },
        {
          text: 'Boundary and responsive behavior',
          anchor: 'schema-workbench-5-boundary-and-responsive-behavior',
          level: 2,
        },
        {
          text: 'Failure and recovery',
          anchor: 'schema-workbench-6-failure-and-recovery',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'schema-workbench-7-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Notifications & Messaging workspace',
          anchor: 'schema-workbench-8-notifications-messaging-workspace',
          level: 2,
        },
        {
          text: 'Compliance Management workspace',
          anchor: 'schema-workbench-9-compliance-management-workspace',
          level: 2,
        },
        {
          text: 'Verification',
          anchor: 'schema-workbench-10-verification',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Axis implements the presentation side of Nodics Schema Workbench. The owning backend module remains authoritative for schemas, allowed operations, relationships, generated CRUD, domain operations, validation, permissions, tenant isolation, and persistence.',
        },
        {
          kind: 'paragraph',
          text: 'Business-user and backend customization guidance is maintained in the Nodics documentation:',
        },
        {
          kind: 'unordered-list',
          items: [
            '`gDocs/backoffice/how-schema-workbench-works.md`',
            '`gFramework/nDatabase/database/README.md`',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Implemented frontend behavior',
          anchor: 'schema-workbench-1-implemented-frontend-behavior',
        },
        {
          kind: 'paragraph',
          text: 'The authenticated `/schema-workbench` route:',
        },
        {
          kind: 'unordered-list',
          items: [
            'appears only when BackOffice advertises its authorized navigation item;',
            'resolves its page, template, renderer keys, and visible copy through CMS;',
            'discovers active module endpoints through authenticated BackOffice bootstrap;',
            'requests safe Workbench descriptors directly from those modules;',
            'lists and filters authorized data types by readable label or module;',
            'loads bounded record pages through an owning-module Workbench query that delegates to existing generated CRUD services;',
            'searches the full authorized result set across descriptor-advertised safe text fields rather than filtering only the current browser page;',
            'uses the shared Axis Schema Query Builder for browsing, export preview, and any future schema-backed data retrieval screen so employees learn one consistent query experience;',
            'sorts only by descriptor-advertised scalar fields and default sort metadata;',
            'builds typed filters only from descriptor-advertised fields and operators;',
            'supports bounded nested `AND`/`OR` groups with an inert JSON request preview;',
            'keeps filter edits as a local draft until the employee applies them;',
            'offers only backend-configured page sizes and shows the authoritative total;',
            'cancels obsolete in-flight record requests when query state changes;',
            'renders primary and searchable fields in a responsive record table;',
            'stores employee/tenant/enterprise-scoped favourites, recents, visible columns, and up to ten saved views in bounded browser storage without storing records or access tokens;',
            'supports current-page row selection and exposes bulk deletion only when the owning descriptor explicitly advertises it;',
            'requests a governed delete-impact preview before enabling final deletion;',
            'consumes backend concurrency and aggregate-operation metadata without inventing browser-side business authority;',
            'opens a complete permitted record detail view from the record table;',
            'renders schema-declared reference values through one shared reference renderer used by record details, schema listing tables, and navigation-scoped schema workspaces;',
            'keeps the selected parent record visible when a related record is opened, and renders the related record detail below the current record instead of redirecting to another schema workspace;',
            'opens related values from both single-value and multi-value relationship fields, including list-valued references displayed in schema table columns;',
            'shows Edit only when the owning descriptor advertises Update;',
            'initializes Update from the selected record while excluding managed and read-only fields from the mutation model;',
            'sends a bounded generated Update request using the original primary identity, an editable model, and `returnModified`;',
            'refreshes the record list and detail view only after the owning module confirms the update;',
            'shows Delete only when the owning descriptor advertises it;',
            'requires a modal confirmation showing record identity, authenticated tenant, and enterprise;',
            'sends one bounded Delete query using the original primary identity;',
            'disables confirmation and cancellation while deletion is pending;',
            'keeps the record and confirmation available when authorization, ownership, reference integrity, or another backend business rule rejects deletion;',
            'displays only the bounded backend error code/message contract and never renders diagnostic contexts, records, queries, or stacks;',
            'closes record details and refreshes the list only after confirmed deletion;',
            'supports reusable feature handoff links using `/schema-workbench?module=<moduleName>&schema=<schemaName>` to select an authorized schema after discovery;',
            'renders WCMS and publishing management routes such as `/content/pages` and `/publishing/requests` from BackOffice navigation `workbenchTarget` metadata rather than frontend-owned route-to-schema maps;',
            'renders those navigation-scoped routes as focused schema workspaces, hiding the global data-type browser so a selected item such as Websites, Pages, or Publishing Requests shows only its own records, detail, create, update, and governed delete interactions;',
            'renders route-scoped business help from BackOffice navigation `help` metadata, including a short summary tooltip and a documentation link that opens the configured Axis documentation route in a new browser tab;',
            'renders permission-filtered, state-aware lifecycle actions declared by the owning backend module, including bounded text, select, hidden/default, and JSON input descriptors in one reusable action dialog;',
            'resolves an action against its declared owner-module connection, substitutes only record/input route parameters, sends one idempotent backend request, and refreshes server state after success; Axis never coordinates owner writes;',
            'uses the shared Axis listing interaction pattern: employees select a row from the records table and Axis renders the selected record detail below the list, instead of adding a one-action View column or moving detail above the table;',
            'preserves the authenticated shell hierarchy from BackOffice navigation and lets any parent navigation item with children expand or collapse its children independently of the top-level navigation group;',
            'supports `/schema-workbench?module=<moduleName>&schema=<schemaName>&mode=create` only when the discovered schema advertises Create, so feature pages can hand users to generic generated CRUD without duplicating record forms;',
            'renders one typed field component per supported schema field type;',
            'creates independent Address and Contact records through generated CRUD;',
            'renders schema-declared relationship fields separately from ordinary arrays;',
            'renders each relationship using its backend-declared business role, so references to the same target type remain distinguishable;',
            'combines backend-declared display properties in their configured order so selectors show meaningful identities instead of only opaque record keys;',
            'presents related records as `code - description`, truncating descriptions longer than five words to the first five words followed by `...`;',
            'exposes the complete description in a tooltip on pointer hover or keyboard focus, including descriptions displayed without truncation;',
            "selects existing related records through the target module's generated read contract;",
            'holds new related records as in-memory drafts until the parent is submitted;',
            'creates drafted related records through their owning module and associates only the returned reference property;',
            'replaces a one-to-one pending related draft when the employee chooses an existing related record for the same relationship, so parent save does not create an unused child record;',
            'prevents duplicate references in a multi-value relationship;',
            'bounds nested related creation by backend-advertised depth and stops cycles by falling back to selecting an existing record;',
            'offers inline related-record editing only when both relationship metadata advertises `EDIT_RELATED` and the target schema advertises Update;',
            'retains each successfully created related reference when a later related operation or parent save fails, so retry does not recreate that record;',
            'keeps unsaved drafts in component memory;',
            'blocks visibly incomplete required fields before submission while preserving backend validation as authoritative;',
            'formats dates with locale-aware browser APIs and renders booleans with CMS-provided user-facing labels;',
            'exposes loading, empty, unavailable, and retry states.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Every backend model that is authorized and not explicitly excluded is discoverable with generated Search, Read, Create, Update, and governed Delete operations. An owning schema may narrow that list. Address and Contact also demonstrate the Address-to-Contact relationship editor.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Request ownership',
          anchor: 'schema-workbench-2-request-ownership',
        },
        {
          kind: 'code',
          language: 'text',
          text: 'Axis → BackOffice: authorized navigation and module endpoints\nAxis → CMS: Workbench page composition and presentation copy\nAxis → owning module: schema descriptors, generated reads, and authorized writes',
        },
        {
          kind: 'paragraph',
          text: 'Axis does not send schema operations through BackOffice and does not maintain its own module registry. Access tokens remain in memory and are sent only in the Authorization header. Enterprise context is sent in `x-enterprise-code`.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Successful behavior',
          anchor: 'schema-workbench-3-successful-behavior',
        },
        {
          kind: 'paragraph',
          text: 'An authorized employee opens Schema Workbench, selects Address, and sees the first bounded page of Address records using labels supplied by the effective Profile schema. The employee can open Create Address, complete required fields, select an existing Contact or add a new Contact draft, and submit the complete draft directly to Profile.',
        },
        {
          kind: 'paragraph',
          text: "For Update, the employee selects a record row, chooses **Edit** when permitted, changes ordinary fields or relationship references, and submits. Axis uses the original primary identity as the update query even when the editable primary field changes. When the descriptor advertises required optimistic concurrency, the query also carries the record's advertised revision. Update and Delete fail closed before sending a request if that required revision is unavailable.",
        },
        {
          kind: 'paragraph',
          text: 'For Delete, the employee opens the record, chooses **Delete**, verifies the record, tenant, and enterprise shown in the confirmation, and explicitly confirms. Axis never cascades deletion and never treats a frontend permission check as final authority.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Unauthorized or invalid behavior',
          anchor: 'schema-workbench-4-unauthorized-or-invalid-behavior',
        },
        {
          kind: 'paragraph',
          text: 'The route is unavailable when BackOffice does not advertise it. Modules omit schemas and operations that the employee cannot access. Malformed descriptors, unsupported operations, unsafe endpoints, invalid envelopes, and malformed records fail validation rather than being rendered. A relationship cannot create a target schema unless that descriptor advertises Create.',
        },
        {
          kind: 'paragraph',
          text: 'Axis does not infer optimistic concurrency from timestamps. It sends an effective revision only when the backend descriptor advertises a compare-and- set field. Axis must never simulate stale-write protection in browser state.',
        },
        {
          kind: 'paragraph',
          text: 'Delete rejection leaves the confirmation open with the safe backend message. Axis does not hide a reference-integrity failure, retry automatically, or delete related records as compensation.',
        },
        {
          kind: 'paragraph',
          text: 'The HTTP client accepts only a bounded top-level backend message and code for display. Structured diagnostic contexts and stacks are deliberately ignored. Malformed or non-JSON failures use a generic HTTP fallback. Translation must use stable backend codes and CMS presentation content rather than parsing an English message.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Boundary and responsive behavior',
          anchor: 'schema-workbench-5-boundary-and-responsive-behavior',
        },
        {
          kind: 'paragraph',
          text: 'At large widths, the global `/schema-workbench` route uses data-type navigation and records in two columns. Navigation-scoped workspaces such as `/content/sites` use a focused one-column record workspace because the selected BackOffice menu item already supplies the schema context. At smaller widths they stack into one column. Record columns remain horizontally scrollable instead of shrinking into unreadable content. Controls retain labels, keyboard operation, and semantic list/table roles.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Failure and recovery',
          anchor: 'schema-workbench-6-failure-and-recovery',
        },
        {
          kind: 'paragraph',
          text: 'One unavailable module does not hide descriptors successfully returned by other active modules. If every discovery request fails, Axis shows a safe retryable error. Record loading failures remain scoped to the selected schema and can be retried without reloading the application.',
        },
        {
          kind: 'paragraph',
          text: 'Workbench does not claim a browser-side or cross-module database transaction. Related records are created sequentially during final submission. After each successful related creation, Axis replaces that local draft with the returned reference. If a later related creation or the parent save fails, the form stays open and the successful reference remains selected. Retrying therefore resumes from the failed step instead of creating the successful record again.',
        },
        {
          kind: 'paragraph',
          text: 'For one-to-one relationships, selecting an existing target record clears any pending create draft for that relationship before submission. This keeps the frontend draft aligned with the backend `refSchema` contract: the parent stores only the selected reference value, and the owning module remains responsible for validating whether that reference is allowed.',
        },
        {
          kind: 'paragraph',
          text: 'This recovery model avoids hidden deletion and unsafe compensation. It does not guarantee atomic commit across modules. Journeys that require strict atomicity must use a backend-owned domain operation or a transaction-capable workflow, not generic Workbench coordination.',
        },
        {
          kind: 'paragraph',
          text: 'Lifecycle action forms keep entered evidence open after a safe backend failure so the employee can correct or retry it. JSON descriptors are parsed only as request data; they never execute code. Backend authorization, optimistic versions, maker-checker rules, Workflow decisions, Pipelines, owner adapters, and audit remain authoritative even when Axis hides an inapplicable action.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'schema-workbench-7-customize-and-extend-safely',
        },
        {
          kind: 'unordered-list',
          items: [
            'Change page copy and composition through `axisContentCatalog`.',
            'Change available schemas, fields, relationships, and operations in the owning Nodics module.',
            'Change module availability through Nodics runtime topology and BackOffice registration.',
            'Extend Axis with one typed renderer per new CMS component contract.',
            'Reuse shared interaction components when the same behavior appears on more than one page. The Schema Query Builder is a generic workbench capability, not a private Schema Workbench widget. If another page needs schema search, filtering, sorting, grouping, or preview behavior, compose the shared query builder and feed it backend-advertised capabilities instead of creating a local query form.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Do not add hardcoded module endpoints, backend rules, translated business copy, or alternate schema definitions to Axis.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Notifications & Messaging workspace',
          anchor: 'schema-workbench-8-notifications-messaging-workspace',
        },
        {
          kind: 'paragraph',
          text: 'When the backend advertises the `notifications-messaging` capability, Axis uses the same authenticated navigation and Schema Workbench contracts to expose Templates, Scenarios, Channels, Message Types, Providers, Provider Accounts, Delivery Logs, Attempts, Suppressions, Verification, and In-App Inbox. Axis does not contain a notification catalogue, provider list, consent rule, template lifecycle, OTP value, or delivery policy. Removing the backend capability or employee permission removes the workspace.',
        },
        {
          kind: 'paragraph',
          text: 'Business users may traverse Channel -> Scenario -> Template or Scenario -> Channel -> Template using backend-advertised schema filters and relationships. Template preview and lifecycle operations execute only backend-declared secured routes. Real OTPs, provider credentials, raw destinations, raw provider payloads, and diagnostic stacks must never enter Axis records, browser storage, telemetry, or preview state. Provider-account forms accept secret references only.',
        },
        {
          kind: 'paragraph',
          text: 'Customer projects customize this surface by contributing higher-layer Nodics schemas, capability navigation, presentation metadata, lifecycle actions, permissions, and CMS help. Add Axis code only for a genuinely new reusable presentation contract; do not fork a channel-specific editor or duplicate backend policy. Successful, denied, suppressed, retry/recovery, maker-checker, narrow-screen, keyboard, and partial-discovery behavior remains protected by the generic Workbench and bootstrap suites.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Compliance Management workspace',
          anchor: 'schema-workbench-9-compliance-management-workspace',
        },
        {
          kind: 'paragraph',
          text: 'When the backend advertises `compliance-management`, Axis creates one dedicated Compliance Management section from the authenticated bootstrap. Compliance capabilities attach their pages to that backend-owned parent instead of creating separate consoles. The KYC capability currently contributes KYC Cases, Review Queue, Subject Status, Document Review, Policies and Requirements, Providers, and Compliance Audit; each page binds to its backend-advertised KYC schema. Future AML, sanctions, due-diligence, monitoring, or reporting modules must contribute sibling pages through the same contract.',
        },
        {
          kind: 'paragraph',
          text: 'Axis does not maintain the compliance catalogue. Removing the shared backend capability, a child capability, or an employee permission removes the relevant section, page, or action after authenticated bootstrap. Configuration and operational processes remain backend-owned even though authorized business users manage them from this one Axis section.',
        },
        {
          kind: 'paragraph',
          text: 'The route-scoped Workbench hides the global schema picker, paginates and filters through KYC-owned APIs, and renders only fields, relations, panels, and actions allowed by the effective contract.',
        },
        {
          kind: 'paragraph',
          text: 'Case actions are not generic record edits. Approve, reject, escalate, and request-more-information controls come from backend lifecycle metadata and call the secured KYC intent route. Axis collects bounded reason inputs and supplies record identity/idempotency context; KYC rechecks authorization, scope, state, version, maker-checker, policy, Workflow, persistence, and audit. Removing a permission or capability removes the corresponding route/action after the next authenticated bootstrap.',
        },
        {
          kind: 'paragraph',
          text: 'Document Review shows masked metadata and nMedia codes only. Preview/download must use an advertised purpose-bound nMedia action and be backend-audited. Axis never turns a media code, provider reference, storage key, path, private URL, or schema value into a browser URL. Providers show readiness and a related execution-policy panel; credentials, webhook keys, raw payloads, OCR, biometrics, and full identity values never enter browser state, telemetry, URLs, or preferences.',
        },
        {
          kind: 'paragraph',
          text: 'On narrow screens and WebViews, panels stack, controls remain keyboard reachable, tables retain accessible labels, and high-risk actions keep explicit confirmation. A backend rejection, stale state, provider outage, or network failure leaves the record unchanged and shows only the safe code/message so the employee can refresh, retry when allowed, or escalate.',
        },
        {
          kind: 'paragraph',
          text: 'Customer projects customize KYC through later backend modules: policy, requirements, provider adapters, schemas, presentation metadata, lifecycle actions, permissions, and help. The smallest Axis customization is a project-owned typed renderer that composes existing Workbench primitives for a genuinely new presentation need. It must preserve KYC, nMedia, and Workflow authority and must not fork a KYC editor, provider registry, lifecycle, authorization rule, document viewer, or navigation catalogue. Removing the later renderer or metadata contribution rolls back presentation without mutating KYC evidence.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification',
          anchor: 'schema-workbench-10-verification',
        },
        {
          kind: 'paragraph',
          text: 'Run:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run verify',
        },
        {
          kind: 'paragraph',
          text: 'Focused tests cover direct-module headers and paths, bounded record reads, creates and updates, original-identity update queries, descriptor validation, bounded original-identity deletion, missing-identity rejection, explicit confirmation, pending duplicate-submit prevention, authenticated tenant parsing, partial discovery, retryable failure, schema selection, record rendering, record selection, CMS renderer registration, required-field validation, default values, framework-managed field exclusion, selecting an existing relationship, related-record creation, duplicate-reference prevention, retry without duplicate related creation, backend conflict-message handling, diagnostic-context exclusion, malformed-error fallback, and locale-aware record formatting. Coverage also includes backend-declared lifecycle action inputs, JSON parsing, owner-module routing, safe route substitution, stable idempotency, and route-scoped schema workspaces that hide the global schema browser, nested shell navigation expansion and collapse, revision forwarding for Update and Delete, missing-revision rejection before network access, self-referential relationship cycle fallback, bounded nested relationship depth, full description tooltips, five-word related-record summaries, shared clickable reference rendering in details and tables, inline related-record details that preserve parent context, clearing stale one-to-one pending drafts when selecting an existing target, and preserving remaining one-to-many references when another selected reference is removed.',
        },
        {
          kind: 'paragraph',
          text: 'The authenticated local acceptance journey additionally verifies schema discovery across active modules, bounded search, unauthenticated rejection, raw-query rejection, advertised Create/Update/Delete visibility, readable Enterprise relationship labels, and `code - description` Tenant choices. The journey is read-only: it opens forms and selectors but does not submit a business-data mutation.',
        },
      ],
      searchText:
        "Axis Schema Workbench Use and extend governed schema discovery, record operations, relationship coordination, failure recovery, responsive behavior, and verification. # Axis Schema Workbench\n\nAxis implements the presentation side of Nodics Schema Workbench. The owning\nbackend module remains authoritative for schemas, allowed operations,\nrelationships, generated CRUD, domain operations, validation, permissions,\ntenant isolation, and persistence.\n\nBusiness-user and backend customization guidance is maintained in the Nodics\ndocumentation:\n\n- `gDocs/backoffice/how-schema-workbench-works.md`\n- `gFramework/nDatabase/database/README.md`\n\n## Implemented frontend behavior\n\nThe authenticated `/schema-workbench` route:\n\n- appears only when BackOffice advertises its authorized navigation item;\n- resolves its page, template, renderer keys, and visible copy through CMS;\n- discovers active module endpoints through authenticated BackOffice bootstrap;\n- requests safe Workbench descriptors directly from those modules;\n- lists and filters authorized data types by readable label or module;\n- loads bounded record pages through an owning-module Workbench query that\n  delegates to existing generated CRUD services;\n- searches the full authorized result set across descriptor-advertised safe\n  text fields rather than filtering only the current browser page;\n- uses the shared Axis Schema Query Builder for browsing, export preview, and\n  any future schema-backed data retrieval screen so employees learn one\n  consistent query experience;\n- sorts only by descriptor-advertised scalar fields and default sort metadata;\n- builds typed filters only from descriptor-advertised fields and operators;\n- supports bounded nested `AND`/`OR` groups with an inert JSON request preview;\n- keeps filter edits as a local draft until the employee applies them;\n- offers only backend-configured page sizes and shows the authoritative total;\n- cancels obsolete in-flight record requests when query state changes;\n- renders primary and searchable fields in a responsive record table;\n- stores employee/tenant/enterprise-scoped favourites, recents, visible\n  columns, and up to ten saved views in bounded browser storage without\n  storing records or access tokens;\n- supports current-page row selection and exposes bulk deletion only when the\n  owning descriptor explicitly advertises it;\n- requests a governed delete-impact preview before enabling final deletion;\n- consumes backend concurrency and aggregate-operation metadata without\n  inventing browser-side business authority;\n- opens a complete permitted record detail view from the record table;\n- renders schema-declared reference values through one shared reference\n  renderer used by record details, schema listing tables, and\n  navigation-scoped schema workspaces;\n- keeps the selected parent record visible when a related record is opened, and\n  renders the related record detail below the current record instead of\n  redirecting to another schema workspace;\n- opens related values from both single-value and multi-value relationship\n  fields, including list-valued references displayed in schema table columns;\n- shows Edit only when the owning descriptor advertises Update;\n- initializes Update from the selected record while excluding managed and\n  read-only fields from the mutation model;\n- sends a bounded generated Update request using the original primary identity,\n  an editable model, and `returnModified`;\n- refreshes the record list and detail view only after the owning module\n  confirms the update;\n- shows Delete only when the owning descriptor advertises it;\n- requires a modal confirmation showing record identity, authenticated tenant,\n  and enterprise;\n- sends one bounded Delete query using the original primary identity;\n- disables confirmation and cancellation while deletion is pending;\n- keeps the record and confirmation available when authorization, ownership,\n  reference integrity, or another backend business rule rejects deletion;\n- displays only the bounded backend error code/message contract and never\n  renders diagnostic contexts, records, queries, or stacks;\n- closes record details and refreshes the list only after confirmed deletion;\n- supports reusable feature handoff links using\n  `/schema-workbench?module=<moduleName>&schema=<schemaName>` to select an\n  authorized schema after discovery;\n- renders WCMS and publishing management routes such as `/content/pages` and\n  `/publishing/requests` from BackOffice navigation `workbenchTarget` metadata\n  rather than frontend-owned route-to-schema maps;\n- renders those navigation-scoped routes as focused schema workspaces, hiding\n  the global data-type browser so a selected item such as Websites, Pages, or\n  Publishing Requests shows only its own records, detail, create, update, and\n  governed delete interactions;\n- renders route-scoped business help from BackOffice navigation `help`\n  metadata, including a short summary tooltip and a documentation link that\n  opens the configured Axis documentation route in a new browser tab;\n- renders permission-filtered, state-aware lifecycle actions declared by the\n  owning backend module, including bounded text, select, hidden/default, and\n  JSON input descriptors in one reusable action dialog;\n- resolves an action against its declared owner-module connection, substitutes\n  only record/input route parameters, sends one idempotent backend request, and\n  refreshes server state after success; Axis never coordinates owner writes;\n- uses the shared Axis listing interaction pattern: employees select a row\n  from the records table and Axis renders the selected record detail below the\n  list, instead of adding a one-action View column or moving detail above the\n  table;\n- preserves the authenticated shell hierarchy from BackOffice navigation and\n  lets any parent navigation item with children expand or collapse its children\n  independently of the top-level navigation group;\n- supports `/schema-workbench?module=<moduleName>&schema=<schemaName>&mode=create`\n  only when the discovered schema advertises Create, so feature pages can hand\n  users to generic generated CRUD without duplicating record forms;\n- renders one typed field component per supported schema field type;\n- creates independent Address and Contact records through generated CRUD;\n- renders schema-declared relationship fields separately from ordinary arrays;\n- renders each relationship using its backend-declared business role, so\n  references to the same target type remain distinguishable;\n- combines backend-declared display properties in their configured order so\n  selectors show meaningful identities instead of only opaque record keys;\n- presents related records as `code - description`, truncating descriptions\n  longer than five words to the first five words followed by `...`;\n- exposes the complete description in a tooltip on pointer hover or keyboard\n  focus, including descriptions displayed without truncation;\n- selects existing related records through the target module's generated read\n  contract;\n- holds new related records as in-memory drafts until the parent is submitted;\n- creates drafted related records through their owning module and associates\n  only the returned reference property;\n- replaces a one-to-one pending related draft when the employee chooses an\n  existing related record for the same relationship, so parent save does not\n  create an unused child record;\n- prevents duplicate references in a multi-value relationship;\n- bounds nested related creation by backend-advertised depth and stops cycles\n  by falling back to selecting an existing record;\n- offers inline related-record editing only when both relationship metadata\n  advertises `EDIT_RELATED` and the target schema advertises Update;\n- retains each successfully created related reference when a later related\n  operation or parent save fails, so retry does not recreate that record;\n- keeps unsaved drafts in component memory;\n- blocks visibly incomplete required fields before submission while preserving\n  backend validation as authoritative;\n- formats dates with locale-aware browser APIs and renders booleans with\n  CMS-provided user-facing labels;\n- exposes loading, empty, unavailable, and retry states.\n\nEvery backend model that is authorized and not explicitly excluded is\ndiscoverable with generated Search, Read, Create, Update, and governed Delete\noperations. An owning schema may narrow that list. Address and Contact also\ndemonstrate the Address-to-Contact relationship editor.\n\n## Request ownership\n\n```text\nAxis → BackOffice: authorized navigation and module endpoints\nAxis → CMS: Workbench page composition and presentation copy\nAxis → owning module: schema descriptors, generated reads, and authorized writes\n```\n\nAxis does not send schema operations through BackOffice and does not maintain\nits own module registry. Access tokens remain in memory and are sent only in\nthe Authorization header. Enterprise context is sent in\n`x-enterprise-code`.\n\n## Successful behavior\n\nAn authorized employee opens Schema Workbench, selects Address, and sees the\nfirst bounded page of Address records using labels supplied by the effective\nProfile schema. The employee can open Create Address, complete required fields,\nselect an existing Contact or add a new Contact draft, and submit the complete\ndraft directly to Profile.\n\nFor Update, the employee selects a record row, chooses **Edit** when\npermitted, changes ordinary fields or relationship references, and submits.\nAxis uses the original primary identity as the update query even when the\neditable primary field changes. When the descriptor advertises required\noptimistic concurrency, the query also carries the record's advertised\nrevision. Update and Delete fail closed before sending a request if that\nrequired revision is unavailable.\n\nFor Delete, the employee opens the record, chooses **Delete**, verifies the\nrecord, tenant, and enterprise shown in the confirmation, and explicitly\nconfirms. Axis never cascades deletion and never treats a frontend permission\ncheck as final authority.\n\n## Unauthorized or invalid behavior\n\nThe route is unavailable when BackOffice does not advertise it. Modules omit\nschemas and operations that the employee cannot access. Malformed descriptors,\nunsupported operations, unsafe endpoints, invalid envelopes, and malformed\nrecords fail validation rather than being rendered. A relationship cannot\ncreate a target schema unless that descriptor advertises Create.\n\nAxis does not infer optimistic concurrency from timestamps. It sends an\neffective revision only when the backend descriptor advertises a compare-and-\nset field. Axis must never simulate stale-write protection in browser state.\n\nDelete rejection leaves the confirmation open with the safe backend message.\nAxis does not hide a reference-integrity failure, retry automatically, or\ndelete related records as compensation.\n\nThe HTTP client accepts only a bounded top-level backend message and code for\ndisplay. Structured diagnostic contexts and stacks are deliberately ignored.\nMalformed or non-JSON failures use a generic HTTP fallback. Translation must\nuse stable backend codes and CMS presentation content rather than parsing an\nEnglish message.\n\n## Boundary and responsive behavior\n\nAt large widths, the global `/schema-workbench` route uses data-type\nnavigation and records in two columns. Navigation-scoped workspaces such as\n`/content/sites` use a focused one-column record workspace because the selected\nBackOffice menu item already supplies the schema context. At smaller widths\nthey stack into one column. Record columns remain horizontally scrollable\ninstead of shrinking into unreadable content. Controls retain labels, keyboard\noperation, and semantic list/table roles.\n\n## Failure and recovery\n\nOne unavailable module does not hide descriptors successfully returned by\nother active modules. If every discovery request fails, Axis shows a safe\nretryable error. Record loading failures remain scoped to the selected schema\nand can be retried without reloading the application.\n\nWorkbench does not claim a browser-side or cross-module database transaction.\nRelated records are created sequentially during final submission. After each\nsuccessful related creation, Axis replaces that local draft with the returned\nreference. If a later related creation or the parent save fails, the form stays\nopen and the successful reference remains selected. Retrying therefore resumes\nfrom the failed step instead of creating the successful record again.\n\nFor one-to-one relationships, selecting an existing target record clears any\npending create draft for that relationship before submission. This keeps the\nfrontend draft aligned with the backend `refSchema` contract: the parent stores\nonly the selected reference value, and the owning module remains responsible for\nvalidating whether that reference is allowed.\n\nThis recovery model avoids hidden deletion and unsafe compensation. It does not\nguarantee atomic commit across modules. Journeys that require strict atomicity\nmust use a backend-owned domain operation or a transaction-capable workflow,\nnot generic Workbench coordination.\n\nLifecycle action forms keep entered evidence open after a safe backend failure\nso the employee can correct or retry it. JSON descriptors are parsed only as\nrequest data; they never execute code. Backend authorization, optimistic\nversions, maker-checker rules, Workflow decisions, Pipelines, owner adapters,\nand audit remain authoritative even when Axis hides an inapplicable action.\n\n## Customize and extend safely\n\n- Change page copy and composition through `axisContentCatalog`.\n- Change available schemas, fields, relationships, and operations in the\n  owning Nodics module.\n- Change module availability through Nodics runtime topology and BackOffice\n  registration.\n- Extend Axis with one typed renderer per new CMS component contract.\n- Reuse shared interaction components when the same behavior appears on more\n  than one page. The Schema Query Builder is a generic workbench capability,\n  not a private Schema Workbench widget. If another page needs schema search,\n  filtering, sorting, grouping, or preview behavior, compose the shared query\n  builder and feed it backend-advertised capabilities instead of creating a\n  local query form.\n\nDo not add hardcoded module endpoints, backend rules, translated business\ncopy, or alternate schema definitions to Axis.\n\n## Notifications & Messaging workspace\n\nWhen the backend advertises the `notifications-messaging` capability, Axis uses the same authenticated navigation and Schema Workbench contracts to expose Templates, Scenarios, Channels, Message Types, Providers, Provider Accounts, Delivery Logs, Attempts, Suppressions, Verification, and In-App Inbox. Axis does not contain a notification catalogue, provider list, consent rule, template lifecycle, OTP value, or delivery policy. Removing the backend capability or employee permission removes the workspace.\n\nBusiness users may traverse Channel -> Scenario -> Template or Scenario -> Channel -> Template using backend-advertised schema filters and relationships. Template preview and lifecycle operations execute only backend-declared secured routes. Real OTPs, provider credentials, raw destinations, raw provider payloads, and diagnostic stacks must never enter Axis records, browser storage, telemetry, or preview state. Provider-account forms accept secret references only.\n\nCustomer projects customize this surface by contributing higher-layer Nodics schemas, capability navigation, presentation metadata, lifecycle actions, permissions, and CMS help. Add Axis code only for a genuinely new reusable presentation contract; do not fork a channel-specific editor or duplicate backend policy. Successful, denied, suppressed, retry/recovery, maker-checker, narrow-screen, keyboard, and partial-discovery behavior remains protected by the generic Workbench and bootstrap suites.\n\n## Compliance Management workspace\n\nWhen the backend advertises `compliance-management`, Axis creates one dedicated\nCompliance Management section from the authenticated bootstrap. Compliance\ncapabilities attach their pages to that backend-owned parent instead of\ncreating separate consoles. The KYC capability currently contributes KYC Cases,\nReview Queue, Subject Status, Document Review, Policies and Requirements,\nProviders, and Compliance Audit; each page binds to its backend-advertised KYC\nschema. Future AML, sanctions, due-diligence, monitoring, or reporting modules\nmust contribute sibling pages through the same contract.\n\nAxis does not maintain the compliance catalogue. Removing the shared backend\ncapability, a child capability, or an employee permission removes the relevant\nsection, page, or action after authenticated bootstrap. Configuration and\noperational processes remain backend-owned even though authorized business\nusers manage them from this one Axis section.\n\nThe route-scoped Workbench hides the global schema picker, paginates and filters\nthrough KYC-owned APIs, and renders only fields, relations, panels, and actions\nallowed by the effective contract.\n\nCase actions are not generic record edits. Approve, reject, escalate, and\nrequest-more-information controls come from backend lifecycle metadata and call\nthe secured KYC intent route. Axis collects bounded reason inputs and supplies\nrecord identity/idempotency context; KYC rechecks authorization, scope, state,\nversion, maker-checker, policy, Workflow, persistence, and audit. Removing a\npermission or capability removes the corresponding route/action after the next\nauthenticated bootstrap.\n\nDocument Review shows masked metadata and nMedia codes only. Preview/download\nmust use an advertised purpose-bound nMedia action and be backend-audited. Axis\nnever turns a media code, provider reference, storage key, path, private URL,\nor schema value into a browser URL. Providers show readiness and a related\nexecution-policy panel; credentials, webhook keys, raw payloads, OCR,\nbiometrics, and full identity values never enter browser state, telemetry,\nURLs, or preferences.\n\nOn narrow screens and WebViews, panels stack, controls remain keyboard\nreachable, tables retain accessible labels, and high-risk actions keep explicit\nconfirmation. A backend rejection, stale state, provider outage, or network\nfailure leaves the record unchanged and shows only the safe code/message so the\nemployee can refresh, retry when allowed, or escalate.\n\nCustomer projects customize KYC through later backend modules: policy,\nrequirements, provider adapters, schemas, presentation metadata, lifecycle\nactions, permissions, and help. The smallest Axis customization is a\nproject-owned typed renderer that composes existing Workbench primitives for a\ngenuinely new presentation need. It must preserve KYC, nMedia, and Workflow\nauthority and must not fork a KYC editor, provider registry, lifecycle,\nauthorization rule, document viewer, or navigation catalogue. Removing the\nlater renderer or metadata contribution rolls back presentation without\nmutating KYC evidence.\n\n## Verification\n\nRun:\n\n```bash\nnpm run verify\n```\n\nFocused tests cover direct-module headers and paths, bounded record reads,\ncreates and updates, original-identity update queries, descriptor validation,\nbounded original-identity deletion, missing-identity rejection, explicit\nconfirmation, pending duplicate-submit prevention, authenticated tenant\nparsing, partial discovery, retryable failure, schema selection, record rendering,\nrecord selection, CMS renderer registration, required-field\nvalidation, default values, framework-managed field exclusion, selecting an\nexisting relationship, related-record creation, duplicate-reference prevention,\nretry without duplicate related creation, backend conflict-message handling,\ndiagnostic-context exclusion, malformed-error fallback, and locale-aware\nrecord formatting. Coverage also includes backend-declared lifecycle action\ninputs, JSON parsing, owner-module routing, safe route substitution, stable\nidempotency, and route-scoped schema workspaces that\nhide the global schema browser, nested shell navigation expansion and collapse,\nrevision forwarding for Update and Delete, missing-revision rejection before\nnetwork access, self-referential relationship cycle fallback, bounded nested\nrelationship depth, full description tooltips, five-word related-record\nsummaries, shared clickable reference rendering in details and tables, inline\nrelated-record details that preserve parent context, clearing stale one-to-one\npending drafts when selecting an existing target, and preserving remaining\none-to-many references when another selected reference is removed.\n\nThe authenticated local acceptance journey additionally verifies schema\ndiscovery across active modules, bounded search, unauthenticated rejection,\nraw-query rejection, advertised Create/Update/Delete visibility, readable\nEnterprise relationship labels, and `code - description` Tenant choices. The\njourney is read-only: it opens forms and selectors but does not submit a\nbusiness-data mutation.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/schema-workbench.md',
        evidence: 'docs/schema-workbench.md',
        hash: '48db80efb1b68037c598320173c525b6c05d9aaecdfbe574c042af953947ec91',
        version: '0.3.19',
      },
      previous: {
        title: 'Axis Assistant Frontend',
        route: '/docs/nodics-axis/assistant',
      },
      next: {
        title: 'Module Health',
        route: '/docs/nodics-axis/module-health',
      },
    },
    active: true,
  },
  record10: {
    code: 'axisDocsComponentmodulehealth',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.module-health',
      title: 'Module Health',
      route: '/docs/nodics-axis/module-health',
      section: 'axis-capabilities',
      sectionTitle: 'Axis Capabilities',
      category: 'Axis Capabilities',
      audience: ['administrator', 'operator', 'developer', 'security-reviewer'],
      summary:
        'Monitor the sanitized BackOffice module and node readiness projection without creating a browser-side health authority.',
      headings: [
        {
          text: 'Purpose and ownership',
          anchor: 'module-health-1-purpose-and-ownership',
          level: 2,
        },
        {
          text: 'Navigation and access',
          anchor: 'module-health-2-navigation-and-access',
          level: 2,
        },
        {
          text: 'Frontend structure',
          anchor: 'module-health-3-frontend-structure',
          level: 2,
        },
        {
          text: 'Operator workflow',
          anchor: 'module-health-4-operator-workflow',
          level: 2,
        },
        {
          text: 'Responsive, accessible, and failure behavior',
          anchor: 'module-health-5-responsive-accessible-and-failure-behavior',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'module-health-6-customize-and-extend-safely',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Purpose and ownership',
          anchor: 'module-health-1-purpose-and-ownership',
        },
        {
          kind: 'paragraph',
          text: 'Module Health gives an authorized employee a responsive view of registered Nodics modules and runtime instances. Operators can see whether Profile, CMS, Workflow, BackOffice, or another capability is healthy, degraded, unavailable, or unknown and identify the registered environment, server, and node involved.',
        },
        {
          kind: 'paragraph',
          text: 'Axis does not decide health. Nodics System owns readiness and BackOffice owns the sanitized availability observation and registry projection. Axis owns only typed consumption, interaction, rendering, filtering, and accessible state presentation.',
        },
        {
          kind: 'paragraph',
          text: 'Axis displays the backend-provided package label and renders the loader-discovered parent/child hierarchy. It never sends a label or canonical path as the operational identifier; detail, refresh, query keys, and authorization continue using the original module name.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Navigation and access',
          anchor: 'module-health-2-navigation-and-access',
        },
        {
          kind: 'paragraph',
          text: 'BackOffice contributes **Module Health** under **Operations and Integration** through `backofficeCapabilities.backoffice.navigation`; Axis does not hardcode the menu. It is returned only with `backoffice.registry.admin.view`.',
        },
        {
          kind: 'paragraph',
          text: 'The route is `/operations/module-health`. Employee session and screen-lock guards protect direct navigation. Backend authorization remains mandatory.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Frontend structure',
          anchor: 'module-health-3-frontend-structure',
        },
        {
          kind: 'code',
          language: 'text',
          text: 'src/operations/moduleHealth/\n  ModuleHealthRoutePage.tsx\n  ModuleHealthTree.tsx\n  api/\n    moduleHealthClient.ts\n    moduleHealthContracts.ts\n\ntest/operations/moduleHealth/\n  api/\n    moduleHealthClient.test.ts',
        },
        {
          kind: 'paragraph',
          text: 'Contracts reject malformed counts, identifiers, states, and freshness. The client supplies the in-memory employee token, enterprise header, request timeout, no-store policy, and redirect rejection. It stores no credentials and rejects unsafe module path segments.',
        },
        {
          kind: 'paragraph',
          text: 'TanStack Query owns server state. Summary data loads once; instance details load only for the selected module, avoiding an unbounded request per module. Window focus and explicit actions refresh data. Axis adds no health poller. An on-demand **Check now** action is enabled only when the selected module has at least one client-callable runtime endpoint. Non-client modules still show their registration heartbeat and observed state, but Axis does not request a refresh that the backend cannot perform.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Operator workflow',
          anchor: 'module-health-4-operator-workflow',
        },
        {
          kind: 'ordered-list',
          items: [
            'Open **Operations and Integration > Module Health**.',
            'Review totals and module states.',
            'Expand or collapse module groups.',
            'Search by label, code, canonical path, environment, server, or state. Matching descendants retain their ancestor chain.',
            'Select a concrete module. Its detail region expands directly beneath that module so the hierarchy and runtime evidence remain visually connected. Selecting the same module again collapses the detail region; selecting another module moves the single expanded detail region to that module.',
            "Review each registered node's heartbeat, readiness observation, state, freshness, and stable reason.",
            'Choose **Check now** for a governed immediate observation.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Expired and intentionally deregistered nodes are not active instances. Axis does not infer expected cluster membership from previously observed nodes.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Responsive, accessible, and failure behavior',
          anchor: 'module-health-5-responsive-accessible-and-failure-behavior',
        },
        {
          kind: 'unordered-list',
          items: [
            'Summary cards wrap, while the module hierarchy and inline detail region use the full available width on every breakpoint.',
            'State always has text in addition to color.',
            'Search is visibly labelled; rows are keyboard-operable buttons.',
            'Loading uses announced progress and failures use alerts.',
            'Dates use the browser locale.',
            'BackOffice failure never falls back to invented health.',
            'Unauthorized access remains a backend rejection.',
            'Malformed responses fail closed.',
            'Stale evidence is `UNKNOWN`, never healthy.',
            'Refresh failure preserves the existing view and shows a bounded message.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'module-health-6-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Partners may change styling or compose presentation around typed contracts. They must not call databases/providers from Axis, reproduce the registry, call every module ping as a second authority, persist access tokens or raw diagnostics, infer configured cluster membership, or bypass permissions.',
        },
      ],
      searchText:
        "Module Health Monitor the sanitized BackOffice module and node readiness projection without creating a browser-side health authority. # Module Health\n\n## Purpose and ownership\n\nModule Health gives an authorized employee a responsive view of registered\nNodics modules and runtime instances. Operators can see whether Profile, CMS,\nWorkflow, BackOffice, or another capability is healthy, degraded, unavailable,\nor unknown and identify the registered environment, server, and node involved.\n\nAxis does not decide health. Nodics System owns readiness and BackOffice owns\nthe sanitized availability observation and registry projection. Axis owns only\ntyped consumption, interaction, rendering, filtering, and accessible state\npresentation.\n\nAxis displays the backend-provided package label and renders the\nloader-discovered parent/child hierarchy. It never sends a label or canonical\npath as the operational identifier; detail, refresh, query keys, and\nauthorization continue using the original module name.\n\n## Navigation and access\n\nBackOffice contributes **Module Health** under **Operations and Integration**\nthrough `backofficeCapabilities.backoffice.navigation`; Axis does not hardcode\nthe menu. It is returned only with `backoffice.registry.admin.view`.\n\nThe route is `/operations/module-health`. Employee session and screen-lock\nguards protect direct navigation. Backend authorization remains mandatory.\n\n## Frontend structure\n\n```text\nsrc/operations/moduleHealth/\n  ModuleHealthRoutePage.tsx\n  ModuleHealthTree.tsx\n  api/\n    moduleHealthClient.ts\n    moduleHealthContracts.ts\n\ntest/operations/moduleHealth/\n  api/\n    moduleHealthClient.test.ts\n```\n\nContracts reject malformed counts, identifiers, states, and freshness.\nThe client supplies the in-memory employee token, enterprise header, request\ntimeout, no-store policy, and redirect rejection. It stores no credentials and\nrejects unsafe module path segments.\n\nTanStack Query owns server state. Summary data loads once; instance details\nload only for the selected module, avoiding an unbounded request per module.\nWindow focus and explicit actions refresh data. Axis adds no health poller.\nAn on-demand **Check now** action is enabled only when the selected module has\nat least one client-callable runtime endpoint. Non-client modules still show\ntheir registration heartbeat and observed state, but Axis does not request a\nrefresh that the backend cannot perform.\n\n## Operator workflow\n\n1. Open **Operations and Integration > Module Health**.\n2. Review totals and module states.\n3. Expand or collapse module groups.\n4. Search by label, code, canonical path, environment, server, or state.\n   Matching descendants retain their ancestor chain.\n5. Select a concrete module. Its detail region expands directly beneath that\n   module so the hierarchy and runtime evidence remain visually connected.\n   Selecting the same module again collapses the detail region; selecting\n   another module moves the single expanded detail region to that module.\n6. Review each registered node's heartbeat, readiness observation, state,\n   freshness, and stable reason.\n7. Choose **Check now** for a governed immediate observation.\n\nExpired and intentionally deregistered nodes are not active instances. Axis\ndoes not infer expected cluster membership from previously observed nodes.\n\n## Responsive, accessible, and failure behavior\n\n- Summary cards wrap, while the module hierarchy and inline detail region use\n  the full available width on every breakpoint.\n- State always has text in addition to color.\n- Search is visibly labelled; rows are keyboard-operable buttons.\n- Loading uses announced progress and failures use alerts.\n- Dates use the browser locale.\n- BackOffice failure never falls back to invented health.\n- Unauthorized access remains a backend rejection.\n- Malformed responses fail closed.\n- Stale evidence is `UNKNOWN`, never healthy.\n- Refresh failure preserves the existing view and shows a bounded message.\n\n## Customize and extend safely\n\nPartners may change styling or compose presentation around typed contracts.\nThey must not call databases/providers from Axis, reproduce the registry,\ncall every module ping as a second authority, persist access tokens or raw\ndiagnostics, infer configured cluster membership, or bypass permissions.\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/module-health.md',
        evidence: 'docs/module-health.md',
        hash: 'b94bb7b70fb2b4a7b2e8cd755b33cd564769bdf45bf2872dfa99520e6965f937',
        version: '0.3.19',
      },
      previous: {
        title: 'Axis Schema Workbench',
        route: '/docs/nodics-axis/schema-workbench',
      },
      next: {
        title: 'Imports and Exports Workspace',
        route: '/docs/nodics-axis/imports-exports',
      },
    },
    active: true,
  },
  record11: {
    code: 'axisDocsComponentimportsexports',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.imports-exports',
      title: 'Imports and Exports Workspace',
      route: '/docs/nodics-axis/imports-exports',
      section: 'axis-capabilities',
      sectionTitle: 'Axis Capabilities',
      category: 'Axis Capabilities',
      audience: ['administrator', 'operator', 'developer', 'security-reviewer'],
      summary:
        'Review immutable data releases, validation, installation, history, security, responsive behavior, and the fail-closed export boundary.',
      headings: [
        {
          text: 'Purpose and ownership',
          anchor: 'imports-exports-1-purpose-and-ownership',
          level: 2,
        },
        {
          text: 'Frontend organization',
          anchor: 'imports-exports-2-frontend-organization',
          level: 2,
        },
        {
          text: 'Employee workflow',
          anchor: 'imports-exports-3-employee-workflow',
          level: 2,
        },
        {
          text: 'File import workflow',
          anchor: 'imports-exports-4-file-import-workflow',
          level: 2,
        },
        {
          text: 'Security, failure, and extension',
          anchor: 'imports-exports-5-security-failure-and-extension',
          level: 2,
        },
        {
          text: 'Export workflow',
          anchor: 'imports-exports-6-export-workflow',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'imports-exports-7-customize-and-extend-safely',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Purpose and ownership',
          anchor: 'imports-exports-1-purpose-and-ownership',
        },
        {
          kind: 'paragraph',
          text: 'Axis gives authorized employees a responsive workspace for Nodics data operations. It is a client of the `import` module and does not discover files, calculate installation state, sequence imports, write a database, or retain a browser-side audit authority.',
        },
        {
          kind: 'paragraph',
          text: 'BackOffice contributes **Operations and Integration → Imports and Exports** at `/operations/imports-exports`. Axis renders it only when authenticated navigation contains that entry.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Frontend organization',
          anchor: 'imports-exports-2-frontend-organization',
        },
        {
          kind: 'unordered-list',
          items: [
            '`src/operations/importExport/ImportExportRoutePage.tsx` owns presentation and short-lived selection.',
            '`src/operations/importExport/api/dataReleaseContracts.ts` owns bounded client types.',
            '`src/operations/importExport/api/dataReleaseClient.ts` owns authenticated transport and defensive parsing.',
            '`src/operations/importExport/components/FileImportWorkspace.tsx` owns the governed file-import interaction only: selecting a backend-discovered target model, uploading one file through nMedia, validating through nImport, and executing only after successful validation.',
            'Tests mirror this hierarchy under `test/operations/importExport`.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'TanStack Query owns catalogue server state. The browser sends selected module codes and reviewed versions; Nodics re-discovers and validates the authority before doing work.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Employee workflow',
          anchor: 'imports-exports-3-employee-workflow',
        },
        {
          kind: 'paragraph',
          text: 'Choose Initialization, Core, or Sample data; review friendly module names, descriptions, versions, and states; select releases; validate; then install or update when authorized. A release marked `CURRENT` is already installed at the same immutable version and checksum. Axis still lets an operator validate a current release so the backend can confirm the immutable manifest, requested version, upgrade policy, active-module authority, tenant context, and installed state. Validation is side-effect-free: it never runs import handlers or writes business data. Install/update is the only action that executes init, core, or sample import processing. After a successful install/update, Axis clears the executed selection because the reviewed plan has become stale and must be reloaded before another operator action.',
        },
        {
          kind: 'paragraph',
          text: 'The install/update action remains disabled when every selected release is already current because there is no executable import work.',
        },
        {
          kind: 'paragraph',
          text: 'Controls stack on narrow screens, remain keyboard operable, and have assistive labels.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'File import workflow',
          anchor: 'imports-exports-4-file-import-workflow',
        },
        {
          kind: 'paragraph',
          text: 'Use **File imports** when an employee has an external CSV, Excel, JSON, or JavaScript import file that should create or update records in a Nodics schema. Axis does not ask for a server path and does not parse the file. The file is first uploaded through the `media` module, which stores the file according to backend storage policy and returns a media code. Axis then sends only the media code and selected backend model to the secured `system` import route.',
        },
        {
          kind: 'paragraph',
          text: 'The screen has five deliberate states:',
        },
        {
          kind: 'ordered-list',
          items: [
            '**Confirm target destination.** Axis shows the target enterprise as the business destination and shows the tenant only as technical traceability. The connected environment remains global read-only context; Axis is connected to one backend environment and does not offer environment switching inside file import. Tenant is the database or schema isolation authority resolved by Nodics from enterprise configuration, while the selected data type is only the model being imported. Business users should not independently choose a tenant in the normal import flow. Axis presents enterprise as a selector even when only one authorized enterprise is available, so the interaction is ready for future multi-enterprise deployments. When multiple enterprises are available, the selector should be populated from backend-authorized destinations and the tenant must remain read-only and derived from the selected enterprise.',
            '**Choose target model.** Axis loads authorized Workbench schema metadata from the connected backend modules and presents business-friendly model names such as Tenant, Address, Product, Price, Stock Balance, or CMS Page. The selected model still carries its authoritative module name and schema name, but Axis does not make `importDefinition` the first decision. Import templates are a later optional convenience for reusable mappings; the generic flow starts from the target schema.',
            '**Upload governed file.** The chosen browser file is submitted as `multipart/form-data` to nMedia after enterprise and target model are selected. Axis sends the selected enterprise, technical tenant, module name, and schema name as upload context so the backend storage strategy can place the file correctly. Axis never sets the multipart boundary by hand; the browser owns that header. Axis must never infer the schema from the file name.',
            '**Validate file import.** Axis calls the media-backed import route with validation enabled. nImport asks nMedia for the stored file, stages a temporary import workspace, generates a run-local header from the selected module/schema target, resolves tenant scope, parses the data, prepares finalized records, and reports whether the file is safe to execute. This proves the file can pass the existing backend import initializer without writing schema or search data. Axis displays backend counters, such as records read, records finalized, and validation issues, so the operator can tell the difference between a superficial upload success and a real import validation.',
            '**Install imported data.** Only after validation for the current uploaded media code does Axis enable the install action. The backend reruns governed import preparation and then executes the existing data-handler pipeline, so schema validation, authorization, duplicate handling, diagnostics, history, and cleanup stay backend-owned. Axis displays dispatched, succeeded, and failed record counts from the backend run summary and does not calculate those totals in the browser.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The generic path is intentionally schema-first. A later implementation may add import templates for recurring business feeds, such as Product CSV import, Stock balance Excel import, or Legacy ERP Customer import. Those templates must remain optional nImport-owned conveniences over the same media-backed route; they must not become a second file-import authority or a Profile-specific pattern.',
        },
        {
          kind: 'paragraph',
          text: 'To customize file import safely, expose or refine schema metadata and import behavior in the owning backend module. If a new parser, storage provider, field-mapping template, transformation, or validation rule is needed, implement that capability in the backend provider layer and expose it through the same secured contracts. Axis may improve selection, preview, and result presentation, but it must not parse business files or duplicate schema rules.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Security, failure, and extension',
          anchor: 'imports-exports-5-security-failure-and-extension',
        },
        {
          kind: 'paragraph',
          text: 'The in-memory employee token is sent only to the selected `import` connection for release/history reads, backend module connections for Workbench schema discovery, the selected `media` connection for uploads, and the selected `system` connection for media-backed import execution. Each connection comes from BackOffice bootstrap. Axis never infers authorization from a visible button. Unknown states and incompatible responses are rejected. Timeouts, authorization failures, disabled policy, integrity failures, and stale selections are shown without backend stacks or diagnostics.',
        },
        {
          kind: 'paragraph',
          text: 'Existing installations may enter this workspace with the historical `import.core.run` administrator permission so they can install the new fine-grained permission data. Nodics still enforces a separate type-specific permission for each execution.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Export workflow',
          anchor: 'imports-exports-6-export-workflow',
        },
        {
          kind: 'paragraph',
          text: 'Use **Exports** when an employee needs a governed file generated from records owned by a Nodics schema. Axis follows the same business-first sequence as file import:',
        },
        {
          kind: 'ordered-list',
          items: [
            '**Confirm target destination.** The employee chooses the target enterprise. Axis shows the derived tenant as technical traceability because tenant is database isolation, not a normal business choice. Axis stays connected to one backend environment and does not switch environments inside the export screen.',
            '**Choose export model.** Axis loads authorized schemas from the Schema Workbench and groups them by owning module. The employee searches by model name or module name and chooses the schema that owns the data. Axis keeps the module name and schema name only as backend contract values.',
            '**Build query and preview.** Axis uses the shared Schema Query Builder used by Schema Workbench record browsing and every other schema-backed data retrieval screen. The employee can combine simple search text with governed conditions, nested `AND`/`OR` groups, allowed operators, sort order, and preview size. Allowed fields, operators, group operators, sortable fields, default sort, and maximum preview size come from the backend schema Workbench capability contract; Axis does not invent unsupported operators or send free-form database queries. The preview remains bounded and read-only so the employee can verify the query before generating a file, but it is not the export authority.',
            '**Generate export file.** The employee chooses CSV or JSON. Axis calls the secured nExport route. The backend uses nExport to re-run the governed query, applies export access policy, renders the file, and asks nMedia to store the output as an `exportFiles` media record.',
            '**Download or use the media.** Axis shows the generated file name, record counts, media code, and download action when the backend returns an access URL. Private, signed, or public delivery is always controlled by nMedia policy; Axis never exposes raw filesystem paths.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'This first export implementation supports single-schema CSV and JSON exports. Multi-schema or aggregated exports, scheduled exports, additional formats, and external destinations should be added behind nExport provider contracts later. Those extensions must still generate media records for produced files so history, storage policy, access policy, and cleanup remain backend-owned.',
        },
        {
          kind: 'paragraph',
          text: 'The Schema Query Builder is not an export component. Export, Schema Workbench, future media-reference lookups, and any future schema record browser should reuse the same builder whenever they retrieve records from a Nodics schema. The builder consumes backend-advertised searchable fields, filter fields, operators, grouping rules, sort fields, default sort, and page-size limits. It does not decide database syntax, bypass ownership, or add browser-only operators.',
        },
        {
          kind: 'paragraph',
          text: 'To customize export safely, change the owning backend schema/search behavior, export access policy, nExport rendering/provider services, nMedia storage configuration, or the shared Axis Schema Query Builder presentation. Axis may improve the query builder and result presentation, but it must not query databases directly, render authoritative business files from browser-only data, or decide media storage paths.',
        },
        {
          kind: 'paragraph',
          text: 'Extend presentation inside this feature and reuse shell and API patterns. Never add an Axis filesystem picker or importer. Run `npm run verify` and validate desktop, touch, narrow viewport, keyboard, unauthorized, unavailable-module, validation, execution, recovery, integration, and regression behavior.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'imports-exports-7-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Add project-specific release filters, explanatory CMS copy, file-import helper copy, or result presentation through focused Axis components while continuing to call the Nodics nImport catalogue, Workbench schema discovery, preflight, media-backed execution, and history contracts. New import or export formats, release discovery, sequencing, persistence, mapping templates, and provider behavior belong in later backend modules behind the provider-neutral data contracts.',
        },
        {
          kind: 'paragraph',
          text: 'Do not inspect sibling repositories, submit arbitrary server paths, calculate installation state locally, parse data files in Axis, store uploaded file content in browser state beyond the selected `File`, or enable export before its backend contract is active. Test authorized and unauthorized catalogues, initialization/core/sample separation, schema discovery absence, missing media/system connections, upload failure, validation failure, stale validated media, checksum and compatibility rejection, execution retry, history projection, narrow and keyboard use, backend unavailability, and removal of the project presentation extension.',
        },
      ],
      searchText:
        'Imports and Exports Workspace Review immutable data releases, validation, installation, history, security, responsive behavior, and the fail-closed export boundary. # Imports and Exports Workspace\n\n## Purpose and ownership\n\nAxis gives authorized employees a responsive workspace for Nodics data\noperations. It is a client of the `import` module and does not discover files,\ncalculate installation state, sequence imports, write a database, or retain a\nbrowser-side audit authority.\n\nBackOffice contributes **Operations and Integration → Imports and Exports** at\n`/operations/imports-exports`. Axis renders it only when authenticated\nnavigation contains that entry.\n\n## Frontend organization\n\n- `src/operations/importExport/ImportExportRoutePage.tsx` owns presentation and\n  short-lived selection.\n- `src/operations/importExport/api/dataReleaseContracts.ts` owns bounded client\n  types.\n- `src/operations/importExport/api/dataReleaseClient.ts` owns authenticated\n  transport and defensive parsing.\n- `src/operations/importExport/components/FileImportWorkspace.tsx` owns the\n  governed file-import interaction only: selecting a backend-discovered target\n  model, uploading one file through nMedia, validating through nImport, and\n  executing only after successful validation.\n- Tests mirror this hierarchy under `test/operations/importExport`.\n\nTanStack Query owns catalogue server state. The browser sends selected module\ncodes and reviewed versions; Nodics re-discovers and validates the authority\nbefore doing work.\n\n## Employee workflow\n\nChoose Initialization, Core, or Sample data; review friendly module names,\ndescriptions, versions, and states; select releases; validate; then install or\nupdate when authorized. A release marked `CURRENT` is already installed at the\nsame immutable version and checksum. Axis still lets an operator validate a\ncurrent release so the backend can confirm the immutable manifest, requested\nversion, upgrade policy, active-module authority, tenant context, and installed\nstate. Validation is side-effect-free: it never runs import handlers or writes\nbusiness data. Install/update is the only action that executes init, core, or\nsample import processing. After a successful install/update, Axis clears the\nexecuted selection because the reviewed plan has become stale and must be\nreloaded before another operator action.\n\nThe install/update action remains disabled when every selected release is\nalready current because there is no executable import work.\n\nControls stack on narrow screens, remain keyboard operable, and have assistive\nlabels.\n\n## File import workflow\n\nUse **File imports** when an employee has an external CSV, Excel, JSON, or\nJavaScript import file that should create or update records in a Nodics schema.\nAxis does not ask for a server path and does not parse the file. The file is\nfirst uploaded through the `media` module, which stores the file according to\nbackend storage policy and returns a media code. Axis then sends only the media\ncode and selected backend model to the secured `system` import route.\n\nThe screen has five deliberate states:\n\n1. **Confirm target destination.** Axis shows the target enterprise as the\n   business destination and shows the tenant only as technical traceability. The\n   connected environment remains global read-only context; Axis is connected to\n   one backend environment and does not offer environment switching inside file\n   import. Tenant is the database or schema isolation authority resolved by\n   Nodics from enterprise configuration, while the selected data type is only\n   the model being imported. Business users should not independently choose a\n   tenant in the normal import flow. Axis presents enterprise as a selector even\n   when only one authorized enterprise is available, so the interaction is\n   ready for future multi-enterprise deployments. When multiple enterprises are\n   available, the selector should be populated from backend-authorized\n   destinations and the tenant must remain read-only and derived from the\n   selected enterprise.\n2. **Choose target model.** Axis loads authorized Workbench schema metadata from\n   the connected backend modules and presents business-friendly model names such\n   as Tenant, Address, Product, Price, Stock Balance, or CMS Page. The selected\n   model still carries its authoritative module name and schema name, but Axis\n   does not make `importDefinition` the first decision. Import templates are a\n   later optional convenience for reusable mappings; the generic flow starts\n   from the target schema.\n3. **Upload governed file.** The chosen browser file is submitted as\n   `multipart/form-data` to nMedia after enterprise and target model are\n   selected. Axis sends the selected enterprise, technical tenant, module name,\n   and schema name as upload context so the backend storage strategy can place\n   the file correctly. Axis never sets the multipart boundary by hand; the\n   browser owns that header. Axis must never infer the schema from the file\n   name.\n4. **Validate file import.** Axis calls the media-backed import route with\n   validation enabled. nImport asks nMedia for the stored file, stages a\n   temporary import workspace, generates a run-local header from the selected\n   module/schema target, resolves tenant scope, parses the data, prepares\n   finalized records, and reports whether the file is safe to execute. This\n   proves the file can pass the existing backend import initializer without\n   writing schema or search data. Axis displays backend counters, such as\n   records read, records finalized, and validation issues, so the operator can\n   tell the difference between a superficial upload success and a real import\n   validation.\n5. **Install imported data.** Only after validation for the current uploaded\n   media code does Axis enable the install action. The backend reruns governed\n   import preparation and then executes the existing data-handler pipeline, so\n   schema validation, authorization, duplicate handling, diagnostics, history,\n   and cleanup stay backend-owned. Axis displays dispatched, succeeded, and\n   failed record counts from the backend run summary and does not calculate\n   those totals in the browser.\n\nThe generic path is intentionally schema-first. A later implementation may add\nimport templates for recurring business feeds, such as Product CSV import,\nStock balance Excel import, or Legacy ERP Customer import. Those templates must\nremain optional nImport-owned conveniences over the same media-backed route;\nthey must not become a second file-import authority or a Profile-specific\npattern.\n\nTo customize file import safely, expose or refine schema metadata and import\nbehavior in the owning backend module. If a new parser, storage provider,\nfield-mapping template, transformation, or validation rule is needed, implement\nthat capability in the backend provider layer and expose it through the same\nsecured contracts. Axis may improve selection, preview, and result\npresentation, but it must not parse business files or duplicate schema rules.\n\n## Security, failure, and extension\n\nThe in-memory employee token is sent only to the selected `import` connection\nfor release/history reads, backend module connections for Workbench schema\ndiscovery, the selected `media` connection for uploads, and the selected\n`system` connection for media-backed import execution. Each connection comes\nfrom BackOffice bootstrap. Axis never infers authorization from a visible\nbutton. Unknown states and incompatible responses are rejected.\nTimeouts, authorization failures, disabled policy, integrity failures, and stale\nselections are shown without backend stacks or diagnostics.\n\nExisting installations may enter this workspace with the historical\n`import.core.run` administrator permission so they can install the new\nfine-grained permission data. Nodics still enforces a separate type-specific\npermission for each execution.\n\n## Export workflow\n\nUse **Exports** when an employee needs a governed file generated from records\nowned by a Nodics schema. Axis follows the same business-first sequence as file\nimport:\n\n1. **Confirm target destination.** The employee chooses the target enterprise.\n   Axis shows the derived tenant as technical traceability because tenant is\n   database isolation, not a normal business choice. Axis stays connected to\n   one backend environment and does not switch environments inside the export\n   screen.\n2. **Choose export model.** Axis loads authorized schemas from the Schema\n   Workbench and groups them by owning module. The employee searches by model\n   name or module name and chooses the schema that owns the data. Axis keeps\n   the module name and schema name only as backend contract values.\n3. **Build query and preview.** Axis uses the shared Schema Query Builder used\n   by Schema Workbench record browsing and every other schema-backed data\n   retrieval screen. The employee can combine\n   simple search text with governed conditions, nested `AND`/`OR` groups,\n   allowed operators, sort order, and preview size. Allowed fields, operators,\n   group operators, sortable fields, default sort, and maximum preview size come\n   from the backend schema Workbench capability contract; Axis does not invent\n   unsupported operators or send free-form database queries. The preview remains\n   bounded and read-only so the employee can verify the query before generating\n   a file, but it is not the export authority.\n4. **Generate export file.** The employee chooses CSV or JSON. Axis calls the\n   secured nExport route. The backend uses nExport to re-run the governed\n   query, applies export access policy, renders the file, and asks nMedia to\n   store the output as an `exportFiles` media record.\n5. **Download or use the media.** Axis shows the generated file name, record\n   counts, media code, and download action when the backend returns an access\n   URL. Private, signed, or public delivery is always controlled by nMedia\n   policy; Axis never exposes raw filesystem paths.\n\nThis first export implementation supports single-schema CSV and JSON exports.\nMulti-schema or aggregated exports, scheduled exports, additional formats, and\nexternal destinations should be added behind nExport provider contracts later.\nThose extensions must still generate media records for produced files so\nhistory, storage policy, access policy, and cleanup remain backend-owned.\n\nThe Schema Query Builder is not an export component. Export, Schema Workbench,\nfuture media-reference lookups, and any future schema record browser should\nreuse the same builder whenever they retrieve records from a Nodics schema.\nThe builder consumes backend-advertised searchable fields, filter fields,\noperators, grouping rules, sort fields, default sort, and page-size limits. It\ndoes not decide database syntax, bypass ownership, or add browser-only operators.\n\nTo customize export safely, change the owning backend schema/search behavior,\nexport access policy, nExport rendering/provider services, nMedia storage\nconfiguration, or the shared Axis Schema Query Builder presentation. Axis may\nimprove the query builder and result presentation, but it must not query\ndatabases directly, render authoritative business files from browser-only data,\nor decide media storage paths.\n\nExtend presentation inside this feature and reuse shell and API patterns. Never\nadd an Axis filesystem picker or importer. Run `npm run verify` and validate\ndesktop, touch, narrow viewport, keyboard, unauthorized, unavailable-module,\nvalidation, execution, recovery, integration, and regression behavior.\n\n## Customize and extend safely\n\nAdd project-specific release filters, explanatory CMS copy, file-import helper\ncopy, or result presentation through focused Axis components while continuing to\ncall the Nodics nImport catalogue, Workbench schema discovery, preflight,\nmedia-backed execution, and history contracts. New import or export formats,\nrelease discovery, sequencing, persistence, mapping templates, and provider\nbehavior belong in later backend modules behind the provider-neutral data\ncontracts.\n\nDo not inspect sibling repositories, submit arbitrary server paths, calculate\ninstallation state locally, parse data files in Axis, store uploaded file\ncontent in browser state beyond the selected `File`, or enable export before\nits backend contract is active. Test authorized and unauthorized catalogues,\ninitialization/core/sample separation, schema discovery absence, missing\nmedia/system connections, upload failure, validation failure, stale validated\nmedia, checksum and compatibility rejection, execution retry, history\nprojection, narrow and keyboard use, backend unavailability, and removal of the\nproject presentation extension.\n',
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/imports-and-exports.md',
        evidence: 'docs/imports-and-exports.md',
        hash: '8e6e20e92557c3b3f0b97e7db1c50f859af97be82d9b468108dc78745e47993f',
        version: '0.3.19',
      },
      previous: {
        title: 'Module Health',
        route: '/docs/nodics-axis/module-health',
      },
      next: {
        title: 'Media Management Workspace',
        route: '/docs/nodics-axis/media',
      },
    },
    active: true,
  },
  record12: {
    code: 'axisDocsComponentmediamanagement',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.media-management',
      title: 'Media Management Workspace',
      route: '/docs/nodics-axis/media',
      section: 'axis-capabilities',
      sectionTitle: 'Axis Capabilities',
      category: 'Axis Capabilities',
      audience: ['administrator', 'operator', 'developer', 'business-user'],
      summary:
        'Understand the governed Media Management navigation, route shell, backend ownership, storage and delivery boundaries, and upcoming capability slices.',
      headings: [
        {
          text: 'Purpose',
          anchor: 'media-management-1-purpose',
          level: 2,
        },
        {
          text: 'Navigation',
          anchor: 'media-management-2-navigation',
          level: 2,
        },
        {
          text: 'Implemented Axis behavior',
          anchor: 'media-management-3-implemented-axis-behavior',
          level: 2,
        },
        {
          text: 'Backend ownership',
          anchor: 'media-management-4-backend-ownership',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'media-management-5-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Customizing storage policy safely',
          anchor: 'media-management-6-customizing-storage-policy-safely',
          level: 3,
        },
        {
          text: 'Customizing upload behavior safely',
          anchor: 'media-management-7-customizing-upload-behavior-safely',
          level: 3,
        },
        {
          text: 'Verification',
          anchor: 'media-management-8-verification',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'heading',
          level: 2,
          text: 'Purpose',
          anchor: 'media-management-1-purpose',
        },
        {
          kind: 'paragraph',
          text: 'Media Management gives BackOffice users a single place to work with files that Nodics stores through the framework media lifecycle. A media file can be an import spreadsheet, a CMS banner image, a product gallery image, a product thumbnail, a PDF document, or another governed file that a business process needs to keep and reference.',
        },
        {
          kind: 'paragraph',
          text: 'Axis does not own media storage. The backend `nMedia` module owns media metadata, folders, formats, sets, references, storage provider selection, storage-key generation, upload validation, access policy, and content delivery. Axis only renders the employee workspace that is returned by the BackOffice navigation contract.',
        },
        {
          kind: 'paragraph',
          text: 'In the Axis UI, the word **Visibility** is used for the backend media access policy. Visibility answers a business question: "who can safely open this file?" It does not mean database permission and it does not mean the employee\'s BackOffice role. For example, data import and data export files are normally private, while approved CMS or product assets may become public or signed later.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Navigation',
          anchor: 'media-management-2-navigation',
        },
        {
          kind: 'paragraph',
          text: 'The left navigation group is **Media Management**. It is published by nMedia through `backofficeCapabilities.media.navigation`, not hardcoded in Axis. The current first slice exposes these entries:',
        },
        {
          kind: 'unordered-list',
          items: [
            '**Media** for uploaded media records.',
            '**Media Folders** for purpose-based folders such as import sources, data export files, CMS assets, product assets, and utility files.',
            '**Media Sets** for groups of related media variants, such as a product image gallery or responsive CMS image set.',
            '**Media Formats** for reusable formats such as original, thumbnail, mobile, desktop, zoom, and import file.',
            '**Media Usage** for finding which product, CMS, import, or business record is referencing a media item.',
            '**Storage and Delivery** for provider policy, visibility, and delivery behavior.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'These entries appear only when BackOffice returns them for the authenticated employee. Axis must not show a duplicate static media menu when the backend does not authorize it.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Implemented Axis behavior',
          anchor: 'media-management-3-implemented-axis-behavior',
        },
        {
          kind: 'paragraph',
          text: 'The implemented browser route is `/media/*`, but page composition is owned by the authenticated Axis CMS content catalog route at `/media`. The catalog maps `axis.page.media-management` to the Axis page renderer, `axis.template.media-management` to the template renderer, and `axis.component.media-management-workspace` to the reusable workspace component renderer. The renderer reads the current browser location and backend-published navigation to make each section route meaningful:',
        },
        {
          kind: 'unordered-list',
          items: [
            '`/media` explains the full governed media operations area.',
            '`/media/items` explains uploaded media records.',
            '`/media/folders` explains media folder policy.',
            '`/media/sets` explains logical media sets and variants.',
            '`/media/formats` explains reusable presentation or processing formats.',
            '`/media/usage` explains media references and usage tracing.',
            '`/media/storage-delivery` explains provider policy and delivery behavior.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The active section shows three beginner-friendly blocks:',
        },
        {
          kind: 'ordered-list',
          items: [
            'the backend owner or model that remains authoritative;',
            'what the employee workspace can safely show now;',
            'the next capability slices that will make the section operational.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The route uses the same employee session, screen-lock, runtime bootstrap, left-nav, CMS renderer boundary, and authorization gates as the rest of Axis. Axis must not mount Media Management as a direct operations page that bypasses the content catalog and renderer registry.',
        },
        {
          kind: 'paragraph',
          text: 'The **Media** section now includes an operational media record workspace. Axis discovers the `media` schema through the same generated Schema Workbench contract used by the Business Data workbench, then searches records through the owning nMedia module connection. The screen shows safe business metadata such as media code, original filename, folder, format, visibility, lifecycle status, MIME type, extension, size, checksum, checksum algorithm, and provider. Normal business detail panels do not expose provider storage keys or backend-resolved full paths.',
        },
        {
          kind: 'paragraph',
          text: 'The media list is designed to scale beyond the small local-development list. Business users can narrow media records by:',
        },
        {
          kind: 'unordered-list',
          items: [
            '**Source type**, which is the business purpose published by nMedia context metadata or, for older backend deployments, derived from backend folder metadata. Examples include data imports, data exports, product media, content media, business documents, or utility media;',
            '**Visibility**, such as private, public, or future signed delivery;',
            '**Status**, such as ready, consumed, retired, or failed;',
            '**Format**, such as import file, original, thumbnail, desktop, mobile, or a partner-defined format;',
            'free-text search across safe metadata such as code, filename, folder, format, status, MIME type, and extension.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Axis sends search text, queryable source-type/facet selections, page number, page size, and the schema default sort to nMedia through the generated Schema Workbench record contract. The table count comes from the backend `totalCount`, not from a browser-side full-record load. Axis only renders filters when the active schema advertises the corresponding safe filter field and operator. Source type is mapped to backend folder codes from `/contexts`, then passed as a `folderCode` filter when the media schema allows it. This keeps large media libraries scalable while preserving nMedia as the only authority for record retrieval, filtering, storage, and delivery. Axis must not create a browser-only media index or read storage folders directly.',
        },
        {
          kind: 'paragraph',
          text: 'The same section also supports governed upload. The employee selects an upload purpose, such as data imports, content media, product media, or utility media. Axis first asks nMedia for backend-owned media source contexts through `/contexts`. The context response tells Axis which source types are eligible for manual upload, which compatibility aliases identify the same source type, which folders and formats they use, and which route template can be shown to the employee. Axis treats backend `sourceType`, `code`, and `aliases` as the authority for source-type mapping. Regex-style browser guessing is only an older-backend fallback when `/contexts` is unavailable. If an older backend does not publish contexts, Axis falls back to the older `/storage/policy` folder probes. Data exports are not shown as a manual-upload source type by default because export files are generated by the Exports workspace. When the employee uploads a file, Axis posts multipart data to the nMedia `/storage/upload` endpoint. nMedia validates the folder, file type, size, checksum, provider, and storage key. Axis receives the returned media code and refreshes the media list. Axis does not choose the filesystem folder, does not generate the storage key, and does not persist media metadata directly.',
        },
        {
          kind: 'paragraph',
          text: 'The upload UI is implemented as the reusable `MediaUploadWizard` component under Media Management operations. The wizard keeps the interaction layered:',
        },
        {
          kind: 'ordered-list',
          items: [
            'select a backend-published source type;',
            'show the resolved nMedia folder, format, route template, extension policy, MIME policy, and max-size policy;',
            'show the backend-published target module and schema when a source type requires target context;',
            'keep file selection disabled until a valid source type, policy, and required target context are known;',
            'let the employee choose a local file;',
            'show a browser-only review; and',
            'submit the file to nMedia and call the parent refresh callback after a media code is returned.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The browser-only review is intentionally advisory. Axis may show local metadata that helps an employee catch obvious mistakes before upload, including file size, MIME type, extension, image dimensions, a thumbnail for image files, CSV headers and row count, JSON top-level shape, and a small text preview. These signals are not business validation. nMedia still validates upload policy, and the owning module, such as nImport, Product, CMS, or a partner module, still validates business content after it receives the media code.',
        },
        {
          kind: 'paragraph',
          text: 'Media detail includes three operational checks:',
        },
        {
          kind: 'ordered-list',
          items: [
            '**Delivery preview** uses the nMedia content endpoint only when the media is public and in a deliverable lifecycle state.',
            '**Usage summary** checks nMedia `mediaReference` records for the selected media code and links to `/media/usage?mediaCode=...` so the employee can review where the file is used.',
            '**Lifecycle actions** expose retire or restore actions only when the generated media schema allows update for the employee session. Axis blocks retire when active usage references are visible, because a business user should review dependencies before making a file inactive.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'The **Media Folders** section uses the same backend-owned pattern. Axis discovers the `mediaFolder` schema from nMedia, searches folder records through the nMedia module connection, and presents folder policy in business-friendly language. It shows the folder code, name, description, storage prefix, visibility/access mode, allowed extensions, allowed MIME types, maximum file size, and retention days. This helps administrators understand where import files, data export files, CMS assets, product assets, and utility documents are routed without making Axis own storage rules.',
        },
        {
          kind: 'paragraph',
          text: 'When an employee selects a folder, Axis shows a policy-impact warning. The warning explains that changes to the folder policy affect future upload validation, default visibility, retention, and provider-relative routing. It also repeats the boundary: provider secrets, raw paths, and alternate browser-side upload rules must not be added to Axis.',
        },
        {
          kind: 'paragraph',
          text: 'Folder policy editing is intentionally nMedia-owned. If the discovered `mediaFolder` schema does not advertise update permission for the employee session, Axis shows the policy as read-only and directs administrators back to backend-approved media configuration. When update is advertised, Axis exposes a small policy action panel for visibility, maximum upload size, and retention days. The panel submits only those fields through the nMedia folder policy operation, so future upload validation uses the same backend authority. Axis does not edit storage prefixes, resolved paths, provider secrets, provider configuration, or browser-side policy rules. nMedia remains responsible for validation, routing, provider behavior, tenant policy, and persistence.',
        },
        {
          kind: 'paragraph',
          text: 'Media Management may link to Schema Workbench for generic `mediaFolder` record inspection, search, audit, or seed-data workflows instead of duplicating the generic record form. The handoff URL is `/schema-workbench?module=media&schema=mediaFolder`; when the backend advertises create permission, Axis may also link to `/schema-workbench?module=media&schema=mediaFolder&mode=create`. Those links do not replace the nMedia policy operation for live upload-policy changes unless a deployment explicitly synchronizes generated records into effective configuration through nMedia-owned governance.',
        },
        {
          kind: 'paragraph',
          text: 'The **Media Formats** section is also operational. Axis discovers the `mediaFormat` schema from nMedia and shows reusable presentation or processing formats such as original, thumbnail, desktop, mobile, zoom, or import file. The screen presents format code, name, purpose, family, lifecycle status, description, width, height, and a combined dimensions view. Formats help backend and frontend teams use consistent business vocabulary for media variants without making Axis transform images or own storefront rendering behavior.',
        },
        {
          kind: 'paragraph',
          text: 'Format detail also asks nMedia for `/contexts` and shows where the selected format is advertised. This answers questions such as "which folders/source types can use desktop?" without hardcoding source-type behavior in Axis. A format can be default, allowed, both, or unused by the current backend context configuration. The live upload authority remains nMedia format policy; Schema Workbench records are useful for inspection and audit, not a second browser policy authority.',
        },
        {
          kind: 'paragraph',
          text: 'The **Media Sets** section now lists and searches logical media groups from the `mediaSet` schema. A media set represents one logical asset group, such as a product gallery, responsive CMS image group, documentation asset group, or mixed file bundle. Axis shows the set code, name, description, media type, business purpose, and lifecycle status.',
        },
        {
          kind: 'paragraph',
          text: 'When an employee selects a media set, Axis also loads the set composition from the nMedia-owned `mediaSetEntry` schema. The detail panel shows each linked variant with its media code, optional format code, variant role, locale, channel, device, breakpoint, fallback entry, dimensions, position, primary flag, and lifecycle status. This keeps the business view clear: the set describes the logical group, each entry describes a specific reusable variant, and each variant still points to an owned media record. Axis does not duplicate variant ownership or infer image behavior; it asks nMedia for the set entries using a backend filter on the selected set code.',
        },
        {
          kind: 'paragraph',
          text: 'Set-entry actions call nMedia-owned endpoints under `/sets/{mediaSetCode}/entries`. Axis can reorder entries, mark one entry as primary, remove an entry from the set, and hand off full create/edit record workflows to Schema Workbench. These actions intentionally do not update Product, CMS, import, export, or partner business records. Those modules decide where a media set is used; nMedia manages the reusable media grouping and variant metadata.',
        },
        {
          kind: 'paragraph',
          text: 'The **Media Usage** section now searches the nMedia `mediaReference` schema. A media reference answers the business question, "where is this file or media set being used?" without moving ownership away from the source module. For example, a product record may reference a product gallery, a CMS component may reference a banner image, or an import process may reference the uploaded source file. Axis shows the owner module, owner schema, owner record code, relation type, media code, media set code, position, and lifecycle status.',
        },
        {
          kind: 'paragraph',
          text: "When the route receives a `mediaCode` query parameter, Axis filters the usage workspace to that media item. This gives Media detail a safe deep link into usage without inventing a second search endpoint. The filter still runs through nMedia's generated schema/workbench contract.",
        },
        {
          kind: 'paragraph',
          text: 'Usage can also be filtered by owner module, owner schema, owner record, relation type, and status when the backend schema advertises those fields as queryable. The owner-record filter is useful when a business user already knows the Product, CMS, import, export, or partner record that may be holding a reference.',
        },
        {
          kind: 'paragraph',
          text: 'This is not analytics usage and it is not a duplicate product or CMS editor. nMedia owns only the media reference trace. The product, CMS, import, or partner module continues to own the business record and its validation rules. This separation lets administrators safely answer cleanup questions such as "can this file be retired?" before removing or retiring media that may still be attached to another business object.',
        },
        {
          kind: 'paragraph',
          text: 'Media detail also includes an **Import/export linkage** panel. The panel is read-only. It asks nImport for run history with the selected `mediaCode` and shows any matching import runs, counts, status, data type, and modules. It also summarizes import/export `mediaReference` traces when they exist. Axis does not edit the import run, export result, Product record, CMS record, or partner record from this panel; it links the employee to the owning Import/Export workspace for deeper work. Export status remains owned by nExport and should be surfaced only through nExport-published contracts.',
        },
        {
          kind: 'paragraph',
          text: 'The **Storage and Delivery** section now provides a read-only policy inspection view. Axis first calls the nMedia `/contexts` API and derives safe folder policy rows from the backend-owned context projection, including backend-owned source type aliases. For older backend deployments that do not yet publish contexts, Axis falls back to the `/storage/policy` API with small safe probe descriptors for known folder purposes. The result shows folder-level upload rules: folder code, business label, visibility, allowed extensions, allowed MIME types, maximum file size, and checksum algorithm.',
        },
        {
          kind: 'paragraph',
          text: 'The same screen also calls `/storage/providers/summary` when the backend publishes it. That summary is deliberately safe: active provider code, provider type, enabled/active flags, provider health status, key strategy name, and delivery mode. It does not expose absolute filesystem paths, bucket names, certificates, credentials, object keys, or signed URL secrets. Axis does not call the storage-location endpoint, does not generate storage keys, and does not offer provider credential controls. nMedia still decides whether a folder uses local storage, NAS, S3, Azure, Google Cloud Storage, FTP, or a partner provider.',
        },
        {
          kind: 'paragraph',
          text: 'For a beginner developer, this means:',
        },
        {
          kind: 'ordered-list',
          items: [
            'Axis asks nMedia, "which media source contexts and folder policies are safe for this employee workspace?"',
            'nMedia returns safe context and upload-policy metadata without provider secrets or raw paths.',
            'Axis optionally asks nMedia for the safe storage provider summary and shows only provider code, type, health, delivery, and key-strategy metadata.',
            'Axis displays only the safe context, policy, and provider summary metadata.',
            'When a real upload happens, Axis sends the selected file to nMedia.',
            'nMedia resolves provider and storage location, creates the media record, and returns the media code.',
            'When a file is opened, Axis uses the nMedia content delivery endpoint with the media code instead of a raw file path.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'For example, an import CSV is uploaded under the `importSources` purpose. A generated export CSV or ZIP is stored under the `exportFiles` purpose. A CMS banner image is uploaded under the `cmsAssets` purpose. A product gallery image is uploaded under the `productAssets` purpose. They may all use the same local provider in local development, but production can route them differently through nMedia configuration without changing Axis.',
        },
        {
          kind: 'paragraph',
          text: 'For single-schema data operations, nMedia uses separate provider-relative data paths for imports and exports:',
        },
        {
          kind: 'unordered-list',
          items: [
            'import files: `data/import/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;',
            'generated export files: `data/export/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Axis may display the business purpose and media code, but it must not assemble or persist these paths itself. Multi-schema aggregated exports will need their own backend-owned path contract later.',
        },
        {
          kind: 'paragraph',
          text: 'For business media operations, nMedia uses separate provider-relative media paths by purpose:',
        },
        {
          kind: 'unordered-list',
          items: [
            'product media: `media/product/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;',
            'content media: `media/content/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;',
            'utility media: `media/utility/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Axis can present these as Product media, Content media, and Utility media filters, but the backend folder configuration and key strategy remain the only authority for the actual storage key.',
        },
        {
          kind: 'paragraph',
          text: 'Axis deliberately does not display backend-resolved full paths. If a file can be opened inline, the UI uses the nMedia content endpoint, not a filesystem path. If a file is downloaded, Axis uses the nMedia download endpoint `/download/{mediaCode}` so backend content-disposition and authorization policy remain in charge. This keeps local storage, NAS, cloud storage, and future signed URL providers behind the backend media contract.',
        },
        {
          kind: 'paragraph',
          text: 'The **Media** record detail view follows the same rule. When a selected media record is a public image in a deliverable lifecycle state, Axis can render a small preview by calling the nMedia content delivery URL. For other file types, Axis offers an open action through `/content/{mediaCode}` and a download action through `/download/{mediaCode}` only when the backend record is public and in a deliverable state. Private and signed files are not opened directly from the browser until nMedia exposes the proper authorized or signed delivery contract. Axis must never convert `fullPath`, `relativePath`, bucket keys, or storage keys into browser links.',
        },
        {
          kind: 'paragraph',
          text: 'Provider diagnostics remain a separate capability slice. They must be implemented against nMedia-owned APIs instead of frontend path logic.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Backend ownership',
          anchor: 'media-management-4-backend-ownership',
        },
        {
          kind: 'paragraph',
          text: 'nMedia is the source of truth for:',
        },
        {
          kind: 'unordered-list',
          items: [
            'media records and their original filename, stored filename, MIME type, extension, size, checksum, provider code, folder code, format code, storage key, relative path, absolute path policy, access URL, visibility/access mode, and status;',
            'media folders and their allowed file types, storage prefix, visibility/access policy, and retention policy;',
            'media formats and named variants;',
            'media sets and set entries;',
            'media references from CMS, product, import, or other backend-owned records;',
            'local, NAS, S3, Azure Blob, Google Cloud Storage, or partner provider configuration;',
            'public, private, or future signed delivery policy.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Axis uses only backend contracts. It does not calculate storage paths, expose absolute paths, infer visibility/access policy, or decide whether a media file is reusable.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'media-management-5-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Partners can customize Media Management safely by changing nMedia configuration or extending nMedia services:',
        },
        {
          kind: 'unordered-list',
          items: [
            'add a new storage provider under nMedia and register it in module configuration;',
            'override the storage-key strategy so files route to a partner-specific folder layout;',
            'add a new media folder for a business purpose, such as KYC documents, generated export files, or logistics proof-of-delivery images;',
            'add new formats for brand or storefront image requirements;',
            'extend backend APIs for governed media search, usage inspection, preview, cleanup, or provider diagnostics;',
            'add Axis renderers that consume those APIs after BackOffice publishes the corresponding navigation or operation contract.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Partners should not customize Axis by adding hardcoded menus, direct storage calls, direct database reads, raw filesystem URLs, or assumptions about local development paths. Those would create duplicate authority paths and would break cloud, NAS, or multi-provider deployments.',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Customizing storage policy safely',
          anchor: 'media-management-6-customizing-storage-policy-safely',
        },
        {
          kind: 'paragraph',
          text: 'Storage customization belongs to nMedia. A partner or project can configure the local provider for development, a mounted NAS path for enterprise deployments, or a cloud provider for production. The important contract is that Axis never needs to know the storage path. Axis only needs the returned media code and the safe delivery URL or content endpoint.',
        },
        {
          kind: 'paragraph',
          text: 'The safe extension sequence is:',
        },
        {
          kind: 'ordered-list',
          items: [
            'Add or override nMedia provider configuration.',
            'Add or override a storage-key strategy service if the folder layout must change.',
            'Add or override folder configuration for business purposes such as import files, product images, CMS banners, KYC documents, or process evidence.',
            'Expose only safe inspection metadata from nMedia when the BackOffice needs to display it.',
            'Keep provider secrets and absolute paths out of Axis, content catalog data, documentation content packs, and browser-visible responses.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'If a partner wants files under a structure like `{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`, that structure must be produced by a backend nMedia key strategy service. Axis can display the business folder and media code, but it must not assemble that path itself.',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Customizing upload behavior safely',
          anchor: 'media-management-7-customizing-upload-behavior-safely',
        },
        {
          kind: 'paragraph',
          text: 'Upload behavior is configured by nMedia folders, formats, providers, and key strategies. Axis should not be customized with file-type rules or storage folders. A partner can extend upload behavior safely by adding backend configuration such as:',
        },
        {
          kind: 'unordered-list',
          items: [
            'a new folder for a purpose like KYC documents, warranty attachments, shipment proof images, data export files, or learning resources;',
            'a new format such as storefront-thumbnail, mobile-banner, zoom-image, or compliance-document;',
            'a new provider such as NAS, S3, Azure Blob, Google Cloud Storage, FTP, or a partner document store;',
            'a new key strategy when the physical or provider-side path needs a different structure;',
            'a visibility/access policy that marks which media can be public, private, signed, or internal-only.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'After nMedia publishes the new context or folder policy, Axis can show it automatically in the upload purpose selector. If the partner needs a richer workflow, such as a product gallery uploader or CMS banner picker, that workflow should still call nMedia upload first and then create the product or CMS reference through the owning module contract.',
        },
        {
          kind: 'paragraph',
          text: 'The smallest safe Axis customization is to compose `MediaUploadWizard` inside a project-owned page or workflow and respond to its returned media code. A customer page may change surrounding copy, add a next-step panel, or route the media code to an owning Product, CMS, Import, or partner API. It must not copy the wizard into a second upload implementation, hardcode folder-to-source mappings, invent file policy, generate media records locally, infer storage paths, or bypass nMedia upload.',
        },
        {
          kind: 'paragraph',
          text: 'When customizing the wizard, keep tests focused on the boundary:',
        },
        {
          kind: 'unordered-list',
          items: [
            'generated export contexts remain excluded from manual upload unless nMedia explicitly publishes a different contract;',
            'file selection is blocked until backend policy is known;',
            'source types marked `targetRequired` by nMedia are blocked until the backend publishes the target module and schema Axis should send with upload;',
            'unsupported extensions, MIME types, and oversized files are rejected locally only as early UX warnings;',
            'successful upload calls nMedia with the backend-derived folder, format, module, and schema context;',
            'backend upload errors are shown as safe messages without exposing service internals; and',
            'local previews for images, CSV, JSON, or text remain advisory and never replace backend validation.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Verification',
          anchor: 'media-management-8-verification',
        },
        {
          kind: 'paragraph',
          text: 'When adding a Media Management feature, verify:',
        },
        {
          kind: 'ordered-list',
          items: [
            'nMedia publishes the navigation or API contract.',
            'BackOffice filters the entry by permissions.',
            'Axis renders the route only when the authenticated bootstrap contains the entry and the CMS content catalog resolves the `/media` page.',
            'Media record, folder, format, and set search use the nMedia-owned schema/workbench API and never a direct database or storage read.',
            'Storage policy inspection uses nMedia `/contexts` first, including backend-owned `sourceType`, `code`, and `aliases`, and falls back to `/storage/policy` only for older backend deployments. It does not call storage-location or upload APIs unless that workflow is explicitly being executed.',
            'Preview and download actions use nMedia delivery URLs only, never raw storage paths.',
            'Private and signed media do not show direct browser delivery actions until nMedia exposes and authorizes that delivery contract.',
            'Upload posts to nMedia `/storage/upload`; Axis does not create media records directly.',
            'Usage deep links filter the nMedia `mediaReference` schema through the generated workbench contract.',
            'Renderer coverage includes `axis.page.media-management`, `axis.template.media-management`, and `axis.component.media-management-workspace`; future media presentation changes must extend CMS properties or renderer contracts rather than adding another direct operations page.',
            'Retire and restore actions use the nMedia media schema update contract and are hidden or disabled when update is not authorized.',
            'Large media lists provide source-type, visibility, status, format, free-text search, and pagination without creating a browser-side media authority.',
            'Import/export linkage remains read-only. Axis may query nImport history by media code and show import/export media references, but it must not mutate import runs, export results, Product records, CMS records, or partner owner records through Media Management.',
            'Storage provider summaries show only safe operator metadata: active provider code, provider type, enabled/active state, health, key strategy, and delivery mode. They must not show credentials, certificates, buckets, storage keys, signed URL secrets, absolute paths, or backend-resolved full paths.',
            'Generated export files are downloaded through nMedia media-code delivery, not through export-specific browser paths or duplicate binary routes.',
            'Upload, search, reference, lifecycle, or delivery behavior stays backend-owned.',
            'Positive, negative, boundary, permission, contract, integration, and regression tests cover the new behavior.',
          ],
        },
      ],
      searchText:
        'Media Management Workspace Understand the governed Media Management navigation, route shell, backend ownership, storage and delivery boundaries, and upcoming capability slices. # Media Management Workspace\n\n## Purpose\n\nMedia Management gives BackOffice users a single place to work with files that\nNodics stores through the framework media lifecycle. A media file can be an\nimport spreadsheet, a CMS banner image, a product gallery image, a product\nthumbnail, a PDF document, or another governed file that a business process\nneeds to keep and reference.\n\nAxis does not own media storage. The backend `nMedia` module owns media\nmetadata, folders, formats, sets, references, storage provider selection,\nstorage-key generation, upload validation, access policy, and content delivery.\nAxis only renders the employee workspace that is returned by the BackOffice\nnavigation contract.\n\nIn the Axis UI, the word **Visibility** is used for the backend media access\npolicy. Visibility answers a business question: "who can safely open this\nfile?" It does not mean database permission and it does not mean the employee\'s\nBackOffice role. For example, data import and data export files are normally\nprivate, while approved CMS or product assets may become public or signed later.\n\n## Navigation\n\nThe left navigation group is **Media Management**. It is published by nMedia\nthrough `backofficeCapabilities.media.navigation`, not hardcoded in Axis. The\ncurrent first slice exposes these entries:\n\n- **Media** for uploaded media records.\n- **Media Folders** for purpose-based folders such as import sources, data\n  export files, CMS assets, product assets, and utility files.\n- **Media Sets** for groups of related media variants, such as a product image\n  gallery or responsive CMS image set.\n- **Media Formats** for reusable formats such as original, thumbnail, mobile,\n  desktop, zoom, and import file.\n- **Media Usage** for finding which product, CMS, import, or business record is\n  referencing a media item.\n- **Storage and Delivery** for provider policy, visibility, and delivery\n  behavior.\n\nThese entries appear only when BackOffice returns them for the authenticated\nemployee. Axis must not show a duplicate static media menu when the backend does\nnot authorize it.\n\n## Implemented Axis behavior\n\nThe implemented browser route is `/media/*`, but page composition is\nowned by the authenticated Axis CMS content catalog route at\n`/media`. The catalog maps `axis.page.media-management` to the Axis\npage renderer, `axis.template.media-management` to the template renderer, and\n`axis.component.media-management-workspace` to the reusable workspace component\nrenderer. The renderer reads the current browser location and backend-published\nnavigation to make each section route meaningful:\n\n- `/media` explains the full governed media operations area.\n- `/media/items` explains uploaded media records.\n- `/media/folders` explains media folder policy.\n- `/media/sets` explains logical media sets and variants.\n- `/media/formats` explains reusable presentation or processing\n  formats.\n- `/media/usage` explains media references and usage tracing.\n- `/media/storage-delivery` explains provider policy and delivery\n  behavior.\n\nThe active section shows three beginner-friendly blocks:\n\n1. the backend owner or model that remains authoritative;\n2. what the employee workspace can safely show now;\n3. the next capability slices that will make the section operational.\n\nThe route uses the same employee session, screen-lock, runtime bootstrap,\nleft-nav, CMS renderer boundary, and authorization gates as the rest of Axis.\nAxis must not mount Media Management as a direct operations page that bypasses\nthe content catalog and renderer registry.\n\nThe **Media** section now includes an operational media record workspace. Axis\ndiscovers the `media` schema through the same generated Schema Workbench\ncontract used by the Business Data workbench, then searches records through the\nowning nMedia module connection. The screen shows safe business metadata such as\nmedia code, original filename, folder, format, visibility, lifecycle status,\nMIME type, extension, size, checksum, checksum algorithm, and provider. Normal\nbusiness detail panels do not expose provider storage keys or backend-resolved\nfull paths.\n\nThe media list is designed to scale beyond the small local-development list.\nBusiness users can narrow media records by:\n\n- **Source type**, which is the business purpose published by nMedia context\n  metadata or, for older backend deployments, derived from backend folder\n  metadata. Examples include data imports, data exports, product media, content\n  media, business documents, or utility media;\n- **Visibility**, such as private, public, or future signed delivery;\n- **Status**, such as ready, consumed, retired, or failed;\n- **Format**, such as import file, original, thumbnail, desktop, mobile, or a\n  partner-defined format;\n- free-text search across safe metadata such as code, filename, folder, format,\n  status, MIME type, and extension.\n\nAxis sends search text, queryable source-type/facet selections, page number,\npage size, and the schema default sort to nMedia through the generated\nSchema Workbench record contract. The table count comes from the backend\n`totalCount`, not from a browser-side full-record load. Axis only renders\nfilters when the active schema advertises the corresponding safe filter field\nand operator. Source type is mapped to backend folder codes from `/contexts`,\nthen passed as a `folderCode` filter when the media schema allows it. This keeps\nlarge media libraries scalable while preserving nMedia as the only authority for\nrecord retrieval, filtering, storage, and delivery. Axis must not create a\nbrowser-only media index or read storage folders directly.\n\nThe same section also supports governed upload. The employee selects an upload\npurpose, such as data imports, content media, product media, or utility media.\nAxis first asks nMedia for backend-owned media source contexts through\n`/contexts`. The context response tells Axis which source types are eligible\nfor manual upload, which compatibility aliases identify the same source type,\nwhich folders and formats they use, and which route template can be shown to\nthe employee. Axis treats backend `sourceType`, `code`, and `aliases` as the\nauthority for source-type mapping. Regex-style browser guessing is only an\nolder-backend fallback when `/contexts` is unavailable. If an older backend does\nnot publish contexts, Axis falls back to the older `/storage/policy` folder\nprobes. Data exports are not shown as a manual-upload source type by default\nbecause export files are generated by the Exports workspace. When the employee\nuploads a file, Axis posts multipart data to the nMedia `/storage/upload`\nendpoint. nMedia validates the folder, file type, size, checksum, provider, and\nstorage key. Axis receives the returned media code and refreshes the media list.\nAxis does not choose the filesystem folder, does not generate the storage key,\nand does not persist\nmedia metadata directly.\n\nThe upload UI is implemented as the reusable `MediaUploadWizard` component under\nMedia Management operations. The wizard keeps the interaction layered:\n\n1. select a backend-published source type;\n2. show the resolved nMedia folder, format, route template, extension policy,\n   MIME policy, and max-size policy;\n3. show the backend-published target module and schema when a source type\n   requires target context;\n4. keep file selection disabled until a valid source type, policy, and required\n   target context are known;\n5. let the employee choose a local file;\n6. show a browser-only review; and\n7. submit the file to nMedia and call the parent refresh callback after a media\n   code is returned.\n\nThe browser-only review is intentionally advisory. Axis may show local metadata\nthat helps an employee catch obvious mistakes before upload, including file\nsize, MIME type, extension, image dimensions, a thumbnail for image files, CSV\nheaders and row count, JSON top-level shape, and a small text preview. These\nsignals are not business validation. nMedia still validates upload policy, and\nthe owning module, such as nImport, Product, CMS, or a partner module, still\nvalidates business content after it receives the media code.\n\nMedia detail includes three operational checks:\n\n1. **Delivery preview** uses the nMedia content endpoint only when the media is\n   public and in a deliverable lifecycle state.\n2. **Usage summary** checks nMedia `mediaReference` records for the selected\n   media code and links to `/media/usage?mediaCode=...` so the\n   employee can review where the file is used.\n3. **Lifecycle actions** expose retire or restore actions only when the\n   generated media schema allows update for the employee session. Axis blocks\n   retire when active usage references are visible, because a business user\n   should review dependencies before making a file inactive.\n\nThe **Media Folders** section uses the same backend-owned pattern. Axis\ndiscovers the `mediaFolder` schema from nMedia, searches folder records through\nthe nMedia module connection, and presents folder policy in business-friendly\nlanguage. It shows the folder code, name, description, storage prefix,\nvisibility/access mode, allowed extensions, allowed MIME types, maximum file\nsize, and retention days. This helps administrators understand where import\nfiles, data export files, CMS assets, product assets, and utility documents are\nrouted without making Axis own storage rules.\n\nWhen an employee selects a folder, Axis shows a policy-impact warning. The\nwarning explains that changes to the folder policy affect future upload\nvalidation, default visibility, retention, and provider-relative routing. It\nalso repeats the boundary: provider secrets, raw paths, and alternate\nbrowser-side upload rules must not be added to Axis.\n\nFolder policy editing is intentionally nMedia-owned. If the discovered\n`mediaFolder` schema does not advertise update permission for the employee\nsession, Axis shows the policy as read-only and directs administrators back to\nbackend-approved media configuration. When update is advertised, Axis exposes a\nsmall policy action panel for visibility, maximum upload size, and retention\ndays. The panel submits only those fields through the nMedia folder policy\noperation, so future upload validation uses the same backend authority. Axis\ndoes not edit storage prefixes, resolved paths, provider secrets, provider\nconfiguration, or browser-side policy rules. nMedia remains responsible for\nvalidation, routing, provider behavior, tenant policy, and persistence.\n\nMedia Management may link to Schema Workbench for generic `mediaFolder` record\ninspection, search, audit, or seed-data workflows instead of duplicating the\ngeneric record form. The handoff URL is\n`/schema-workbench?module=media&schema=mediaFolder`; when the backend advertises\ncreate permission, Axis may also link to\n`/schema-workbench?module=media&schema=mediaFolder&mode=create`. Those links do\nnot replace the nMedia policy operation for live upload-policy changes unless a\ndeployment explicitly synchronizes generated records into effective\nconfiguration through nMedia-owned governance.\n\nThe **Media Formats** section is also operational. Axis discovers the\n`mediaFormat` schema from nMedia and shows reusable presentation or processing\nformats such as original, thumbnail, desktop, mobile, zoom, or import file. The\nscreen presents format code, name, purpose, family, lifecycle status,\ndescription, width, height, and a combined dimensions view. Formats help backend\nand frontend teams use consistent business vocabulary for media variants without\nmaking Axis transform images or own storefront rendering behavior.\n\nFormat detail also asks nMedia for `/contexts` and shows where the selected\nformat is advertised. This answers questions such as "which folders/source\ntypes can use desktop?" without hardcoding source-type behavior in Axis. A\nformat can be default, allowed, both, or unused by the current backend context\nconfiguration. The live upload authority remains nMedia format policy; Schema\nWorkbench records are useful for inspection and audit, not a second browser\npolicy authority.\n\nThe **Media Sets** section now lists and searches logical media groups from the\n`mediaSet` schema. A media set represents one logical asset group, such as a\nproduct gallery, responsive CMS image group, documentation asset group, or mixed\nfile bundle. Axis shows the set code, name, description, media type, business\npurpose, and lifecycle status.\n\nWhen an employee selects a media set, Axis also loads the set composition from\nthe nMedia-owned `mediaSetEntry` schema. The detail panel shows each linked\nvariant with its media code, optional format code, variant role, locale,\nchannel, device, breakpoint, fallback entry, dimensions, position, primary\nflag, and lifecycle status. This keeps the business view clear: the set\ndescribes the logical group, each entry describes a specific reusable variant,\nand each variant still points to an owned media record. Axis does not duplicate\nvariant ownership or infer image behavior; it asks nMedia for the set entries\nusing a backend filter on the selected set code.\n\nSet-entry actions call nMedia-owned endpoints under\n`/sets/{mediaSetCode}/entries`. Axis can reorder entries, mark one entry as\nprimary, remove an entry from the set, and hand off full create/edit record\nworkflows to Schema Workbench. These actions intentionally do not update\nProduct, CMS, import, export, or partner business records. Those modules decide\nwhere a media set is used; nMedia manages the reusable media grouping and\nvariant metadata.\n\nThe **Media Usage** section now searches the nMedia `mediaReference` schema. A\nmedia reference answers the business question, "where is this file or media set\nbeing used?" without moving ownership away from the source module. For example,\na product record may reference a product gallery, a CMS component may reference\na banner image, or an import process may reference the uploaded source file.\nAxis shows the owner module, owner schema, owner record code, relation type,\nmedia code, media set code, position, and lifecycle status.\n\nWhen the route receives a `mediaCode` query parameter, Axis filters the usage\nworkspace to that media item. This gives Media detail a safe deep link into\nusage without inventing a second search endpoint. The filter still runs through\nnMedia\'s generated schema/workbench contract.\n\nUsage can also be filtered by owner module, owner schema, owner record, relation\ntype, and status when the backend schema advertises those fields as queryable.\nThe owner-record filter is useful when a business user already knows the\nProduct, CMS, import, export, or partner record that may be holding a reference.\n\nThis is not analytics usage and it is not a duplicate product or CMS editor.\nnMedia owns only the media reference trace. The product, CMS, import, or partner\nmodule continues to own the business record and its validation rules. This\nseparation lets administrators safely answer cleanup questions such as "can this\nfile be retired?" before removing or retiring media that may still be attached\nto another business object.\n\nMedia detail also includes an **Import/export linkage** panel. The panel is\nread-only. It asks nImport for run history with the selected `mediaCode` and\nshows any matching import runs, counts, status, data type, and modules. It also\nsummarizes import/export `mediaReference` traces when they exist. Axis does not\nedit the import run, export result, Product record, CMS record, or partner\nrecord from this panel; it links the employee to the owning Import/Export\nworkspace for deeper work. Export status remains owned by nExport and should be\nsurfaced only through nExport-published contracts.\n\nThe **Storage and Delivery** section now provides a read-only policy inspection\nview. Axis first calls the nMedia `/contexts` API and derives safe folder\npolicy rows from the backend-owned context projection, including backend-owned\nsource type aliases. For older backend deployments that do not yet publish\ncontexts, Axis falls back to the\n`/storage/policy` API with small safe probe descriptors for known folder\npurposes. The result shows folder-level upload rules: folder code, business\nlabel, visibility, allowed extensions, allowed MIME types, maximum file size,\nand checksum algorithm.\n\nThe same screen also calls `/storage/providers/summary` when the backend\npublishes it. That summary is deliberately safe: active provider code, provider\ntype, enabled/active flags, provider health status, key strategy name, and\ndelivery mode. It does not expose absolute filesystem paths, bucket names,\ncertificates, credentials, object keys, or signed URL secrets. Axis does not\ncall the storage-location endpoint, does not generate storage keys, and does\nnot offer provider credential controls. nMedia still decides whether a folder\nuses local storage, NAS, S3, Azure, Google Cloud Storage, FTP, or a partner\nprovider.\n\nFor a beginner developer, this means:\n\n1. Axis asks nMedia, "which media source contexts and folder policies are safe\n   for this employee workspace?"\n2. nMedia returns safe context and upload-policy metadata without provider\n   secrets or raw paths.\n3. Axis optionally asks nMedia for the safe storage provider summary and shows\n   only provider code, type, health, delivery, and key-strategy metadata.\n4. Axis displays only the safe context, policy, and provider summary metadata.\n5. When a real upload happens, Axis sends the selected file to nMedia.\n6. nMedia resolves provider and storage location, creates the media record, and\n   returns the media code.\n7. When a file is opened, Axis uses the nMedia content delivery endpoint with\n   the media code instead of a raw file path.\n\nFor example, an import CSV is uploaded under the `importSources` purpose. A\ngenerated export CSV or ZIP is stored under the `exportFiles` purpose. A CMS\nbanner image is uploaded under the `cmsAssets` purpose. A product gallery image\nis uploaded under the `productAssets` purpose. They may all use the same local\nprovider in local development, but production can route them differently through\nnMedia configuration without changing Axis.\n\nFor single-schema data operations, nMedia uses separate provider-relative data\npaths for imports and exports:\n\n- import files:\n  `data/import/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;\n- generated export files:\n  `data/export/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.\n\nAxis may display the business purpose and media code, but it must not assemble\nor persist these paths itself. Multi-schema aggregated exports will need their\nown backend-owned path contract later.\n\nFor business media operations, nMedia uses separate provider-relative media\npaths by purpose:\n\n- product media:\n  `media/product/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;\n- content media:\n  `media/content/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`;\n- utility media:\n  `media/utility/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`.\n\nAxis can present these as Product media, Content media, and Utility media\nfilters, but the backend folder configuration and key strategy remain the only\nauthority for the actual storage key.\n\nAxis deliberately does not display backend-resolved full paths. If a file can be\nopened inline, the UI uses the nMedia content endpoint, not a filesystem path.\nIf a file is downloaded, Axis uses the nMedia download endpoint\n`/download/{mediaCode}` so backend content-disposition and authorization policy\nremain in charge. This keeps local storage, NAS, cloud storage, and future\nsigned URL providers behind the backend media contract.\n\nThe **Media** record detail view follows the same rule. When a selected media\nrecord is a public image in a deliverable lifecycle state, Axis can render a\nsmall preview by calling the nMedia content delivery URL. For other file types,\nAxis offers an open action through `/content/{mediaCode}` and a download action\nthrough `/download/{mediaCode}` only when the backend record is public and in a\ndeliverable state. Private and signed files are not opened directly from the\nbrowser until nMedia exposes the proper authorized or signed delivery contract.\nAxis must never convert `fullPath`, `relativePath`, bucket keys, or storage keys\ninto browser links.\n\nProvider diagnostics remain a separate capability slice. They must be\nimplemented against nMedia-owned APIs instead of frontend path logic.\n\n## Backend ownership\n\nnMedia is the source of truth for:\n\n- media records and their original filename, stored filename, MIME type,\n  extension, size, checksum, provider code, folder code, format code, storage\n  key, relative path, absolute path policy, access URL, visibility/access mode,\n  and status;\n- media folders and their allowed file types, storage prefix, visibility/access\n  policy, and retention policy;\n- media formats and named variants;\n- media sets and set entries;\n- media references from CMS, product, import, or other backend-owned records;\n- local, NAS, S3, Azure Blob, Google Cloud Storage, or partner provider\n  configuration;\n- public, private, or future signed delivery policy.\n\nAxis uses only backend contracts. It does not calculate storage paths, expose\nabsolute paths, infer visibility/access policy, or decide whether a media file is\nreusable.\n\n## Customize and extend safely\n\nPartners can customize Media Management safely by changing nMedia configuration\nor extending nMedia services:\n\n- add a new storage provider under nMedia and register it in module\n  configuration;\n- override the storage-key strategy so files route to a partner-specific folder\n  layout;\n- add a new media folder for a business purpose, such as KYC documents,\n  generated export files, or logistics proof-of-delivery images;\n- add new formats for brand or storefront image requirements;\n- extend backend APIs for governed media search, usage inspection, preview,\n  cleanup, or provider diagnostics;\n- add Axis renderers that consume those APIs after BackOffice publishes the\n  corresponding navigation or operation contract.\n\nPartners should not customize Axis by adding hardcoded menus, direct storage\ncalls, direct database reads, raw filesystem URLs, or assumptions about local\ndevelopment paths. Those would create duplicate authority paths and would break\ncloud, NAS, or multi-provider deployments.\n\n### Customizing storage policy safely\n\nStorage customization belongs to nMedia. A partner or project can configure the\nlocal provider for development, a mounted NAS path for enterprise deployments,\nor a cloud provider for production. The important contract is that Axis never\nneeds to know the storage path. Axis only needs the returned media code and the\nsafe delivery URL or content endpoint.\n\nThe safe extension sequence is:\n\n1. Add or override nMedia provider configuration.\n2. Add or override a storage-key strategy service if the folder layout must\n   change.\n3. Add or override folder configuration for business purposes such as import\n   files, product images, CMS banners, KYC documents, or process evidence.\n4. Expose only safe inspection metadata from nMedia when the BackOffice needs to\n   display it.\n5. Keep provider secrets and absolute paths out of Axis, content catalog data,\n   documentation content packs, and browser-visible responses.\n\nIf a partner wants files under a structure like\n`{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}`, that\nstructure must be produced by a backend nMedia key strategy service. Axis can\ndisplay the business folder and media code, but it must not assemble that path\nitself.\n\n### Customizing upload behavior safely\n\nUpload behavior is configured by nMedia folders, formats, providers, and key\nstrategies. Axis should not be customized with file-type rules or storage\nfolders. A partner can extend upload behavior safely by adding backend\nconfiguration such as:\n\n- a new folder for a purpose like KYC documents, warranty attachments, shipment\n  proof images, data export files, or learning resources;\n- a new format such as storefront-thumbnail, mobile-banner, zoom-image, or\n  compliance-document;\n- a new provider such as NAS, S3, Azure Blob, Google Cloud Storage, FTP, or a\n  partner document store;\n- a new key strategy when the physical or provider-side path needs a different\n  structure;\n- a visibility/access policy that marks which media can be public, private,\n  signed, or internal-only.\n\nAfter nMedia publishes the new context or folder policy, Axis can show it\nautomatically in the upload purpose selector. If the partner needs a richer\nworkflow, such as a product gallery uploader or CMS banner picker, that workflow\nshould still call nMedia upload first and then create the product or CMS\nreference through the owning module contract.\n\nThe smallest safe Axis customization is to compose `MediaUploadWizard` inside a\nproject-owned page or workflow and respond to its returned media code. A customer\npage may change surrounding copy, add a next-step panel, or route the media code\nto an owning Product, CMS, Import, or partner API. It must not copy the wizard\ninto a second upload implementation, hardcode folder-to-source mappings, invent\nfile policy, generate media records locally, infer storage paths, or bypass\nnMedia upload.\n\nWhen customizing the wizard, keep tests focused on the boundary:\n\n- generated export contexts remain excluded from manual upload unless nMedia\n  explicitly publishes a different contract;\n- file selection is blocked until backend policy is known;\n- source types marked `targetRequired` by nMedia are blocked until the backend\n  publishes the target module and schema Axis should send with upload;\n- unsupported extensions, MIME types, and oversized files are rejected locally\n  only as early UX warnings;\n- successful upload calls nMedia with the backend-derived folder, format,\n  module, and schema context;\n- backend upload errors are shown as safe messages without exposing service\n  internals; and\n- local previews for images, CSV, JSON, or text remain advisory and never\n  replace backend validation.\n\n## Verification\n\nWhen adding a Media Management feature, verify:\n\n1. nMedia publishes the navigation or API contract.\n2. BackOffice filters the entry by permissions.\n3. Axis renders the route only when the authenticated bootstrap contains the\n   entry and the CMS content catalog resolves the `/media` page.\n4. Media record, folder, format, and set search use the nMedia-owned\n   schema/workbench API and never a direct database or storage read.\n5. Storage policy inspection uses nMedia `/contexts` first, including\n   backend-owned `sourceType`, `code`, and `aliases`, and falls back to\n   `/storage/policy` only for older backend deployments. It does not call\n   storage-location or upload APIs unless that workflow is explicitly being\n   executed.\n6. Preview and download actions use nMedia delivery URLs only, never raw storage\n   paths.\n7. Private and signed media do not show direct browser delivery actions until\n   nMedia exposes and authorizes that delivery contract.\n8. Upload posts to nMedia `/storage/upload`; Axis does not create media records\n   directly.\n9. Usage deep links filter the nMedia `mediaReference` schema through the\n   generated workbench contract.\n10. Renderer coverage includes `axis.page.media-management`,\n    `axis.template.media-management`, and\n    `axis.component.media-management-workspace`; future media presentation\n    changes must extend CMS properties or renderer contracts rather than\n    adding another direct operations page.\n11. Retire and restore actions use the nMedia media schema update contract and\n    are hidden or disabled when update is not authorized.\n12. Large media lists provide source-type, visibility, status, format, free-text\n    search, and pagination without creating a browser-side media authority.\n13. Import/export linkage remains read-only. Axis may query nImport history by\n    media code and show import/export media references, but it must not mutate\n    import runs, export results, Product records, CMS records, or partner owner\n    records through Media Management.\n14. Storage provider summaries show only safe operator metadata: active\n    provider code, provider type, enabled/active state, health, key strategy,\n    and delivery mode. They must not show credentials, certificates, buckets,\n    storage keys, signed URL secrets, absolute paths, or backend-resolved full\n    paths.\n15. Generated export files are downloaded through nMedia media-code delivery,\n    not through export-specific browser paths or duplicate binary routes.\n16. Upload, search, reference, lifecycle, or delivery behavior stays\n    backend-owned.\n17. Positive, negative, boundary, permission, contract, integration, and\n    regression tests cover the new behavior.\n',
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/media-management.md',
        evidence: 'content/documentation/pages/media-management.md',
        hash: '198e486b7bfa138e395124d557ea83381dff3532c611bc224ef97a1ea54d3e17',
        version: '0.3.19',
      },
      previous: {
        title: 'Imports and Exports Workspace',
        route: '/docs/nodics-axis/imports-exports',
      },
      next: {
        title: 'Axis Feature Delivery Checklist',
        route: '/docs/nodics-axis/feature-delivery',
      },
    },
    active: true,
  },
  record13: {
    code: 'axisDocsComponentfeaturedelivery',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.feature-delivery',
      title: 'Axis Feature Delivery Checklist',
      route: '/docs/nodics-axis/feature-delivery',
      section: 'contribute-to-axis',
      sectionTitle: 'Contribute to Axis',
      category: 'Contribute to Axis',
      audience: ['developer', 'architect', 'framework-maintainer', 'ai-tool'],
      summary:
        'Apply repository-boundary, reuse, security, interaction, contract-testing, documentation, partial-discovery, and completion gates.',
      headings: [
        {
          text: '1. Repository boundary',
          anchor: 'feature-delivery-1-1-repository-boundary',
          level: 2,
        },
        {
          text: '2. Reuse and dependency check',
          anchor: 'feature-delivery-2-2-reuse-and-dependency-check',
          level: 2,
        },
        {
          text: '3. Security and privacy',
          anchor: 'feature-delivery-3-3-security-and-privacy',
          level: 2,
        },
        {
          text: '4. Interaction quality',
          anchor: 'feature-delivery-4-4-interaction-quality',
          level: 2,
        },
        {
          text: '5. Contract tests',
          anchor: 'feature-delivery-5-5-contract-tests',
          level: 2,
        },
        {
          text: '6. Documentation placement',
          anchor: 'feature-delivery-6-6-documentation-placement',
          level: 2,
        },
        {
          text: '7. Partial-discovery and use-case proof',
          anchor: 'feature-delivery-7-7-partial-discovery-and-use-case-proof',
          level: 2,
        },
        {
          text: '8. Completion evidence',
          anchor: 'feature-delivery-8-8-completion-evidence',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'feature-delivery-9-customize-and-extend-safely',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Use this checklist for every implemented Axis feature. Complete the ownership analysis before changing source and retain evidence in the pull request or delivery record.',
        },
        {
          kind: 'heading',
          level: 2,
          text: '1. Repository boundary',
          anchor: 'feature-delivery-1-1-repository-boundary',
        },
        {
          kind: 'paragraph',
          text: 'Record:',
        },
        {
          kind: 'unordered-list',
          items: [
            'the authoritative Nodics module and backend contract;',
            'the Axis route, feature, or component that consumes it;',
            'the contract version or supported range;',
            'the authentication and authorization boundary;',
            'the tenant, enterprise, application, Site, Store, locale, channel, and module context involved;',
            'backend changes required in `nodics`, if any;',
            'Axis changes required in this repository;',
            'documentation and tests owned by each repository.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Stop when ownership is ambiguous. Do not move backend business behavior into Axis to avoid defining a backend contract.',
        },
        {
          kind: 'heading',
          level: 2,
          text: '2. Reuse and dependency check',
          anchor: 'feature-delivery-2-2-reuse-and-dependency-check',
        },
        {
          kind: 'paragraph',
          text: 'Confirm:',
        },
        {
          kind: 'unordered-list',
          items: [
            'an existing Axis component, hook, client, state pattern, or test utility was considered first;',
            'an existing Nodics API, schema, permission, workflow, publishing, cache, search, import, or export authority is reused;',
            'no second registry, loader, schema authority, workflow engine, publisher, context authority, or provider integration is introduced;',
            'any new dependency has documented bundle, maintenance, security, accessibility, browser, WebView, and licensing impact.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: '3. Security and privacy',
          anchor: 'feature-delivery-3-3-security-and-privacy',
        },
        {
          kind: 'paragraph',
          text: 'Confirm:',
        },
        {
          kind: 'unordered-list',
          items: [
            'target modules independently authorize every request;',
            'UI filtering is not treated as authorization;',
            'passwords, access tokens, refresh tokens, cookies, internal credentials, and secrets are absent from browser storage, URLs, logs, and telemetry;',
            'errors and telemetry contain safe correlation data without sensitive payloads;',
            'query keys and caches cannot cross users or validated contexts;',
            'logout, revocation, and context switching cancel requests and clear affected data;',
            'CMS or another module cannot supply executable browser code.',
            'configurable business-facing labels, help text, placeholders, empty states, action captions, and content fragments come from typed CMS properties rather than renderer literals;',
            'domain errors retain stable backend codes and safe messages, while generic Axis fallbacks are limited to browser and transport failures;',
            'locale, direction, translated text expansion, and locale-aware formatting are covered without creating a second translation authority in Axis;',
            'arbitrary HTML, CSS, JavaScript, expressions, event handlers, and remote renderer imports are rejected.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: '4. Interaction quality',
          anchor: 'feature-delivery-4-4-interaction-quality',
        },
        {
          kind: 'paragraph',
          text: 'Implement and verify applicable:',
        },
        {
          kind: 'unordered-list',
          items: [
            'loading, success, empty, unavailable, unauthorized, incompatible, validation, conflict, partial-failure, and recovery states;',
            'keyboard operation and visible focus;',
            'screen-reader names, roles, states, and announcements;',
            'responsive desktop, tablet, and mobile WebView layouts;',
            'long translated labels, right-to-left direction, locale fallback, and locale-aware dates, numbers, currency, and pluralization where applicable;',
            'touch target sizing and non-hover alternatives;',
            'reduced motion;',
            'the fixed comfortable workspace density;',
            'light and dark token compatibility;',
            'safe cancellation and stale-response prevention.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: '5. Contract tests',
          anchor: 'feature-delivery-5-5-contract-tests',
        },
        {
          kind: 'paragraph',
          text: 'Cover applicable:',
        },
        {
          kind: 'unordered-list',
          items: [
            'positive behavior;',
            'invalid input and malformed response;',
            'permission and cross-tenant denial;',
            'minimum, maximum, empty, timeout, and payload boundaries;',
            'supported, degraded, incompatible, missing, and unknown contract versions;',
            'cancellation, retry, idempotency, and concurrency;',
            'backend outage and recovery;',
            'responsive and accessibility behavior;',
            'integration with `monoServer` and later distributed module topology;',
            'regression of the static recovery shell.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'UI tests prove client behavior only. Backend authorization, validation, persistence, workflow, publication, and integration tests belong in `nodics`.',
        },
        {
          kind: 'heading',
          level: 2,
          text: '6. Documentation placement',
          anchor: 'feature-delivery-6-6-documentation-placement',
        },
        {
          kind: 'paragraph',
          text: 'Update this repository for implemented:',
        },
        {
          kind: 'unordered-list',
          items: [
            'installation, build, start, and deployment behavior;',
            'runtime configuration consumed by Axis;',
            'frontend architecture and contribution rules;',
            'browser routes, interaction, accessibility, responsive behavior, and troubleshooting;',
            'frontend verification commands.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Update `nodics` for implemented:',
        },
        {
          kind: 'unordered-list',
          items: [
            'business-user and administrator journeys;',
            'backend architecture, configuration, permissions, APIs, schemas, workflows, publication, integration, security, and operations;',
            'customization and override guidance;',
            'backend tests and deployment evidence.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Keep proposals, unresolved decisions, and future action lists only in the temporary ignored planning workspace. Do not document planned UI as available product behavior.',
        },
        {
          kind: 'heading',
          level: 2,
          text: '7. Partial-discovery and use-case proof',
          anchor: 'feature-delivery-7-7-partial-discovery-and-use-case-proof',
        },
        {
          kind: 'paragraph',
          text: 'Confirm that a contributor or AI tool opening only the nearest maintained files can identify:',
        },
        {
          kind: 'unordered-list',
          items: [
            'whether behavior belongs in Axis or Nodics;',
            'the owning feature, route, component, hook, client, contract, and test;',
            'the supported extension point and prohibited bypass;',
            'backend authority and permission expectations;',
            'accessibility, responsive, WebView, security, and recovery requirements;',
            'the focused verification command.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Document successful, unauthorized/invalid, boundary/responsive, failure/recovery, and supported customization examples with expected outcomes. Link Nodics-owned business and backend guidance rather than copying it into Axis.',
        },
        {
          kind: 'heading',
          level: 2,
          text: '8. Completion evidence',
          anchor: 'feature-delivery-8-8-completion-evidence',
        },
        {
          kind: 'paragraph',
          text: 'Before marking the feature complete:',
        },
        {
          kind: 'unordered-list',
          items: [
            'link the implemented source and contract;',
            'link focused test evidence;',
            'link permanent documentation for every applicable audience;',
            'explain any audience or operational layer that is not applicable;',
            'run `npm run verify`;',
            'record known limitations and safe fallback behavior;',
            'confirm the action-plan status reflects repository and test evidence.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'feature-delivery-9-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'For every delivered feature, name the later project-owned page, component, renderer, typed client, hook, configuration, or style extension point. Include the smallest working file map and example, the backend contract that remains authoritative, prohibited browser-side shortcuts, upgrade and rollback impact, and the focused positive, rejected, boundary, integration, regression, and production-build tests.',
        },
        {
          kind: 'paragraph',
          text: 'A checklist that records only the shipped OOTB behavior is incomplete. If no safe extension point exists, record that limitation explicitly rather than suggesting that a framework file should be edited.',
        },
      ],
      searchText:
        'Axis Feature Delivery Checklist Apply repository-boundary, reuse, security, interaction, contract-testing, documentation, partial-discovery, and completion gates. # Axis Feature Delivery Checklist\n\nUse this checklist for every implemented Axis feature. Complete the ownership\nanalysis before changing source and retain evidence in the pull request or\ndelivery record.\n\n## 1. Repository boundary\n\nRecord:\n\n- the authoritative Nodics module and backend contract;\n- the Axis route, feature, or component that consumes it;\n- the contract version or supported range;\n- the authentication and authorization boundary;\n- the tenant, enterprise, application, Site, Store, locale, channel, and module\n  context involved;\n- backend changes required in `nodics`, if any;\n- Axis changes required in this repository;\n- documentation and tests owned by each repository.\n\nStop when ownership is ambiguous. Do not move backend business behavior into\nAxis to avoid defining a backend contract.\n\n## 2. Reuse and dependency check\n\nConfirm:\n\n- an existing Axis component, hook, client, state pattern, or test utility was\n  considered first;\n- an existing Nodics API, schema, permission, workflow, publishing, cache,\n  search, import, or export authority is reused;\n- no second registry, loader, schema authority, workflow engine, publisher,\n  context authority, or provider integration is introduced;\n- any new dependency has documented bundle, maintenance, security,\n  accessibility, browser, WebView, and licensing impact.\n\n## 3. Security and privacy\n\nConfirm:\n\n- target modules independently authorize every request;\n- UI filtering is not treated as authorization;\n- passwords, access tokens, refresh tokens, cookies, internal credentials, and\n  secrets are absent from browser storage, URLs, logs, and telemetry;\n- errors and telemetry contain safe correlation data without sensitive\n  payloads;\n- query keys and caches cannot cross users or validated contexts;\n- logout, revocation, and context switching cancel requests and clear affected\n  data;\n- CMS or another module cannot supply executable browser code.\n- configurable business-facing labels, help text, placeholders, empty states,\n  action captions, and content fragments come from typed CMS properties rather\n  than renderer literals;\n- domain errors retain stable backend codes and safe messages, while generic\n  Axis fallbacks are limited to browser and transport failures;\n- locale, direction, translated text expansion, and locale-aware formatting\n  are covered without creating a second translation authority in Axis;\n- arbitrary HTML, CSS, JavaScript, expressions, event handlers, and remote\n  renderer imports are rejected.\n\n## 4. Interaction quality\n\nImplement and verify applicable:\n\n- loading, success, empty, unavailable, unauthorized, incompatible, validation,\n  conflict, partial-failure, and recovery states;\n- keyboard operation and visible focus;\n- screen-reader names, roles, states, and announcements;\n- responsive desktop, tablet, and mobile WebView layouts;\n- long translated labels, right-to-left direction, locale fallback, and\n  locale-aware dates, numbers, currency, and pluralization where applicable;\n- touch target sizing and non-hover alternatives;\n- reduced motion;\n- the fixed comfortable workspace density;\n- light and dark token compatibility;\n- safe cancellation and stale-response prevention.\n\n## 5. Contract tests\n\nCover applicable:\n\n- positive behavior;\n- invalid input and malformed response;\n- permission and cross-tenant denial;\n- minimum, maximum, empty, timeout, and payload boundaries;\n- supported, degraded, incompatible, missing, and unknown contract versions;\n- cancellation, retry, idempotency, and concurrency;\n- backend outage and recovery;\n- responsive and accessibility behavior;\n- integration with `monoServer` and later distributed module topology;\n- regression of the static recovery shell.\n\nUI tests prove client behavior only. Backend authorization, validation,\npersistence, workflow, publication, and integration tests belong in `nodics`.\n\n## 6. Documentation placement\n\nUpdate this repository for implemented:\n\n- installation, build, start, and deployment behavior;\n- runtime configuration consumed by Axis;\n- frontend architecture and contribution rules;\n- browser routes, interaction, accessibility, responsive behavior, and\n  troubleshooting;\n- frontend verification commands.\n\nUpdate `nodics` for implemented:\n\n- business-user and administrator journeys;\n- backend architecture, configuration, permissions, APIs, schemas, workflows,\n  publication, integration, security, and operations;\n- customization and override guidance;\n- backend tests and deployment evidence.\n\nKeep proposals, unresolved decisions, and future action lists only in the\ntemporary ignored planning workspace. Do not document planned UI as available\nproduct behavior.\n\n## 7. Partial-discovery and use-case proof\n\nConfirm that a contributor or AI tool opening only the nearest maintained files\ncan identify:\n\n- whether behavior belongs in Axis or Nodics;\n- the owning feature, route, component, hook, client, contract, and test;\n- the supported extension point and prohibited bypass;\n- backend authority and permission expectations;\n- accessibility, responsive, WebView, security, and recovery requirements;\n- the focused verification command.\n\nDocument successful, unauthorized/invalid, boundary/responsive,\nfailure/recovery, and supported customization examples with expected outcomes.\nLink Nodics-owned business and backend guidance rather than copying it into\nAxis.\n\n## 8. Completion evidence\n\nBefore marking the feature complete:\n\n- link the implemented source and contract;\n- link focused test evidence;\n- link permanent documentation for every applicable audience;\n- explain any audience or operational layer that is not applicable;\n- run `npm run verify`;\n- record known limitations and safe fallback behavior;\n- confirm the action-plan status reflects repository and test evidence.\n\n## Customize and extend safely\n\nFor every delivered feature, name the later project-owned page, component,\nrenderer, typed client, hook, configuration, or style extension point. Include\nthe smallest working file map and example, the backend contract that remains\nauthoritative, prohibited browser-side shortcuts, upgrade and rollback impact,\nand the focused positive, rejected, boundary, integration, regression, and\nproduction-build tests.\n\nA checklist that records only the shipped OOTB behavior is incomplete. If no\nsafe extension point exists, record that limitation explicitly rather than\nsuggesting that a framework file should be edited.\n',
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/feature-delivery-checklist.md',
        evidence: 'docs/feature-delivery-checklist.md',
        hash: 'da3160391c340399debae48e13e16e44a9ebe134f4e8510724ee502275658694',
        version: '0.3.19',
      },
      previous: {
        title: 'Media Management Workspace',
        route: '/docs/nodics-axis/media',
      },
      next: {
        title: 'Axis Implementation and Documentation Contract',
        route: '/docs/nodics-axis/implementation-contract',
      },
    },
    active: true,
  },
  record14: {
    code: 'axisDocsComponentimplementationcontract',
    typeCode: 'axisDocumentationArticleComponentType',
    renderer: 'documentation.component.article',
    accessMode: 'AUTHENTICATED',
    properties: {
      code: 'axis.implementation-contract',
      title: 'Axis Implementation and Documentation Contract',
      route: '/docs/nodics-axis/implementation-contract',
      section: 'contribute-to-axis',
      sectionTitle: 'Contribute to Axis',
      category: 'Contribute to Axis',
      audience: ['developer', 'architect', 'framework-maintainer', 'ai-tool'],
      summary:
        'Follow local discovery, repository ownership, placement, documentation, required scenarios, customization, and acceptance contracts.',
      headings: [
        {
          text: 'Local Discovery Chain',
          anchor: 'implementation-contract-1-local-discovery-chain',
          level: 2,
        },
        {
          text: 'Repository Ownership',
          anchor: 'implementation-contract-2-repository-ownership',
          level: 2,
        },
        {
          text: 'Placement Rules',
          anchor: 'implementation-contract-3-placement-rules',
          level: 2,
        },
        {
          text: 'Required Feature Documentation',
          anchor: 'implementation-contract-4-required-feature-documentation',
          level: 2,
        },
        {
          text: 'Customize and extend safely',
          anchor: 'implementation-contract-5-customize-and-extend-safely',
          level: 2,
        },
        {
          text: 'Canonical Source and Generated Data',
          anchor: 'implementation-contract-6-canonical-source-and-generated-data',
          level: 2,
        },
        {
          text: 'Required Examples',
          anchor: 'implementation-contract-7-required-examples',
          level: 2,
        },
        {
          text: 'Successful',
          anchor: 'implementation-contract-8-successful',
          level: 3,
        },
        {
          text: 'Unauthorized',
          anchor: 'implementation-contract-9-unauthorized',
          level: 3,
        },
        {
          text: 'Boundary',
          anchor: 'implementation-contract-10-boundary',
          level: 3,
        },
        {
          text: 'Failure And Recovery',
          anchor: 'implementation-contract-11-failure-and-recovery',
          level: 3,
        },
        {
          text: 'Customization',
          anchor: 'implementation-contract-12-customization',
          level: 3,
        },
        {
          text: 'Acceptance',
          anchor: 'implementation-contract-13-acceptance',
          level: 2,
        },
        {
          text: 'Continue',
          anchor: 'implementation-contract-14-continue',
          level: 2,
        },
      ],
      blocks: [
        {
          kind: 'paragraph',
          text: 'Axis is a reusable frontend framework application, not a one-off admin screen. Partners, developers, and AI tools must be able to extend it without seeing the entire repository or moving backend authority into the browser.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Local Discovery Chain',
          anchor: 'implementation-contract-1-local-discovery-chain',
        },
        {
          kind: 'paragraph',
          text: 'For every feature, read:',
        },
        {
          kind: 'ordered-list',
          items: [
            'root `AGENTS.md`;',
            'this contract and the feature-delivery checklist;',
            'the nearest feature source and focused tests;',
            'the consuming Nodics API/OpenAPI/CMS contract;',
            'the feature guide linked from the root README.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Critical rules must be repeated concisely near the implementation and protected by TypeScript, schema validation, linting, or focused tests. A conversation or temporary plan is never an implementation authority.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Repository Ownership',
          anchor: 'implementation-contract-2-repository-ownership',
        },
        {
          kind: 'paragraph',
          text: 'Axis owns:',
        },
        {
          kind: 'unordered-list',
          items: [
            'rendering, interaction, responsive/WebView behavior, and accessibility;',
            'typed client contract consumption;',
            'browser routing and presentation state;',
            'TanStack Query server-state coordination;',
            'Axis-owned CMS renderer implementations and typed registries;',
            'loading, empty, unauthorized, incompatible, failure, and recovery views.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Nodics owns:',
        },
        {
          kind: 'unordered-list',
          items: [
            'business rules and authoritative validation;',
            'authentication and authorization enforcement;',
            'persistence, workflows, pipelines, events, jobs, and integrations;',
            'secrets, tenant governance, AI execution, tool execution, and audit;',
            'backend schemas, APIs, configuration, runtime contracts, and business docs.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'When both repositories change, analyze and test each boundary separately.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Placement Rules',
          anchor: 'implementation-contract-3-placement-rules',
        },
        {
          kind: 'unordered-list',
          items: [
            'Application composition belongs under `src/app`.',
            'Feature interaction belongs in a named feature boundary, not a generic utilities folder.',
            'CMS page, template, and component renderers follow the paths defined in `AGENTS.md`, with one renderer implementation per file.',
            'Backend logical keys map through typed registries. CMS data never supplies executable JavaScript.',
            'Configurable page copy comes from CMS component properties. Page and component renderers consume typed labels, headings, placeholders, help text, empty-state text, action captions, and fragments rather than defining business-facing copy in JSX.',
            'Reusable interaction behavior is implemented once and composed everywhere. Query builders, media selectors, relationship selectors, record browsers, and similar repeated controls must be modeled as reusable CMS component contracts and Axis-owned shared renderers or primitives. Do not fork a page-local implementation when a generic component already exists. Schema data querying uses the `axis.component.schema-query-builder` renderer key, so Schema Workbench, Imports and Exports, and future schema-backed pages share one governed query-building experience.',
            'Error ownership remains layered: the owning backend module supplies stable domain codes and safe messages, CMS supplies configurable presentation copy, and Axis supplies only generic browser or transport fallbacks needed when the backend is unavailable. Axis never interprets English error text.',
            'Locale, channel, and backend-resolved fallback are part of the CMS delivery contract. Axis preserves that context, supports translated text expansion and text direction, and uses locale-aware formatting without creating a parallel backend translation catalogue.',
            'Runtime values come from validated Axis configuration and backend contracts. They do not belong in scattered constants or `package.json`.',
            'Raw identifiers remain separate from display labels. Humanization is a presentation fallback after contract validation, never a transformation of request, authorization, cache, storage, audit, or telemetry identity. A backend-provided localized display name always takes precedence.',
            'Secrets never belong in frontend source, `.env`, generated browser config, storage, URLs, telemetry, or logs.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Required Feature Documentation',
          anchor: 'implementation-contract-4-required-feature-documentation',
        },
        {
          kind: 'paragraph',
          text: 'Every significant feature guide explains:',
        },
        {
          kind: 'unordered-list',
          items: [
            'purpose and current implemented scope;',
            'backend authority and contract version;',
            'source/component/client/test map;',
            'setup and runtime configuration;',
            'permissions and security;',
            'keyboard, screen reader, responsive, touch, reduced-motion, and WebView behavior;',
            'success, unauthorized/invalid, boundary/responsive, failure/recovery, and supported customization examples;',
            'troubleshooting and verification;',
            'known limitations and safe fallback.',
          ],
        },
        {
          kind: 'paragraph',
          text: 'Business workflows and backend customization belong in Nodics documentation. Axis guides link to them and focus on frontend setup and contribution.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Customize and extend safely',
          anchor: 'implementation-contract-5-customize-and-extend-safely',
        },
        {
          kind: 'paragraph',
          text: 'Every feature guide includes this section. It shows the smallest supported project-owned Axis customization, identifies the backend contract and security boundary that remain authoritative, lists prohibited frontend shortcuts or parallel authorities, and names the focused positive, rejected, boundary, integration, and regression tests. Explaining only the out-of-the-box screen or workflow is incomplete.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Canonical Source and Generated Data',
          anchor: 'implementation-contract-6-canonical-source-and-generated-data',
        },
        {
          kind: 'paragraph',
          text: 'Axis documentation is authored as granular, reviewable pages under `content/documentation`. The deterministic documentation generator creates CMS page, component, navigation, route, search, and immutable manifest data under `data/core` and `manifest/docs-content-pack.json`.',
        },
        {
          kind: 'paragraph',
          text: 'The generator is executable repository tooling and lives beside the authored content at `content/documentation/tooling/generate-documentation-content.js`. It must not be placed under `config`, because configuration files remain declarative values only.',
        },
        {
          kind: 'paragraph',
          text: 'Do not hand-edit generated CMS article records. Do not maintain a shorter generated summary beside a richer project guide. Every implemented feature must update its canonical source page and regenerate the content pack in the same change:',
        },
        {
          kind: 'code',
          language: 'bash',
          text: 'npm run docs:generate\nnpm run docs:check',
        },
        {
          kind: 'paragraph',
          text: 'The migration register records the original README/docs evidence, canonical source, destination route, source hash, headings, word count, and disposition. README or legacy docs may be reduced only after all substantive guidance is mapped, generated, reviewed in Axis, and protected by content-preservation tests.',
        },
        {
          kind: 'paragraph',
          text: 'Every project and module retains a concise high-level `README.md` after detailed guidance migrates. It remains the repository entry point for purpose, ownership, implemented capabilities, setup, verification, extension boundaries, and links to canonical pages. It must not become a second copy of the complete operational and developer guides. Legacy detailed `docs/` files may be retired only after the migration register records their hashes, word counts, headings, canonical destinations, and the generated and rendered verification gates pass. After retirement, do not recreate a parallel `docs/` directory. The project keeps one concise `README.md`; detailed permanent guidance belongs only under `content/documentation` and its generated `data/core` projection.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Required Examples',
          anchor: 'implementation-contract-7-required-examples',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Successful',
          anchor: 'implementation-contract-8-successful',
        },
        {
          kind: 'paragraph',
          text: 'An authorized employee loads a backend descriptor, Axis validates it, maps its renderer key to an Axis-owned component, and displays the result.',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Unauthorized',
          anchor: 'implementation-contract-9-unauthorized',
        },
        {
          kind: 'paragraph',
          text: 'The backend denies an operation. Axis presents an accessible unauthorized state and does not infer authorization from menu visibility.',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Boundary',
          anchor: 'implementation-contract-10-boundary',
        },
        {
          kind: 'paragraph',
          text: 'The same feature remains usable with keyboard and touch in desktop, tablet, and mobile WebView layouts, including long labels, empty data, and bounded payloads.',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Failure And Recovery',
          anchor: 'implementation-contract-11-failure-and-recovery',
        },
        {
          kind: 'paragraph',
          text: 'When BackOffice or a target module is unavailable, Axis presents a safe recovery state, avoids stale privileged data, and retries through the same authoritative contract.',
        },
        {
          kind: 'heading',
          level: 3,
          text: 'Customization',
          anchor: 'implementation-contract-12-customization',
        },
        {
          kind: 'paragraph',
          text: 'A partner adds an Axis-owned renderer and registry manifest for a backend logical component key. The partner does not download code from CMS or add business validation to the renderer.',
        },
        {
          kind: 'paragraph',
          text: "An administrator changes a component label or locale-specific content in the authoritative CMS catalog. The same allowlisted Axis renderer displays the resolved value without a frontend rebuild. Missing or malformed required properties produce the renderer's safe generic fallback and never execute backend-supplied markup or code.",
        },
        {
          kind: 'paragraph',
          text: 'A validated fallback identifier such as `axisContentCatalog` may be displayed as `Axis Content Catalog`. The raw code remains unchanged wherever identity or backend communication is involved.',
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Acceptance',
          anchor: 'implementation-contract-13-acceptance',
        },
        {
          kind: 'paragraph',
          text: 'A feature is complete only when:',
        },
        {
          kind: 'unordered-list',
          items: [
            'repository ownership is explicit;',
            'the backend contract and security boundary are preserved;',
            'strict TypeScript and validation cover external data;',
            'accessibility and responsive states are implemented;',
            'focused positive, negative, boundary, failure, integration, and regression tests pass;',
            'implemented documentation and known limitations are current;',
            '`npm run verify` passes at the release-oriented gate.',
          ],
        },
        {
          kind: 'heading',
          level: 2,
          text: 'Continue',
          anchor: 'implementation-contract-14-continue',
        },
        {
          kind: 'unordered-list',
          items: [
            '[Feature Delivery Checklist](/docs/nodics-axis/feature-delivery)',
            '[Architecture And Ownership](/docs/nodics-axis/architecture)',
            '[CMS Delivery And Renderers](/docs/nodics-axis/cms-renderers)',
            '[Axis README](/docs/nodics-axis)',
          ],
        },
      ],
      searchText:
        "Axis Implementation and Documentation Contract Follow local discovery, repository ownership, placement, documentation, required scenarios, customization, and acceptance contracts. # Axis Implementation And Documentation Contract\n\nAxis is a reusable frontend framework application, not a one-off admin screen.\nPartners, developers, and AI tools must be able to extend it without seeing the\nentire repository or moving backend authority into the browser.\n\n## Local Discovery Chain\n\nFor every feature, read:\n\n1. root `AGENTS.md`;\n2. this contract and the feature-delivery checklist;\n3. the nearest feature source and focused tests;\n4. the consuming Nodics API/OpenAPI/CMS contract;\n5. the feature guide linked from the root README.\n\nCritical rules must be repeated concisely near the implementation and protected\nby TypeScript, schema validation, linting, or focused tests. A conversation or\ntemporary plan is never an implementation authority.\n\n## Repository Ownership\n\nAxis owns:\n\n- rendering, interaction, responsive/WebView behavior, and accessibility;\n- typed client contract consumption;\n- browser routing and presentation state;\n- TanStack Query server-state coordination;\n- Axis-owned CMS renderer implementations and typed registries;\n- loading, empty, unauthorized, incompatible, failure, and recovery views.\n\nNodics owns:\n\n- business rules and authoritative validation;\n- authentication and authorization enforcement;\n- persistence, workflows, pipelines, events, jobs, and integrations;\n- secrets, tenant governance, AI execution, tool execution, and audit;\n- backend schemas, APIs, configuration, runtime contracts, and business docs.\n\nWhen both repositories change, analyze and test each boundary separately.\n\n## Placement Rules\n\n- Application composition belongs under `src/app`.\n- Feature interaction belongs in a named feature boundary, not a generic\n  utilities folder.\n- CMS page, template, and component renderers follow the paths defined in\n  `AGENTS.md`, with one renderer implementation per file.\n- Backend logical keys map through typed registries. CMS data never supplies\n  executable JavaScript.\n- Configurable page copy comes from CMS component properties. Page and\n  component renderers consume typed labels, headings, placeholders, help text,\n  empty-state text, action captions, and fragments rather than defining\n  business-facing copy in JSX.\n- Reusable interaction behavior is implemented once and composed everywhere.\n  Query builders, media selectors, relationship selectors, record browsers,\n  and similar repeated controls must be modeled as reusable CMS component\n  contracts and Axis-owned shared renderers or primitives. Do not fork a\n  page-local implementation when a generic component already exists. Schema\n  data querying uses the `axis.component.schema-query-builder` renderer key,\n  so Schema Workbench, Imports and Exports, and future schema-backed pages\n  share one governed query-building experience.\n- Error ownership remains layered: the owning backend module supplies stable\n  domain codes and safe messages, CMS supplies configurable presentation copy,\n  and Axis supplies only generic browser or transport fallbacks needed when\n  the backend is unavailable. Axis never interprets English error text.\n- Locale, channel, and backend-resolved fallback are part of the CMS delivery\n  contract. Axis preserves that context, supports translated text expansion\n  and text direction, and uses locale-aware formatting without creating a\n  parallel backend translation catalogue.\n- Runtime values come from validated Axis configuration and backend contracts.\n  They do not belong in scattered constants or `package.json`.\n- Raw identifiers remain separate from display labels. Humanization is a\n  presentation fallback after contract validation, never a transformation of\n  request, authorization, cache, storage, audit, or telemetry identity. A\n  backend-provided localized display name always takes precedence.\n- Secrets never belong in frontend source, `.env`, generated browser config,\n  storage, URLs, telemetry, or logs.\n\n## Required Feature Documentation\n\nEvery significant feature guide explains:\n\n- purpose and current implemented scope;\n- backend authority and contract version;\n- source/component/client/test map;\n- setup and runtime configuration;\n- permissions and security;\n- keyboard, screen reader, responsive, touch, reduced-motion, and WebView\n  behavior;\n- success, unauthorized/invalid, boundary/responsive, failure/recovery, and\n  supported customization examples;\n- troubleshooting and verification;\n- known limitations and safe fallback.\n\nBusiness workflows and backend customization belong in Nodics documentation.\nAxis guides link to them and focus on frontend setup and contribution.\n\n## Customize and extend safely\n\nEvery feature guide includes this section. It\nshows the smallest supported project-owned Axis customization, identifies the\nbackend contract and security boundary that remain authoritative, lists\nprohibited frontend shortcuts or parallel authorities, and names the focused\npositive, rejected, boundary, integration, and regression tests. Explaining\nonly the out-of-the-box screen or workflow is incomplete.\n\n## Canonical Source and Generated Data\n\nAxis documentation is authored as granular, reviewable pages under\n`content/documentation`. The deterministic documentation generator creates CMS\npage, component, navigation, route, search, and immutable manifest data under\n`data/core` and `manifest/docs-content-pack.json`.\n\nThe generator is executable repository tooling and lives beside the authored\ncontent at `content/documentation/tooling/generate-documentation-content.js`.\nIt must not be placed under `config`, because configuration files remain\ndeclarative values only.\n\nDo not hand-edit generated CMS article records. Do not maintain a shorter\ngenerated summary beside a richer project guide. Every implemented feature\nmust update its canonical source page and regenerate the content pack in the\nsame change:\n\n```bash\nnpm run docs:generate\nnpm run docs:check\n```\n\nThe migration register records the original README/docs evidence, canonical\nsource, destination route, source hash, headings, word count, and disposition.\nREADME or legacy docs may be reduced only after all substantive guidance is\nmapped, generated, reviewed in Axis, and protected by content-preservation\ntests.\n\nEvery project and module retains a concise high-level `README.md` after detailed\nguidance migrates. It remains the repository entry point for purpose, ownership,\nimplemented capabilities, setup, verification, extension boundaries, and links\nto canonical pages. It must not become a second copy of the complete\noperational and developer guides. Legacy detailed `docs/` files may be retired\nonly after the migration register records their hashes, word counts, headings,\ncanonical destinations, and the generated and rendered verification gates pass.\nAfter retirement, do not recreate a parallel `docs/` directory. The project\nkeeps one concise `README.md`; detailed permanent guidance belongs only under\n`content/documentation` and its generated `data/core` projection.\n\n## Required Examples\n\n### Successful\n\nAn authorized employee loads a backend descriptor, Axis validates it, maps its\nrenderer key to an Axis-owned component, and displays the result.\n\n### Unauthorized\n\nThe backend denies an operation. Axis presents an accessible unauthorized state\nand does not infer authorization from menu visibility.\n\n### Boundary\n\nThe same feature remains usable with keyboard and touch in desktop, tablet, and\nmobile WebView layouts, including long labels, empty data, and bounded payloads.\n\n### Failure And Recovery\n\nWhen BackOffice or a target module is unavailable, Axis presents a safe\nrecovery state, avoids stale privileged data, and retries through the same\nauthoritative contract.\n\n### Customization\n\nA partner adds an Axis-owned renderer and registry manifest for a backend\nlogical component key. The partner does not download code from CMS or add\nbusiness validation to the renderer.\n\nAn administrator changes a component label or locale-specific content in the\nauthoritative CMS catalog. The same allowlisted Axis renderer displays the\nresolved value without a frontend rebuild. Missing or malformed required\nproperties produce the renderer's safe generic fallback and never execute\nbackend-supplied markup or code.\n\nA validated fallback identifier such as `axisContentCatalog` may be displayed\nas `Axis Content Catalog`. The raw code remains unchanged wherever identity or\nbackend communication is involved.\n\n## Acceptance\n\nA feature is complete only when:\n\n- repository ownership is explicit;\n- the backend contract and security boundary are preserved;\n- strict TypeScript and validation cover external data;\n- accessibility and responsive states are implemented;\n- focused positive, negative, boundary, failure, integration, and regression\n  tests pass;\n- implemented documentation and known limitations are current;\n- `npm run verify` passes at the release-oriented gate.\n\n## Continue\n\n- [Feature Delivery Checklist](feature-delivery-checklist.md)\n- [Architecture And Ownership](architecture-and-ownership.md)\n- [CMS Delivery And Renderers](cms-delivery-and-renderers.md)\n- [Axis README](../README.md)\n",
      source: {
        repository: 'nodics.axis',
        path: 'content/documentation/pages/implementation-and-documentation-contract.md',
        evidence: 'docs/implementation-and-documentation-contract.md',
        hash: 'da6cbc490f21e7a2497cb597c55cd5aa022b0628b8abfde7d08d879c2381e356',
        version: '0.3.19',
      },
      previous: {
        title: 'Axis Feature Delivery Checklist',
        route: '/docs/nodics-axis/feature-delivery',
      },
    },
    active: true,
  },
};
