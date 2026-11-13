# Business Rules workspace

Axis renders the authorized rules.policy workspace from Rules API metadata. The
owner property catalogue and versioned authoring contract supply properties,
compatible comparisons, outcome fields, group limits and input-quality vocabulary.
Nested groups, typed values, score ranges and consumer-declared simulation inputs
are edited through labelled, responsive controls. Unknown extension fields survive
local edits; unsupported nested outcomes remain read-only. No browser evaluator,
consumer registry, hardcoded eWaste property or default rule score is permitted.

## Governed user journey

Select a policy, prepare a successor if needed, edit its groups and save. Incomplete
drafts may be retained; the owner exposes validation issues and refuses validation
or publication until they are resolved. Save bands separately, inspect their exact
revision and confirm publication. Simulate the saved policy using hypothetical
values, then inspect the saved review and explicitly submit it to Process. The
existing authorized Process workspace owns the decision. Version and audit reads
report failures separately instead of representing denied reads as empty success.

Each command checks the current actor's exact allowedOperations and re-reads the
owner revision before its single dispatch. Dirty local content disables validation,
simulation and submission. A synchronous dispatch guard prevents duplicate clicks;
an uncertain response holds commands until explicit owner inspection, without
replay. Actor, tenant or effective owner changes retire drafts and late responses;
equivalent bootstrap refreshes retain local edits. Published versions are immutable.

## Safe customization and verification

Consumers extend their Rules property catalogue, allowed values, inert outcome
fields and optional simulationInputPath. Generic limits stay in Framework
rulesDefinition/config/properties.js; only actual project exceptions go to Kickoff.
Presentation copy uses stable rules.\* localization keys, and formatting follows the
active locale. Do not insert expressions, HTML, scripts or owner commands in these
descriptors. Rules API validates permissions, operand types, ranges and revisions;
Process remains approval authority and consumers retain outcome interpretation.

Run npx vitest run test/rulesManagement, npm run typecheck and the focused ESLint
checks. Tests cover nested typed authoring, denied and stale commands, explicit
band review, uncertain-response recovery, actor changes and failed audit reads.
Browser acceptance must additionally inspect the exact saved revision, simulate,
approve through Process and verify the immutable owner version and audit.

See the Framework Rules Engine README and rulesApi/llm/contracts/README.md for the
canonical API and release contracts. Axis owns no backend-importable guide content.
