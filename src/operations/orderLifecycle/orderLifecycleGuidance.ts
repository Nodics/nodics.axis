export const orderLifecycleGuidance = (schemaName?: string): string => {
  const name = (schemaName ?? '').toLowerCase();
  if (name.includes('cancellation'))
    return 'Review full or partial scope, eligibility window and reason, fulfillment and inventory progress, settlement impact, audit evidence, and the next backend-authorized action. Uncertain payment outcomes require reconciliation.';
  if (name.includes('return'))
    return 'Follow each RMA from authorization through receipt, inspection and disposition. Fulfillment owns the physical journey; Order exposes the resulting refund eligibility and reconciliation state.';
  if (name.includes('refund'))
    return 'Review calculation evidence, approval and maker-checker state, original-rail allocations, provider outcomes and reconciliation. Axis never changes an approved amount or calls a payment provider directly.';
  if (name.includes('exchange') || name.includes('replacement'))
    return 'Review RMA, replacement selection, inventory reservation, return inspection and outbound fulfillment evidence. Axis presents the queue and backend actions; Commerce owners coordinate the actual exchange or replacement.';
  if (name.includes('appeal'))
    return 'Review the referenced rejected or delayed lifecycle case, customer appeal evidence, SLA and operator notes. Appeals stay Order/Workflow-owned and must not bypass maker-checker evidence.';
  if (name.includes('reason') || name.includes('policy'))
    return 'Manage versioned lifecycle policy through backend-published actions. Published evidence is immutable and customer overrides remain configuration-owned.';
  return 'Operate cancellation, Return/RMA and Refund from backend-authorized state actions. Axis presents safe evidence and does not coordinate domain owners or providers.';
};
