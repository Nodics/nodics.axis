import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../../src/app/AxisThemeProvider';
import { DataReleaseWorkbench } from '../../../../src/operations/importExport/components/DataReleaseWorkbench';
import type {
  DataRelease,
  DataReleaseDryRunSummary,
} from '../../../../src/operations/importExport/api/dataReleaseContracts';

function release(releaseCode: string, status: DataRelease['status']): DataRelease {
  const sectionCode = releaseCode.split(':')[1] ?? releaseCode;
  return {
    releaseCode,
    sectionCode,
    moduleName: 'circa.ewaste',
    displayName: releaseCode,
    canonicalIdentity: 'circa.ewaste',
    dataType: 'sample',
    version: '0.0.1',
    description: 'Circa eWaste release',
    destinationRole: 'WCMS_STAGED',
    checksum: 'a'.repeat(64),
    status,
    readiness: {
      capabilityCode: 'circa.ewaste',
      displayName: 'Circa eWaste',
      owningModule: 'circa.ewaste',
      capabilityType: 'ACCELERATOR',
      group: 'PROJECT_ACCELERATOR',
      extendsCapability: 'eWaste',
      businessOutcome: 'Publish Circa eWaste customer journey data.',
      businessStatus: status === 'CURRENT' ? 'PREPARED_STAGED' : 'NOT_PREPARED',
      technicalStatus: status,
      releaseStatus: status,
      nextAction:
        status === 'CURRENT' ? 'No import action required' : 'Prepare capability',
      blockers:
        status === 'CURRENT'
          ? []
          : [
              {
                code: 'IMPORT_NOT_STARTED',
                severity: 'ACTION',
                owner: releaseCode,
                message: 'Data release has not been installed for this runtime.',
                action: 'Prepare capability',
                repair: {
                  available: true,
                  label: 'Prepare capability',
                  operation: 'dataRelease.install',
                  action: 'PREPARE_CAPABILITY',
                  idempotent: true,
                  requiresConfirmation: false,
                },
              },
            ],
    },
  };
}

describe('DataReleaseWorkbench', () => {
  function renderWorkbench(
    overrides: Partial<ComponentProps<typeof DataReleaseWorkbench>>,
  ) {
    const props: ComponentProps<typeof DataReleaseWorkbench> = {
      catalogueErrorMessage: undefined,
      catalogueIsError: false,
      catalogueIsLoading: false,
      catalogueIsSuccess: true,
      connectionAvailable: true,
      executableReleaseCount: 1,
      operationErrorMessage: undefined,
      operationIsError: false,
      operationIsPending: false,
      operationIsSuccess: false,
      releaseType: 'sample',
      selectedReleaseCount: 1,
      selectedReleaseKeys: new Set(),
      successMessage: '',
      summary: { current: 0, installable: 1, selected: 1, total: 1 },
      visibleReleases: [release('circa.ewaste:content', 'NOT_INSTALLED')],
      onDeselectVisible: vi.fn(),
      onInstallSelected: vi.fn(),
      onSelectReleases: vi.fn(),
      onSelectVisible: vi.fn(),
      onToggleRelease: vi.fn(),
      onValidateSelected: vi.fn(),
      ...overrides,
    };
    render(
      <AxisThemeProvider>
        <DataReleaseWorkbench {...props} />
      </AxisThemeProvider>,
    );
    return props;
  }

  it('keeps every selection and command locked while an operation is pending', () => {
    const props = renderWorkbench({ operationIsPending: true });
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
    for (const name of ['Select pack', 'Select 1', 'Validate selected', 'Working…']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
    }
    expect(props.onToggleRelease).not.toHaveBeenCalled();
    expect(props.onSelectReleases).not.toHaveBeenCalled();
    expect(props.onInstallSelected).not.toHaveBeenCalled();
  });

  it('shows raw release evidence without inventing missing readiness or repair authority', () => {
    renderWorkbench({
      visibleReleases: [
        {
          ...release('circa.ewaste:content', 'UPDATE_AVAILABLE'),
          readiness: undefined,
          installedVersion: '0.0.0',
        },
      ],
    });
    expect(screen.getByText('Installed 0.0.0')).toBeVisible();
    expect(screen.getByText('Available 0.0.1')).toBeVisible();
    expect(screen.getByText('Target WCMS_STAGED')).toBeVisible();
    expect(screen.queryByText('Preparation readiness')).not.toBeInTheDocument();
    expect(screen.queryByText('Repair available')).not.toBeInTheDocument();
  });

  it('does not let a current release hide incoming release blockers in the same capability', () => {
    const current = { ...release('circa.ewaste:aaa', 'CURRENT'), moduleIndex: '1' };
    const incoming = {
      ...release('circa.ewaste:zzz', 'UPDATE_AVAILABLE'),
      moduleIndex: '2',
    };
    renderWorkbench({
      visibleReleases: [current, incoming],
      summary: { current: 1, installable: 1, selected: 0, total: 2 },
    });
    const readiness = screen
      .getByRole('heading', { name: 'Preparation readiness' })
      .closest('section');
    // The owning status and blockers must survive release ordering.
    expect(readiness).not.toBeNull();
    expect(within(readiness!).getByText('NOT_PREPARED')).toBeVisible();
    expect(
      within(readiness!).getByText(
        'Data release has not been installed for this runtime.',
      ),
    ).toBeVisible();
    expect(within(readiness!).queryByText('PREPARED_STAGED')).not.toBeInTheDocument();
  });

  it.each([
    ['RUNNING', 'Running'],
    ['DOWNGRADE_AVAILABLE', 'Downgrade Available'],
  ] as const)('keeps %s out of repair and non-selectable', (status, heading) => {
    renderWorkbench({
      visibleReleases: [
        { ...release('circa.ewaste:content', status), readiness: undefined },
      ],
      executableReleaseCount: 0,
      selectedReleaseCount: 0,
      summary: { current: 0, installable: 0, selected: 0, total: 1 },
    });
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Requires repair' }),
    ).not.toBeInTheDocument();
    for (const checkbox of screen.getAllByRole('checkbox'))
      expect(checkbox).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Install or update selected' }),
    ).toBeDisabled();
  });

  it('groups readiness by capability and selects actionable releases only', async () => {
    const actionable = release('circa.ewaste:content', 'NOT_INSTALLED');
    const current = release('circa.ewaste:profile', 'CURRENT');
    const onSelectReleases = vi.fn();
    render(
      <AxisThemeProvider>
        <DataReleaseWorkbench
          catalogueErrorMessage={undefined}
          catalogueIsError={false}
          catalogueIsLoading={false}
          catalogueIsSuccess
          connectionAvailable
          executableReleaseCount={1}
          operationErrorMessage={undefined}
          operationIsError={false}
          operationIsPending={false}
          operationIsSuccess={false}
          releaseType="sample"
          selectedReleaseCount={0}
          selectedReleaseKeys={new Set()}
          successMessage=""
          summary={{ current: 1, installable: 1, selected: 0, total: 2 }}
          visibleReleases={[actionable, current]}
          onDeselectVisible={vi.fn()}
          onInstallSelected={vi.fn()}
          onSelectReleases={onSelectReleases}
          onSelectVisible={vi.fn()}
          onToggleRelease={vi.fn()}
          onValidateSelected={vi.fn()}
        />
      </AxisThemeProvider>,
    );

    expect(screen.getByText('Preparation readiness')).toBeInTheDocument();
    expect(screen.getByText('Business packs')).toBeInTheDocument();
    expect(screen.getByText(/Start from the business outcome/iu)).toBeInTheDocument();
    expect(screen.getByText('Select pack')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Recommended preparation sequence'),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('1/2 current · 1 need action')).toBeInTheDocument();
    expect(screen.getByText('Circa eWaste')).toBeInTheDocument();
    expect(screen.getAllByText('Project accelerator').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Outcome: Publish Circa eWaste customer journey data.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/extends eWaste/u)).toBeInTheDocument();
    expect(
      screen.getByText(/Import into the staged runtime first/iu),
    ).toBeInTheDocument();
    expect(screen.getAllByText('1/2 current').length).toBeGreaterThan(0);
    expect(screen.getByText('Repair available')).toBeInTheDocument();
    expect(
      screen.getByText(/PREPARE_CAPABILITY · dataRelease\.install/u),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Select 1' }));

    expect(onSelectReleases).toHaveBeenCalledTimes(1);
    expect(onSelectReleases).toHaveBeenCalledWith([actionable]);
  });

  it('shows backend dry-run guidance after validation', () => {
    const actionable = release('circa.ewaste:content', 'NOT_INSTALLED');
    const dryRun: DataReleaseDryRunSummary = {
      mode: 'VALIDATE',
      validationOnly: true,
      importExecuted: false,
      dataType: 'sample',
      tenant: 'default',
      totalReleases: 1,
      executableReleases: 1,
      alreadyCurrent: 0,
      blockedReleases: 0,
      summary: {
        install: 1,
        update: 0,
        retry: 0,
        skip: 0,
        blocked: 0,
        wait: 0,
      },
      outcomes: [
        {
          releaseCode: 'circa.ewaste:content',
          displayName: 'Circa content',
          moduleName: 'circa.ewaste',
          status: 'NOT_INSTALLED',
          operation: 'INSTALL',
          impact: 'Release will be installed for this runtime.',
          nextAction: 'Prepare capability',
          blockers: [],
        },
      ],
      publicationFollowUps: [
        {
          releaseCode: 'circa.ewaste:content',
          displayName: 'Circa content',
          moduleName: 'circa.ewaste',
          publicationPolicy: 'REQUIRED',
          initialPublicationPolicy: 'ADMIN_INITIATED',
          sourceRole: 'WCMS_STAGED',
          targetRole: 'WCMS_ONLINE',
          siteCode: 'circa',
          workflowRequired: true,
          nextAction: 'Import release, then request publication approval',
          impact:
            'Imported data remains staged until governed publication makes it Online.',
        },
      ],
      messages: ['Dry-run validated the selected release plan. No data was imported.'],
    };
    render(
      <AxisThemeProvider>
        <DataReleaseWorkbench
          catalogueErrorMessage={undefined}
          catalogueIsError={false}
          catalogueIsLoading={false}
          catalogueIsSuccess
          connectionAvailable
          dryRun={{
            ...dryRun,
            outcomes: Array.from({ length: 9 }, (_, index) => ({
              ...dryRun.outcomes[0]!,
              releaseCode: `content-${index}`,
              displayName: index === 0 ? 'Circa content' : `Incoming release ${index}`,
            })),
            publicationFollowUps: Array.from({ length: 7 }, (_, index) => ({
              ...dryRun.publicationFollowUps[0]!,
              releaseCode: `follow-up-${index}`,
              displayName: `Publication follow-up ${index}`,
            })),
          }}
          executableReleaseCount={1}
          operationErrorMessage={undefined}
          operationIsError={false}
          operationIsPending={false}
          operationIsSuccess
          releaseType="sample"
          selectedReleaseCount={1}
          selectedReleaseKeys={new Set([actionable.releaseCode ?? ''])}
          successMessage="1 sample release validated by the backend."
          summary={{ current: 0, installable: 1, selected: 1, total: 1 }}
          visibleReleases={[actionable]}
          onDeselectVisible={vi.fn()}
          onInstallSelected={vi.fn()}
          onSelectReleases={vi.fn()}
          onSelectVisible={vi.fn()}
          onToggleRelease={vi.fn()}
          onValidateSelected={vi.fn()}
        />
      </AxisThemeProvider>,
    );

    expect(screen.getByText('Dry-run result')).toBeInTheDocument();
    expect(screen.getByText(/No data was imported/u)).toBeInTheDocument();
    expect(screen.getAllByText('Install').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Circa content').length).toBeGreaterThan(0);
    expect(screen.getByText('Publication follow-up required')).toBeInTheDocument();
    expect(screen.getAllByText('To WCMS_ONLINE')).toHaveLength(7);
    expect(screen.getByText('Incoming release 8')).toBeVisible();
    expect(screen.getByText('Publication follow-up 6')).toBeVisible();
  });
});
