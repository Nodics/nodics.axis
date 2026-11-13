import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowGraphConnections } from '../../../src/operations/processWorkflow/WorkflowGraphConnections';
import type { ProcessGraph } from '../../../src/operations/processWorkflow/api/processDefinitionClient';

const graph: ProcessGraph = {
  nodes: [
    { code: 'end', name: 'End', type: 'END' },
    { code: 'review', name: 'Check request', type: 'TASK' },
    { code: 'start', name: 'Start', type: 'START' },
  ],
  transitions: [
    { code: 'enter', source: 'start', target: 'review' },
    {
      code: 'accept',
      source: 'review',
      target: 'end',
      name: 'Accepted',
      condition: { approved: true },
    },
    { code: 'return', source: 'review', target: 'start', default: true },
  ],
};

describe('WorkflowGraphConnections', () => {
  it('shows declared branched handoffs regardless of node storage order without evaluating conditions', () => {
    render(<WorkflowGraphConnections graph={graph} />);
    const list = screen.getByRole('list', { name: 'Workflow connections' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('Start → Check request')).toBeVisible();
    expect(within(list).getByText('Check request → End')).toBeVisible();
    expect(within(list).getByText('Check request → Start')).toBeVisible();
    expect(screen.queryByText('End → Check request')).toBeNull();
    expect(screen.getByText('Accepted')).toBeVisible();
    expect(screen.getByText('Conditional')).toBeVisible();
    expect(screen.getByText('Default')).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reports only the explicit transition identity when removal is requested', async () => {
    const onRemove = vi.fn();
    render(<WorkflowGraphConnections graph={graph} onRemove={onRemove} />);
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove connection accept' }),
    );
    expect(onRemove).toHaveBeenCalledExactlyOnceWith('accept');
    expect(graph.transitions).toHaveLength(3);
  });

  it('keeps unresolved owner references visible and explains an empty connection set', () => {
    const { rerender } = render(
      <WorkflowGraphConnections
        graph={{
          nodes: [],
          transitions: [
            { code: 'missing', source: 'source-code', target: 'target-code' },
          ],
        }}
      />,
    );
    expect(screen.getByText('source-code → target-code')).toBeVisible();
    rerender(
      <WorkflowGraphConnections graph={{ nodes: graph.nodes, transitions: [] }} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No connections yet.');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
