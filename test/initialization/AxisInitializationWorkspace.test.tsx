import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AxisInitializationWorkspace } from '../../src/initialization/AxisInitializationWorkspace';
import { BundledLoginPage } from '../../src/initialization/BundledLoginPage';

describe('bundled Axis initialization experience', () => {
  it('authenticates through the supplied existing Profile action without storing credentials', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<BundledLoginPage onLogin={onLogin} />);
    await user.type(screen.getByLabelText(/Login ID/), 'admin');
    await user.type(screen.getByLabelText(/Password/), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onLogin).toHaveBeenCalledWith('admin', 'secret');
    expect(window.localStorage).toHaveLength(0);
  });

  it('offers initiation only before submission and exposes refresh while approval is pending', async () => {
    const user = userEvent.setup();
    const onInitiate = vi.fn();
    const onRefresh = vi.fn();
    const onApprove = vi.fn();
    const base = {
      baselineCode: 'axis',
      releaseCode: 'axis:axisBaseline',
      releaseVersion: '0.0.0',
      releaseStatus: 'CURRENT',
    } as const;
    const view = render(
      <AxisInitializationWorkspace
        busy={false}
        onApprove={onApprove}
        onInitiate={onInitiate}
        onLogout={vi.fn()}
        onRefresh={onRefresh}
        status={{ ...base, readiness: 'IMPORTED' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Initialize and submit' }));
    expect(onInitiate).toHaveBeenCalledOnce();
    view.rerender(
      <AxisInitializationWorkspace
        busy={false}
        onApprove={onApprove}
        onInitiate={onInitiate}
        onLogout={vi.fn()}
        onRefresh={onRefresh}
        status={{
          ...base,
          readiness: 'PUBLICATION_PENDING',
          publication: {
            code: 'publication',
            state: 'PENDING_APPROVAL',
            revision: 2,
            workflowRef: 'axis-approval-1',
          },
          review: {
            title: 'Publish the managed Nodics Axis workspace',
            summary: 'Review this immutable release before approval.',
            sourceRole: 'WCMS_STAGED',
            targetRole: 'WCMS_ONLINE',
            siteCode: 'axisCmsSite',
            catalogCode: 'axisContentCatalog',
            impactMessage: 'Axis will load its managed Online experience.',
            rollbackMessage:
              'The previous Online release can be restored when one exists.',
            releaseChecksum: 'axis-release-checksum',
            publicationCode: 'publication',
            workflowRef: 'axis-approval-1',
            requestedBy: 'admin',
            requestedAt: '2026-08-14T11:00:00.000Z',
            tenant: 'default',
            validation: { status: 'PASSED', warnings: [] },
            entities: [
              {
                type: 'page',
                label: 'Pages',
                total: 10,
                added: 10,
                updated: 0,
                unchanged: 0,
                removed: 0,
              },
              {
                type: 'component',
                label: 'Components',
                total: 28,
                added: 28,
                updated: 0,
                unchanged: 0,
                removed: 0,
              },
            ],
            postPublicationCapabilities: [
              {
                title: 'Open the full Axis workspace',
                description: 'Use authorized business modules.',
              },
              {
                title: 'Preview and publish later versions',
                description: 'Keep changes safely in Staged.',
              },
            ],
          },
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Initialize and submit' })).toBeNull();
    expect(screen.getByText(/governed Process approval/)).toBeVisible();
    expect(screen.getByText('38 records')).toBeVisible();
    const publicationSummary = screen.getByRole('button', {
      name: 'Expand publication review summary',
    });
    expect(publicationSummary).toHaveAttribute('aria-expanded', 'false');
    await user.click(publicationSummary);
    expect(screen.getByText(/After approval:/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    await user.click(
      screen.getByRole('button', { name: 'Review publication details' }),
    );
    expect(
      screen.getByRole('heading', { name: 'What you are approving' }),
    ).toBeVisible();
    expect(
      screen.getByText(/Immutable release checksum: axis-release-checksum/),
    ).toBeVisible();
    expect(screen.getByText('Workflow')).toBeVisible();
    expect(screen.getByText('axis-approval-1')).toBeVisible();
    expect(screen.getByText(/Submitted by admin/)).toBeVisible();
    expect(screen.getByText('Pages: 10')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'What happens after approval' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'What you can do next' })).toBeVisible();
    expect(screen.getByText('Open the full Axis workspace')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Approve and publish' }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('renders first-run setup as expandable guidance cards', async () => {
    const user = userEvent.setup();
    render(
      <AxisInitializationWorkspace
        busy={false}
        onApprove={vi.fn()}
        onInitiate={vi.fn()}
        onLogout={vi.fn()}
        onRefresh={vi.fn()}
        status={{
          baselineCode: 'axis',
          releaseCode: 'axis:axisBaseline',
          releaseVersion: '0.0.0',
          releaseStatus: 'NOT_INSTALLED',
          readiness: 'NOT_IMPORTED',
        }}
      />,
    );

    expect(screen.getByText('First-run setup')).toBeVisible();
    expect(screen.getByText('5 steps')).toBeVisible();
    expect(screen.queryByText('Temporary recovery login')).toBeNull();
    expect(
      screen.queryByText(/Use the temporary recovery login only until/),
    ).toBeNull();

    const firstRunSetup = screen.getByRole('button', {
      name: 'Expand First-run setup',
    });
    expect(firstRunSetup).toHaveAttribute('aria-expanded', 'false');
    await user.click(firstRunSetup);

    expect(screen.getByText('Temporary recovery login')).toBeVisible();
    expect(firstRunSetup).toHaveAttribute('aria-expanded', 'true');

    const bootstrapStep = screen.getByRole('button', {
      name: 'Expand setup step 1 Bootstrap access',
    });
    expect(bootstrapStep).toHaveAttribute('aria-expanded', 'false');

    await user.click(bootstrapStep);

    expect(
      screen.getByText(/Use the temporary recovery login only until/),
    ).toBeVisible();
    expect(bootstrapStep).toHaveAttribute('aria-expanded', 'true');

    await user.click(bootstrapStep);

    expect(
      screen.queryByText(/Use the temporary recovery login only until/),
    ).toBeNull();
    expect(bootstrapStep).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows import progress without offering duplicate initialization', () => {
    render(
      <AxisInitializationWorkspace
        busy={false}
        onApprove={vi.fn()}
        onInitiate={vi.fn()}
        onLogout={vi.fn()}
        onRefresh={vi.fn()}
        status={{
          baselineCode: 'axis',
          releaseCode: 'axis:axisBaseline',
          releaseVersion: '0.0.0',
          releaseStatus: 'RUNNING',
          readiness: 'IMPORTING',
        }}
      />,
    );
    expect(screen.getByText('Import in progress')).toBeVisible();
    expect(screen.getByText(/importing the baseline into Staged/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Initialize and submit' })).toBeNull();
  });

  it('fails closed when the authoritative review is missing or does not match the workflow', () => {
    render(
      <AxisInitializationWorkspace
        busy={false}
        onApprove={vi.fn()}
        onInitiate={vi.fn()}
        onLogout={vi.fn()}
        onRefresh={vi.fn()}
        status={{
          baselineCode: 'axis',
          releaseCode: 'axis:axisBaseline',
          releaseVersion: '0.0.0',
          releaseStatus: 'CURRENT',
          readiness: 'PUBLICATION_PENDING',
          publication: {
            code: 'publication',
            state: 'PENDING_APPROVAL',
            revision: 2,
            workflowRef: 'workflow-1',
          },
        }}
      />,
    );
    expect(screen.getByText(/Approval is unavailable/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Review publication details' }),
    ).toBeNull();
  });
});
