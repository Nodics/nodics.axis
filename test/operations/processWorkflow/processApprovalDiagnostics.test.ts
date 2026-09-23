import { describe, expect, it } from 'vitest';

import {
  findActionableProcessApprovalTask,
  processApprovalUnavailableMessage,
} from '../../../src/operations/processWorkflow/processApprovalDiagnostics';

describe('processApprovalDiagnostics', () => {
  it('finds only approval tasks that can be decided', () => {
    expect(
      findActionableProcessApprovalTask([
        { code: 'completed', status: 'COMPLETED' },
        { code: 'open', status: 'OPEN' },
      ]),
    ).toEqual({ code: 'open', status: 'OPEN' });
  });

  it('explains missing Process runtime separately from missing tasks', () => {
    expect(
      processApprovalUnavailableMessage({
        sourceLabel: 'Circa eWaste',
        hasProcessConnection: false,
        workflowRef: 'workflow-1',
      }),
    ).toContain('Process runtime is unavailable');
  });

  it('includes reconciliation context when no actionable task remains', () => {
    expect(
      processApprovalUnavailableMessage({
        sourceLabel: 'Framework docs',
        hasProcessConnection: true,
        workflowRef: 'workflow-1',
        taskCount: 2,
        reconciliationMessage:
          'Publication approval could not be reconciled automatically.',
      }),
    ).toBe(
      '2 Process tasks were found, but none are open, claimed, or escalated for decision. Publication approval could not be reconciled automatically. Open Process tasks to review workflow state, assignee, and permissions before retrying Framework docs.',
    );
  });
});
