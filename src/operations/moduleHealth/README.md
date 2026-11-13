# Module Health

Axis presents only current BackOffice-owned health observations. Registered instances describe observed membership; expired or deregistered nodes do not establish expected topology. Details retain owner state, observation time, heartbeat and freshness. No browser health inference or operational registry is permitted.

Initial and refreshing reads withhold counters and rows. Failed evidence remains unknown rather than zero or a cached healthy total. An explicit refresh restores current observations. Actor, tenant, Enterprise and exact connection changes retire selection and cached evidence; tokens never appear in query keys. Backend authorization and health-refresh commands remain authoritative.

Projects may customize layout and semantic state colours through Axis theme/render components while reusing the typed client and owner DTO. Keep protected configuration out of health responses; never infer expected membership or change runtime authority from presentation.

Run `test/operations/moduleHealth/ModuleHealthRoutePage.test.tsx` and `ModuleHealthTree.test.tsx` for pending/error/recovery, current zero, source/actor replacement, hierarchy and detail behavior. Native acceptance additionally observes an actual owner outage and recovery, then inspects sourced runtime detail. Backend contracts remain with Platform BackOffice.
