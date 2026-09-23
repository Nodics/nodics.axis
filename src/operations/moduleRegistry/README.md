# Module Registry

Axis renders functional-module lifecycle state from Platform BackOffice. It
does not calculate dependency satisfaction, activate prerequisite modules,
or supply a second module catalogue.

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
