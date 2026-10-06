/** @file Tests source inspection, preview failure/recovery and permission-aware controls. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeStudioView } from '../../src/assistant/KnowledgeStudioView';
import {
  parseKnowledgeInventory,
  parseKnowledgeProgress,
} from '../../src/assistant/api/knowledgeStudioClient';
import { knowledgeStudioFixture } from './knowledgeStudioFixture';

describe('Knowledge Studio source view', () => {
  it('renders source schedules only from an admitted owner declaration and a manageable selected source', () => {
    const fixture = knowledgeStudioFixture();
    const inventory = parseKnowledgeInventory({
      ...fixture,
      sourceSchedules: { ownerModule: 'cronjob', enabled: true },
      sources: fixture.sources.map((source) => ({
        ...source,
        sourcePolicyDigest: 'a'.repeat(64),
      })),
    });
    const schedule = vi.fn(() => <div>Approved source schedules</div>);
    const view = render(
      <KnowledgeStudioView
        inventory={inventory}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn()}
        sourceSchedule={schedule}
      />,
    );
    expect(screen.getByText('Approved source schedules')).toBeVisible();
    view.rerender(
      <KnowledgeStudioView
        inventory={{ ...inventory, sourceSchedules: false }}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn()}
        sourceSchedule={schedule}
      />,
    );
    expect(screen.queryByText('Approved source schedules')).toBeNull();
    expect(() =>
      parseKnowledgeInventory({
        ...fixture,
        sourceSchedules: { ownerModule: 'foreign', enabled: true },
      }),
    ).toThrow();
  });
  it('distinguishes durable evidence and blocks refresh while a writer outcome requires inspection', async () => {
    const fixture = knowledgeStudioFixture();
    const inventory = parseKnowledgeInventory({
      ...fixture,
      presentation: {
        ...fixture.presentation,
        durableEvidence: 'Published generation verified',
        inspectionRequired: 'Operator inspection required',
        cleanupPending: 'Obsolete cleanup pending',
        progress: 'Acknowledged writes',
        progressIdle: 'Waiting',
        progressWriting: 'Write unconfirmed',
        progressSealed: 'Publication pending',
      },
      sources: fixture.sources.map((source) => ({
        ...source,
        sourcePolicyDigest: 'a'.repeat(64),
        status: {
          state: 'PROJECTED',
          evidence: 'DURABLE_GENERATION',
          indexedVersion: source.version,
          refreshedAt: null,
          inspectionRequired: true,
          cleanupPending: true,
          progress: { phase: 'WRITING', acknowledgedChunks: 3, expectedChunks: 5 },
        },
      })),
    });
    const index = vi.fn();
    render(
      <KnowledgeStudioView
        inventory={inventory}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn().mockResolvedValue({
          filesRead: 1,
          filesAccepted: 1,
          filesRejected: 0,
          chunksPrepared: 1,
        })}
        onIndex={index}
      />,
    );
    expect(screen.getByText('Published generation verified')).toBeVisible();
    expect(screen.getByText('Operator inspection required')).toBeVisible();
    expect(screen.getByText('Obsolete cleanup pending')).toBeVisible();
    expect(screen.getByText('3 / 5')).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: 'Acknowledged writes' }),
    ).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('Write unconfirmed')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Preview ingestion' }));
    expect(await screen.findByRole('button', { name: 'indexSource' })).toBeDisabled();
    expect(index).not.toHaveBeenCalled();
  });
  it('rejects fabricated progress and omits private writer handles', () => {
    expect(parseKnowledgeProgress(undefined)).toBeUndefined();
    expect(
      parseKnowledgeProgress({
        phase: 'SEALED',
        acknowledgedChunks: 0,
        expectedChunks: 0,
        claim: 'private',
      }),
    ).toEqual({ phase: 'SEALED', acknowledgedChunks: 0, expectedChunks: 0 });
    for (const value of [
      { phase: 'SEALED', acknowledgedChunks: 1, expectedChunks: 2 },
      { phase: 'RUNNING', acknowledgedChunks: 1, expectedChunks: 2 },
      { phase: 'IDLE', acknowledgedChunks: -1, expectedChunks: 2 },
      { phase: 'IDLE', acknowledgedChunks: 3, expectedChunks: 2 },
      { phase: 'IDLE', acknowledgedChunks: 1, expectedChunks: 100001 },
    ])
      expect(() => parseKnowledgeProgress(value)).toThrow();
  });
  it('exposes bounded page navigation without inventing hidden-source totals', async () => {
    const onPage = vi.fn();
    render(
      <KnowledgeStudioView
        inventory={parseKnowledgeInventory({
          ...knowledgeStudioFixture(),
          page: 1,
          hasMore: true,
        })}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn()}
        onPage={onPage}
      />,
    );
    expect(screen.getByRole('button', { name: 'previousPage' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'nextPage' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
  it('requires preview and explicit refresh confirmation and prevents unknown-outcome replay', async () => {
    const fixture = knowledgeStudioFixture();
    const inventory = parseKnowledgeInventory({
      ...fixture,
      sources: fixture.sources.map((source) => ({
        ...source,
        sourcePolicyDigest: 'a'.repeat(64),
      })),
    });
    const index = vi.fn().mockRejectedValue(new Error('unknown'));
    render(
      <KnowledgeStudioView
        inventory={inventory}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn().mockResolvedValue({
          filesRead: 1,
          filesAccepted: 1,
          filesRejected: 0,
          chunksPrepared: 1,
        })}
        onIndex={index}
      />,
    );
    expect(screen.queryByRole('button', { name: 'indexSource' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Preview ingestion' }));
    await userEvent.click(await screen.findByRole('button', { name: 'indexSource' }));
    expect(index).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'indexConfirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('indexUnknown');
    expect(screen.getByRole('button', { name: 'indexConfirm' })).toBeDisabled();
    expect(index).toHaveBeenCalledOnce();
  });
  it('filters configured active groups without exposing an activation control', async () => {
    const fixture = knowledgeStudioFixture();
    const inventory = parseKnowledgeInventory({
      ...fixture,
      presentation: {
        ...fixture.presentation,
        groups: 'Knowledge groups',
        allGroups: 'All active groups',
        activeGroup: 'Active',
        inactiveGroup: 'Inactive',
      },
      groups: {
        enabled: true,
        items: [
          {
            code: 'guides',
            name: 'Guides',
            active: true,
            sourceCodes: ['framework-readmes'],
          },
          {
            code: 'archived',
            name: 'Archived',
            active: false,
            sourceCodes: ['framework-readmes'],
          },
        ],
      },
    });
    render(
      <KnowledgeStudioView
        inventory={inventory}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('combobox', { name: 'Knowledge groups' }));
    expect(screen.getByRole('option', { name: 'Archived (Inactive)' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('option', { name: 'Guides (Active)' }));
    expect(screen.getByRole('heading', { name: 'framework-readmes' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
  });
  it('inspects provenance and previews counts without a refresh mutation', async () => {
    const preview = vi.fn().mockResolvedValue({
      filesRead: 2,
      filesAccepted: 1,
      filesRejected: 1,
      chunksPrepared: 3,
    });
    const refresh = vi.fn();
    render(
      <KnowledgeStudioView
        inventory={parseKnowledgeInventory(knowledgeStudioFixture())}
        refreshing={false}
        onRefresh={refresh}
        onPreview={preview}
      />,
    );
    expect(screen.getByText('**/README.md')).toBeVisible();
    expect(screen.getByText('generated')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Preview ingestion' }));
    expect(await screen.findByRole('status')).toHaveTextContent('previewOnly');
    expect(preview).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Find a source' }),
      'missing',
    );
    expect(screen.getByText('empty')).toBeVisible();
  });
  it('hides the preview action without its separate grant', () => {
    const fixture = knowledgeStudioFixture();
    fixture.sources[0]!.canPreview = false;
    render(
      <KnowledgeStudioView
        inventory={parseKnowledgeInventory(fixture)}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Preview ingestion' })).toBeNull();
  });
  it('shows a safe failure and permits a manual preview retry', async () => {
    const preview = vi.fn().mockRejectedValue(new Error('private-host'));
    render(
      <KnowledgeStudioView
        inventory={parseKnowledgeInventory(knowledgeStudioFixture())}
        refreshing={false}
        onRefresh={vi.fn()}
        onPreview={preview}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preview ingestion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('previewFailed');
    expect(screen.queryByText('private-host')).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview ingestion' })).toBeEnabled();
  });
});
