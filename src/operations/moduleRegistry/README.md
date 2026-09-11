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

Run the focused tests under `test/operations/moduleRegistry`, plus the Axis
build and scoped lint. Tests cover backend-provided reasons, blocked readiness,
registration remaining available, and legacy response compatibility. Browser
checks should cover multiple blockers, a narrow viewport, and no activation as
a side effect of opening or expanding a module.
