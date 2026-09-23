export const ACTIONABLE_PROCESS_TASK_STATUSES = Object.freeze([
  'OPEN',
  'CLAIMED',
  'ESCALATED',
] as const);

export interface ProcessApprovalTaskStatus {
  readonly status: string;
}

export interface ProcessApprovalUnavailableContext {
  readonly sourceLabel: string;
  readonly hasProcessConnection: boolean;
  readonly workflowRef?: string | undefined;
  readonly taskCount?: number | undefined;
  readonly reconciliationMessage?: string | undefined;
}

export function isActionableProcessApprovalTask(
  task: ProcessApprovalTaskStatus,
): boolean {
  return ACTIONABLE_PROCESS_TASK_STATUSES.includes(
    task.status as (typeof ACTIONABLE_PROCESS_TASK_STATUSES)[number],
  );
}

export function findActionableProcessApprovalTask<
  Task extends ProcessApprovalTaskStatus,
>(tasks: readonly Task[]): Task | undefined {
  return tasks.find(isActionableProcessApprovalTask);
}

export function processApprovalUnavailableMessage(
  context: ProcessApprovalUnavailableContext,
): string {
  if (!context.hasProcessConnection) {
    return `Process runtime is unavailable, so ${context.sourceLabel} cannot be approved from this page. Start or register the Process runtime, then refresh readiness.`;
  }
  if (!context.workflowRef) {
    return `${context.sourceLabel} is waiting for publication approval, but no workflow reference was returned. Reconcile the approval task from this page, then retry the decision.`;
  }
  const taskCount = context.taskCount ?? 0;
  const taskSummary =
    taskCount > 0
      ? `${String(taskCount)} Process task${taskCount === 1 ? '' : 's'} were found, but none are open, claimed, or escalated for decision.`
      : 'No Process task was found for the publication workflow reference.';
  const reconciliation = context.reconciliationMessage
    ? ` ${context.reconciliationMessage}`
    : '';
  return `${taskSummary}${reconciliation} Open Process tasks to review workflow state, assignee, and permissions before retrying ${context.sourceLabel}.`;
}
