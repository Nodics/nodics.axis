# Module Registry

Axis renders functional-module lifecycle state from Platform BackOffice. It
does not calculate dependency satisfaction, activate prerequisite modules,
or supply a second module catalogue.

## Registry workspace

Render each module once in two searchable lists: Registered and activated,
and Pending (including registered modules that are not enabled). Keep one
shared selection toolbar; do not add a duplicate selection catalogue.

Rows expose runtime connectivity and prerequisite names separately from activation.
Missing preflight metadata is labelled as unreported, not as proof of no prerequisites.
Desktop column headings collapse into stacked rows on narrow screens; technical
details remain in the existing drawer. Section accents and text labels distinguish
active and pending lists without adding duplicate summary panels.
A single unframed overview shows activated, pending, ready-to-enable, and runtime
issue totals. Totals remain catalogue-wide during search; selection counts and
Select ready apply to visible eligible modules. Readiness badges use text as well
as color, and the selection toolbar announces draft counts without activating data.
Order modules by the backend-declared prerequisites before filtering into these
lists. Independent modules retain catalogue order; external dependencies are
not invented, and cyclic remainders retain deterministic catalogue order.
Ordering is presentation only and never changes backend readiness decisions.
The toolbar selects ready capabilities
and submits one enable request to BackOffice. Selecting, clearing, searching,
or opening details must not change server state.

Enabled modules show their persisted state; required modules remain protected.
Lifecycle maintenance, data receipts, dependency explanations, runtime evidence,
and technical identifiers are available in the module detail drawer. Runtime
health is an optional disclosure above the list, with an issue count visible
when attention is needed. Errors preserve selection and refresh catalogue
revisions without automatically retrying a write.

Presentation extensions can customize row copy and styling in the owning Axis
component while retaining the typed catalogue client and backend permissions.
Keep two non-overlapping lists, responsive rows, accessible checkbox/detail labels, and
backend-owned dependency decisions. Focused route tests cover single rendering,
search, protected modules, details, blockers, and failed selection recovery.

Expanded activation details render each backend dependency's display name,
`reason`, and `resolution`. Missing registration, disabled activation, runtime
failure, and unavailable status are explained by BackOffice. Dependency rows
stack on narrow screens; they do not add nested cards or automatic mutations.
Older responses without explanatory fields retain their reported state labels.

Customize dependency copy through the owning backend's
`DefaultFunctionalModuleCatalogueService.describeFunctionalDependency` override.
Keep readiness and lifecycle authorization backend-owned. Do not infer actions
by parsing message text or hardcode Commerce, Waste, or project-specific rules.

## Runtime Smoke Readiness

The Module Registry page derives a local smoke-readiness panel from the
authenticated BackOffice bootstrap and registered functional-module payload.
This panel is a client presentation of existing backend authority; it must not
replace the registry, create a separate runtime topology file, or require
custom-project configuration.

The smoke panel checks:

- at least one active runtime connection is visible in bootstrap;
- at least one active `import` connection exists before data preparation;
- a Process runtime is visible before publishing approval checks;
- enabled or registered modules are not offline, incompatible, or missing
  observed servers;
- activation data-package target servers are visible in bootstrap.

Messages must name the missing runtime/module and provide a fix action. Do not
show only `No runtime` without explaining whether the issue is server startup,
bootstrap refresh, import availability, Process approval availability, or a
data-package target mapping.

Run the focused tests under `test/operations/moduleRegistry`, plus the Axis
build and scoped lint. Tests cover backend-provided reasons, blocked readiness,
registration remaining available, and legacy response compatibility. Browser
checks should cover multiple blockers, a narrow viewport, and no activation as
a side effect of opening or expanding a module.
