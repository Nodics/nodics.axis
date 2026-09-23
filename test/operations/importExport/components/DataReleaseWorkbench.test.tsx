import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../../src/app/AxisThemeProvider';
import { DataReleaseWorkbench } from '../../../../src/operations/importExport/components/DataReleaseWorkbench';
import type { DataRelease } from '../../../../src/operations/importExport/api/dataReleaseContracts';

function release(
  releaseCode: string,
  status: DataRelease['status'],
): DataRelease {
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
      businessStatus: status === 'CURRENT' ? 'PREPARED_STAGED' : 'NOT_PREPARED',
      technicalStatus: status,
      releaseStatus: status,
      nextAction: status === 'CURRENT' ? 'No import action required' : 'Prepare capability',
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
    expect(screen.getByText('Circa eWaste')).toBeInTheDocument();
    expect(screen.getByText('1/2 current')).toBeInTheDocument();
    expect(screen.getByText('Repair available')).toBeInTheDocument();
    expect(screen.getByText(/PREPARE_CAPABILITY · dataRelease\.install/u)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Select 1' }));

    expect(onSelectReleases).toHaveBeenCalledTimes(1);
    expect(onSelectReleases).toHaveBeenCalledWith([actionable]);
  });
});
