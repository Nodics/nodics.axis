import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WasteImpactAssessments } from './WasteImpactAssessments';
import {
  loadWasteAssessments,
  mutateWasteAssessment,
  type WasteAssessmentHistory,
  type WasteReviewClientConfiguration,
} from './api/wasteReviewClient';
vi.mock('./api/wasteReviewClient', () => ({
  loadWasteAssessments: vi.fn(),
  mutateWasteAssessment: vi.fn(),
}));
const configuration = {} as WasteReviewClientConfiguration;
const labels = {
  title: 'Impact assessments',
  history: 'Assessment history',
  accepted: 'Accepted assessment',
  candidate: 'Not selected',
  select: 'Accept this assessment',
  reassess: 'Calculate new assessment',
  reason: 'Reason',
  confirm: 'Confirm',
  cancel: 'Cancel',
  confirmTitle: 'Confirm assessment action',
  explanation: 'Previous results and original rewards are preserved.',
  refresh: 'Refresh',
  recover: 'Finish pending assessment',
  saved: 'Assessment saved',
  selected: 'Accepted assessment updated',
};
const candidate = {
  code: 'NEXT',
  accepted: false,
  calculationStatus: 'ESTIMATED',
  calculatedAt: '2026-09-10T12:00:00Z',
  assessment: {
    status: 'ESTIMATED',
    methodology: { providerCode: 'WARM', providerVersion: '1' },
    indicators: [
      {
        key: 'avoidedEmissions',
        label: 'Potential CO₂e savings',
        value: '16.644901',
        unitOfMeasure: 'KG_CO2E',
      },
    ],
  },
};
const history: WasteAssessmentHistory = {
  contractVersion: 1,
  assetCode: 'A',
  assetRevision: 4,
  acceptedAssessmentCode: 'OLD',
  acceptedAssessment: { ...candidate, code: 'OLD', accepted: true },
  total: 2,
  limit: 20,
  page: 1,
  recoveryRequired: false,
  recoveryAction: null,
  items: [candidate],
  selectionHistory: { total: 0, items: [] },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadWasteAssessments).mockResolvedValue(structuredClone(history));
});
afterEach(cleanup);
it('read-only viewers see saved evidence without mutation actions', async () => {
  render(
    <WasteImpactAssessments
      configuration={configuration}
      code="S"
      canAssess={false}
      canSelect={false}
      labels={labels}
    />,
  );
  expect(await screen.findByText('Assessment history (2)')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Calculate new assessment' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Accept this assessment' }),
  ).not.toBeInTheDocument();
});
it('acceptance requires a reason and explicit confirmation of the saved candidate', async () => {
  vi.mocked(mutateWasteAssessment).mockResolvedValue({
    ...history,
    acceptedAssessmentCode: 'NEXT',
    acceptedAssessment: { ...candidate, accepted: true },
    items: [],
  });
  render(
    <WasteImpactAssessments
      configuration={configuration}
      code="S"
      canAssess
      canSelect
      labels={labels}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Accept this assessment' }),
  );
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  expect(mutateWasteAssessment).not.toHaveBeenCalled();
  await user.type(dialog.getByLabelText('Reason'), 'Reviewed the factors');
  await user.click(dialog.getByRole('button', { name: 'Confirm' }));
  await waitFor(() =>
    expect(mutateWasteAssessment).toHaveBeenCalledWith(
      configuration,
      'S',
      'SELECT',
      expect.objectContaining({
        confirmed: true,
        expectedRevision: 4,
        assessmentCode: 'NEXT',
        reason: 'Reviewed the factors',
      }),
    ),
  );
  expect(await screen.findByText('Accepted assessment updated')).toBeInTheDocument();
});
it('failed requests retain the exact command key for retry and never imply success', async () => {
  vi.mocked(mutateWasteAssessment)
    .mockRejectedValueOnce(Error('Service unavailable'))
    .mockResolvedValue(history);
  render(
    <WasteImpactAssessments
      configuration={configuration}
      code="S"
      canAssess
      canSelect={false}
      labels={labels}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Calculate new assessment' }),
  );
  const dialog = within(screen.getByRole('dialog'));
  await user.type(dialog.getByLabelText('Reason'), 'Compare provider');
  await user.click(dialog.getByRole('button', { name: 'Confirm' }));
  await screen.findByText('Service unavailable');
  await user.click(dialog.getByRole('button', { name: 'Confirm' }));
  await screen.findByText('Assessment saved');
  const calls = vi.mocked(mutateWasteAssessment).mock.calls;
  expect(calls[0]?.[3]).toEqual(calls[1]?.[3]);
});
