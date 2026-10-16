import { act, render, screen, within, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteManagementRoutePage } from '../../src/operations/wasteManagement/WasteManagementRoutePage';
import {
  decideWasteReview,
  rejectWasteEvidence,
  loadWasteOperationsContext,
  verifyWasteSubmission,
  loadWasteAudit,
  loadWasteReviewPage,
  loadWasteReviewDetail,
  loadWasteReviewPhoto,
  assignWasteReview,
  retryWasteOutcome,
  resolveWasteOutcome,
  type WasteItemDescriptor,
} from '../../src/operations/wasteManagement/api/wasteReviewClient';
vi.mock('../../src/operations/wasteManagement/api/wasteReviewClient', () => ({
  decideWasteReview: vi.fn(),
  rejectWasteEvidence: vi.fn(),
  loadWasteOperationsContext: vi.fn(),
  verifyWasteSubmission: vi.fn(),
  loadWasteAudit: vi.fn(),
  loadWasteReviewPage: vi.fn(),
  loadWasteReviewDetail: vi.fn(),
  assignWasteReview: vi.fn(),
  recoverWasteReview: vi.fn(),
  retryWasteOutcome: vi.fn(),
  resolveWasteOutcome: vi.fn(),
  loadWasteReviewPhoto: vi.fn(),
}));
const assignmentLabels = {
  evidenceReject: 'Reject unusable evidence',
  evidenceRejectTitle: 'Confirm evidence-only rejection',
  evidenceRejectExplanation:
    'Original evidence is retained. No physical verification, asset, custody or reward is created.',
  evidenceRejectSaved: 'Evidence rejected without physical verification.',
  evidenceRejectBasis: 'Evidence-only rejection',
  outcomeNotification: 'Outcome notification',
  outcomeRetry: 'Retry notification',
  assign: 'Assign to me',
  release: 'Return to review queue',
  readOnlyMode: 'Read-only preview',
  assignmentRequired:
    'Assign this submission to yourself to edit its properties and record your review.',
  assignedToYou: 'Assigned to you',
  assignedTo: 'Assigned reviewer',
  assignmentOwned: 'You are responsible for this review.',
  assignmentElsewhere:
    'This submission is read-only while another employee is reviewing it.',
  assigning: 'Assigning…',
  releasing: 'Returning to queue…',
  assignmentSaved: 'Assignment saved.',
  releaseSaved: 'Returned to queue.',
  releaseDirty:
    'Save or discard your changes before returning this review to the queue.',
};
const submission = {
  code: 'WST_TEST',
  revision: 4,
  submissionStatus: 'SUBMITTED',
  submitterRef: { code: 'customer' },
  submittedFacts: {
    name: 'Customer tablet',
    itemTypeCode: 'TABLET_DEVICE',
    quantity: 1,
    conditionGrade: 'RECYCLABLE',
  },
  metadata: {
    photo: { code: 'PHOTO_TEST' },
    reviewAssignment: { type: 'EMPLOYEE' as const, principalCode: 'operator' },
  },
};
const descriptor: WasteItemDescriptor = {
  contractVersion: 1,
  stage: 'SUBMITTED',
  identity: { name: 'Customer tablet', description: null, brand: null, model: null },
  classification: {
    family: { code: null, name: null },
    category: { code: null, name: null },
    itemType: { code: null, name: null },
  },
  physical: {
    quantity: 1,
    size: { value: 'UNKNOWN', basis: 'UNKNOWN' },
    weight: { value: null, basis: 'UNKNOWN', unit: 'KG' },
    weightEstimate: { min: null, max: null, unit: 'KG', basis: 'UNKNOWN' },
    dimensionsEstimate: null,
  },
  condition: { value: 'UNKNOWN', basis: 'UNKNOWN' },
  materials: [],
  environment: {
    assessment: null,
    observations: {
      recyclability: { value: 'UNKNOWN', basis: 'UNKNOWN' },
      contamination: { value: 'UNKNOWN', basis: 'UNKNOWN' },
      recoveryPotential: { value: 'UNKNOWN', basis: 'UNKNOWN' },
      hazards: [],
    },
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadWasteOperationsContext).mockResolvedValue({
    principalCode: 'operator',
    canVerify: true,
    canApprove: true,
    canReadEvidence: true,
    canAudit: false,
    canAssign: true,
    reviewWorkspace: { defaultPageSize: 25, labels: assignmentLabels, statuses: [] },
    requireVerification: false,
    requireDifferentApprover: false,
    presentation: {
      title: 'Waste verification and approval',
      verifyAction: 'Review verification',
      verifyTitle: 'Confirm verified facts',
      verifySaved: 'Verification saved.',
    },
  });
  vi.mocked(verifyWasteSubmission).mockResolvedValue({});
  vi.mocked(loadWasteAudit).mockResolvedValue([]);
  vi.mocked(loadWasteReviewDetail).mockResolvedValue(submission);
  vi.mocked(loadWasteReviewPage).mockResolvedValue({
    contractVersion: 1,
    items: [submission],
    total: 1,
    page: 1,
    limit: 25,
    counts: { OPEN: 1 },
  });
  vi.mocked(loadWasteReviewPhoto).mockResolvedValue('data:image/png;base64,test');
  vi.mocked(decideWasteReview).mockResolvedValue({ settlementStatus: 'COMPLETED' });
});
function renderPage(viewCode?: string) {
  const navigation = {
    ...(viewCode
      ? {
          backendWorkspace: {
            contractVersion: 1,
            renderer: 'axis.workspace.native',
            workspaceCode: 'waste.review',
            viewCode,
            title: 'Waste view',
            tabs: [],
          },
        }
      : {}),
    id: 'circa-waste-operations',
    moduleName: 'eWaste',
    label: 'Circa Waste Operations',
    route: '/waste/assets',
    category: 'waste',
    icon: 'waste',
    order: 1545,
    availability: 'UP',
    featureState: 'PREVIEW',
    perspectives: [],
    contexts: [],
  } as const;

  let props: ComponentProps<typeof WasteManagementRoutePage> = {
    accessToken: 'token',
    bootstrap: {
      navigation: [navigation],
      moduleConnections: {
        eWaste: [
          {
            moduleName: 'eWaste',
            instanceId: 'waste-one',
            endpoint: 'https://waste.example/nodics/eWaste',
            environment: 'Local',
            server: 'wasteServer',
            state: 'UP',
          },
        ],
      },
      tenantCode: 'default',
    } as never,
    employeeId: 'operator',
    sessionGeneration: 1,
    navigation,
    runtime: { enterpriseCode: 'default', requestTimeoutMs: 1000 } as never,
  };
  const result = render(<WasteManagementRoutePage {...props} />);
  return {
    ...result,
    get pageProps() {
      return props;
    },
    rerenderPage(overrides: Partial<typeof props>) {
      props = { ...props, ...overrides };
      result.rerender(<WasteManagementRoutePage {...props} />);
    },
    refreshPage(overrides: Partial<typeof props> = {}) {
      props = { ...props, bootstrap: structuredClone(props.bootstrap), ...overrides };
      result.rerender(<WasteManagementRoutePage {...props} />);
    },
  };
}

describe('fresh selected owner detail', () => {
  it.each([true, false, undefined])(
    'reads a descriptor-bearing queue row once and uses owner recovery %s',
    async (available) => {
      const row = {
        ...submission,
        descriptor,
        submissionStatus: 'APPROVED',
        reviewDiagnostic: {
          code: 'ERR_EWASTE_REWARD_ASSESSMENT_REQUIRED',
          stage: 'REWARD_ASSESSMENT',
          message: 'Recovery requires saved evidence.',
          retryAllowed: false,
        },
      };
      const detail = {
        ...row,
        revision: 5,
        ...(available === undefined
          ? {}
          : {
              savedRewardRecovery: {
                available,
                message: available
                  ? 'Saved evidence is ready.'
                  : 'Saved evidence is missing.',
              },
            }),
      };
      let resolve!: (value: typeof detail) => void;
      vi.mocked(loadWasteReviewDetail).mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [row],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      const page = renderPage();
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
      await waitFor(() => expect(loadWasteReviewDetail).toHaveBeenCalledOnce());
      expect(
        screen.getByRole('button', { name: 'Review settlement retry' }),
      ).toBeDisabled();
      await act(async () => {
        resolve(detail);
        await Promise.resolve();
      });
      const button = screen.getByRole('button', { name: 'Review settlement retry' });
      if (available === true) expect(button).toBeEnabled();
      else expect(button).toBeDisabled();
      if (detail.savedRewardRecovery)
        expect(screen.getByText(detail.savedRewardRecovery.message)).toBeVisible();
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [{ ...row, revision: 5 }],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      page.refreshPage();
      await waitFor(() => expect(loadWasteReviewPage).toHaveBeenCalledTimes(2));
      expect(loadWasteReviewDetail).toHaveBeenCalledOnce();
      if (available === true)
        expect(
          screen.getByRole('button', { name: 'Review settlement retry' }),
        ).toBeEnabled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    'uses fresh evidence eligibility %s rather than descriptor-bearing queue claims',
    async (available) => {
      const row = { ...submission, descriptor, evidenceRejectionAvailable: !available };
      let resolve!: (value: typeof row) => void;
      vi.mocked(loadWasteReviewDetail).mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [row],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      renderPage();
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
      await waitFor(() => expect(loadWasteReviewDetail).toHaveBeenCalledOnce());
      expect(
        screen.queryByRole('button', { name: assignmentLabels.evidenceReject }),
      ).not.toBeInTheDocument();
      await act(async () => {
        resolve({ ...row, evidenceRejectionAvailable: available });
        await Promise.resolve();
      });
      if (available)
        expect(
          screen.getByRole('button', { name: assignmentLabels.evidenceReject }),
        ).toBeVisible();
      else
        expect(
          screen.queryByRole('button', { name: assignmentLabels.evidenceReject }),
        ).not.toBeInTheDocument();
      expect(loadWasteReviewDetail).toHaveBeenCalledOnce();
      expect(rejectWasteEvidence).not.toHaveBeenCalled();
    },
  );
});

describe('evidence-only rejection', () => {
  it('retains original evidence, public reason, outcome and audit without a verified-facts form after evidence-only rejection', async () => {
    const publicReason =
      'This illustration does not show a physical item and cannot be verified.';
    const record = {
      ...submission,
      descriptor,
      submissionStatus: 'REJECTED',
      outcomeNotification: { status: 'UNCERTAIN', retryAllowed: false },
      metadata: {
        ...submission.metadata,
        reviewBasis: 'EVIDENCE_ONLY' as const,
        publicReason,
      },
    };
    const context = await loadWasteOperationsContext({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...context,
      canAudit: true,
      presentation: {
        ...context.presentation,
        auditAction: 'View review audit',
        auditTitle: 'Waste review audit',
      },
      reviewWorkspace: {
        ...context.reviewWorkspace,
        defaultPageSize: 25,
        statuses: [],
        labels: {
          ...assignmentLabels,
          auditAction: 'View review audit',
          auditTitle: 'Waste review audit',
        },
        fields: [{ key: 'categoryCode', label: 'Verified category', type: 'string' }],
      },
    });
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(record);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [record],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await waitFor(() => expect(loadWasteReviewDetail).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole('img', { name: 'Original submission evidence' }),
    ).toBeVisible();
    expect(screen.getByText(publicReason)).toBeVisible();
    expect(screen.getByText(assignmentLabels.evidenceRejectBasis)).toBeVisible();
    expect(screen.getByText(/Outcome notification: UNCERTAIN/)).toBeVisible();
    expect(screen.queryByLabelText('Final verified name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Verified category')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Review feedback')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(
      await screen.findByRole('button', { name: 'View review audit' }),
    ).toBeVisible();
    expect(decideWasteReview).not.toHaveBeenCalled();
  });

  async function setup(
    options: { assigned?: boolean; allowed?: boolean; available?: boolean } = {},
  ) {
    const record = {
      ...submission,
      evidenceRejectionAvailable: options.available ?? true,
      metadata: {
        ...submission.metadata,
        reviewAssignment:
          options.assigned === false
            ? { type: 'QUEUE' as const }
            : submission.metadata.reviewAssignment,
      },
    };
    const context = await loadWasteOperationsContext({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...context,
      requireVerification: true,
      canApprove: options.allowed ?? true,
    });
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(record);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [record],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await screen.findByRole('textbox', { name: 'Review feedback' });
    return { user, record };
  }

  it('uses the separate owner command with reason only while ordinary approval/rejection remain verification-gated', async () => {
    const { user, record } = await setup();
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review rejection' })).toBeDisabled();
    const action = screen.getByRole('button', {
      name: assignmentLabels.evidenceReject,
    });
    expect(action).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'Review feedback' }),
      'Please provide an actual item photograph.',
    );
    await user.click(action);
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(assignmentLabels.evidenceRejectExplanation),
    ).toBeVisible();
    expect(rejectWasteEvidence).not.toHaveBeenCalled();
    vi.mocked(rejectWasteEvidence).mockResolvedValue({
      decisionBasis: 'EVIDENCE_ONLY',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm decision' }));
    expect(await screen.findByText(assignmentLabels.evidenceRejectSaved)).toBeVisible();
    expect(rejectWasteEvidence).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      record,
      'Please provide an actual item photograph.',
    );
    expect(decideWasteReview).not.toHaveBeenCalled();
    expect(verifyWasteSubmission).not.toHaveBeenCalled();
  });

  it.each([{ assigned: false }, { allowed: false }, { available: false }])(
    'does not expose evidence rejection without owner eligibility, assignment and permission: %j',
    async (options) => {
      await setup(options);
      expect(
        screen.queryByRole('button', { name: assignmentLabels.evidenceReject }),
      ).not.toBeInTheDocument();
      expect(rejectWasteEvidence).not.toHaveBeenCalled();
    },
  );

  it('preserves the reason and shows owner refusal in the active confirmation without replay', async () => {
    const { user } = await setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Review feedback' }),
      'Unusable photo',
    );
    await user.click(
      screen.getByRole('button', { name: assignmentLabels.evidenceReject }),
    );
    vi.mocked(rejectWasteEvidence).mockRejectedValue(
      new Error('Review evidence changed; reload the submission.'),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm decision' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Review evidence changed; reload the submission.',
    );
    expect(within(dialog).getByText('Unusable photo')).toBeVisible();
    expect(rejectWasteEvidence).toHaveBeenCalledOnce();
    expect(decideWasteReview).not.toHaveBeenCalled();
  });
});

describe('settlement confirmation feedback', () => {
  async function openSettlementConfirmation() {
    const approved = { ...submission, submissionStatus: 'APPROVED' };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(approved);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [approved],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    const page = renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Review settlement retry' }),
    );
    return { user, page, dialog: screen.getByRole('dialog'), approved };
  }

  it.each([
    ['BLOCKED', 'Confirmed reward evidence needs owner recovery.', 'warning'],
    ['PENDING', 'The owner retained the settlement for recovery.', 'warning'],
    ['COMPLETED', 'The owner confirmed the original settlement.', 'success'],
  ])(
    'renders %s with owner copy and accurate severity, without automatic retry',
    async (status, message, severity) => {
      vi.mocked(decideWasteReview).mockResolvedValue({
        settlementStatus: status,
        settlementMessage: message,
      });
      const { user, dialog, approved } = await openSettlementConfirmation();
      await user.click(
        within(dialog).getByRole('button', { name: 'Confirm decision' }),
      );
      const alert = await screen.findByText(message);
      expect(alert.closest('[role="alert"]')).toHaveClass(
        `MuiAlert-color${severity.charAt(0).toUpperCase() + severity.slice(1)}`,
      );
      expect(screen.queryByText('Review decision saved.')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Confirm reward settlement retry' }),
      ).not.toBeInTheDocument();
      expect(decideWasteReview).toHaveBeenCalledOnce();
      expect(decideWasteReview).toHaveBeenCalledWith(
        expect.anything(),
        approved,
        'APPROVED',
        '',
        { name: 'Customer tablet' },
        false,
      );
    },
  );

  it.each([
    ['BLOCKED', 'Reward settlement is blocked.', 'Warning'],
    ['PENDING', 'Decision saved. Reward settlement needs retry.', 'Warning'],
    ['COMPLETED', 'Reward settlement completed.', 'Success'],
    [undefined, 'Settlement completion was not confirmed.', 'Info'],
    ['UNKNOWN', 'Settlement completion was not confirmed.', 'Info'],
  ])(
    'does not invent completion when settlement status is %s and owner copy is absent',
    async (status, message, severity) => {
      vi.mocked(decideWasteReview).mockResolvedValue(
        status === undefined ? {} : { settlementStatus: status },
      );
      const { user, dialog } = await openSettlementConfirmation();
      await user.click(
        within(dialog).getByRole('button', { name: 'Confirm decision' }),
      );
      const alert = await screen.findByText(message);
      expect(alert.closest('[role="alert"]')).toHaveClass(`MuiAlert-color${severity}`);
      expect(screen.queryByText('Review decision saved.')).not.toBeInTheDocument();
      expect(decideWasteReview).toHaveBeenCalledOnce();
    },
  );

  it('shows a rejected mutation inside the active modal, preserves the decision and never retries automatically', async () => {
    const message = 'Record not found: Approved asset was not found';
    vi.mocked(decideWasteReview).mockRejectedValue(new Error(message));
    const { user, dialog } = await openSettlementConfirmation();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm decision' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByRole('alert')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Confirm decision' }),
    ).toBeEnabled();
    expect(screen.queryByText('Review decision saved.')).not.toBeInTheDocument();
    expect(loadWasteReviewPage).toHaveBeenCalledOnce();
    expect(decideWasteReview).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(message)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Review settlement retry' }));
    expect(
      within(screen.getByRole('dialog')).queryByRole('alert'),
    ).not.toBeInTheDocument();
    expect(decideWasteReview).toHaveBeenCalledOnce();
  });
});

describe('owner recovery diagnostics', () => {
  it.each([
    {
      classification: 'TRANSPORT_ACK_UNCONFIRMED',
      message: 'The original send acknowledgement is unconfirmed.',
      attempt: 1,
    },
    {
      classification: 'DIAGNOSTIC_UNAVAILABLE',
      message: 'The owner could not qualify this diagnostic.',
    },
    {
      classification: 'UNRECOGNIZED',
      message: 'Do not render this unregistered field.',
      attempt: 1,
    },
  ])(
    'renders only fresh safe notification diagnosis: $classification',
    async (diagnostic) => {
      const row = {
        ...submission,
        descriptor,
        submissionStatus: 'REJECTED',
        outcomeNotification: { status: 'UNCERTAIN', retryAllowed: false },
      };
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [row],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      vi.mocked(loadWasteReviewDetail).mockResolvedValue({
        ...row,
        notificationDiagnostic: diagnostic,
      });
      renderPage();
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
      await waitFor(() => expect(loadWasteReviewDetail).toHaveBeenCalledOnce());
      if (diagnostic.classification === 'UNRECOGNIZED')
        expect(screen.queryByText(diagnostic.message)).not.toBeInTheDocument();
      else expect(await screen.findByText(diagnostic.message)).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Retry notification' }),
      ).not.toBeInTheDocument();
      expect(retryWasteOutcome).not.toHaveBeenCalled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      available: true,
      message: 'The saved immutable evidence qualifies for recovery.',
    },
    { available: false, message: 'No saved immutable evidence was found.' },
    { available: true, message: '' },
    { available: true, message: 'x'.repeat(1001) },
  ])(
    'uses bounded explicit saved-evidence recovery admission: %j',
    async (recovery) => {
      const approved = {
        ...submission,
        submissionStatus: 'APPROVED',
        savedRewardRecovery: recovery,
        reviewDiagnostic: {
          code: 'ERR_EWASTE_REWARD_ASSESSMENT_REQUIRED',
          stage: 'REWARD_ASSESSMENT',
          message: 'Confirmed reward evidence needs owner recovery.',
          retryAllowed: false,
        },
      };
      vi.mocked(loadWasteReviewDetail).mockResolvedValue(approved);
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [approved],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      renderPage();
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
      const button = await screen.findByRole('button', {
        name: 'Review settlement retry',
      });
      const validMessage =
        recovery.message.length > 0 && recovery.message.length <= 1000;
      if (validMessage) expect(await screen.findByText(recovery.message)).toBeVisible();
      if (recovery.available && validMessage) {
        expect(button).toBeEnabled();
        await user.click(button);
        expect(
          within(screen.getByRole('dialog')).getByText(recovery.message),
        ).toBeVisible();
      } else {
        expect(button).toBeDisabled();
      }
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it('shows missing confirmed evidence and refuses settlement-only recovery', async () => {
    const approved = {
      ...submission,
      submissionStatus: 'APPROVED',
      reviewDiagnostic: {
        code: 'ERR_EWASTE_REWARD_ASSESSMENT_REQUIRED',
        stage: 'REWARD_ASSESSMENT',
        message: 'Confirmed reward evidence needs owner recovery.',
        retryAllowed: false,
      },
    };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(approved);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [approved],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    renderPage();
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
    expect(
      await screen.findByText('Confirmed reward evidence needs owner recovery.'),
    ).toBeVisible();
    expect(
      screen.getByText(/REWARD_ASSESSMENT: ERR_EWASTE_REWARD_ASSESSMENT_REQUIRED/),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Review settlement retry' }),
    ).toBeDisabled();
    expect(decideWasteReview).not.toHaveBeenCalled();
  });

  it('keeps resolution failures visible inside the active confirmation and preserves the reason without retrying', async () => {
    const record = {
      ...submission,
      submissionStatus: 'REJECTED',
      metadata: {
        ...submission.metadata,
        outcomeDelivery: { intentCode: 'COMM_TEST', status: 'UNCERTAIN', revision: 4 },
      },
    };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(record);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [record],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    vi.mocked(resolveWasteOutcome).mockRejectedValue(
      new Error('ERR_COMMS_INTEGRATION_CONTEXT'),
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Authorize one resend' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Confirm notification resolution',
    });
    const reason = 'Original delivery remains uncertain; authorize one retry.';
    await user.type(
      within(dialog).getByLabelText('Reason or delivery evidence'),
      reason,
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Confirm resolution' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'ERR_COMMS_INTEGRATION_CONTEXT',
    );
    expect(within(dialog).getByLabelText('Reason or delivery evidence')).toHaveValue(
      reason,
    );
    expect(
      within(dialog).getByRole('button', { name: 'Confirm resolution' }),
    ).toBeEnabled();
    expect(resolveWasteOutcome).toHaveBeenCalledOnce();
    expect(retryWasteOutcome).not.toHaveBeenCalled();
  });

  it('retains the authorized pending diagnosis after one explicit notification retry and never retries automatically', async () => {
    const rejected = {
      ...submission,
      submissionStatus: 'REJECTED',
      outcomeNotification: { status: 'NOT_ESTABLISHED', retryAllowed: true },
    };
    const diagnosed = {
      ...rejected,
      revision: 5,
      outcomeNotification: {
        status: 'PENDING',
        message: 'Notification service admission needs administrator review.',
        retryAllowed: false,
      },
      metadata: {
        ...rejected.metadata,
        outcomeDelivery: {
          status: 'PENDING',
          message: 'Notification service admission needs administrator review.',
          diagnostic: {
            code: 'ERR_EWASTE_OUTCOME_ADMISSION_REQUIRED',
            stage: 'ADMISSION',
            message: 'Notification service admission needs administrator review.',
            retryAllowed: false,
          },
        },
      },
    };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(rejected);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [rejected],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    vi.mocked(retryWasteOutcome).mockImplementation(() => {
      vi.mocked(loadWasteReviewDetail).mockResolvedValue(diagnosed);
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [diagnosed],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      return Promise.resolve(diagnosed);
    });
    const page = renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Retry notification' }));
    expect(
      await screen.findByText(
        'Notification service admission needs administrator review.',
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/ADMISSION: ERR_EWASTE_OUTCOME_ADMISSION_REQUIRED/),
    ).toBeVisible();
    page.refreshPage();
    await waitFor(() => expect(loadWasteReviewPage).toHaveBeenCalledTimes(3));
    expect(retryWasteOutcome).toHaveBeenCalledTimes(1);
    expect(decideWasteReview).not.toHaveBeenCalled();
    expect(
      screen.getByText('Notification service admission needs administrator review.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Retry notification' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    undefined,
    { status: 'PENDING', retryAllowed: 'true' },
    {
      status: 'NOT_ESTABLISHED',
      message: 'Original review authority is not established.',
      retryAllowed: false,
    },
    { status: 'DELIVERED', retryAllowed: false },
    { status: 'UNCONFIGURED', retryAllowed: false },
  ])(
    'fails closed for missing, malformed or non-retryable owner summary %#',
    async (summary) => {
      const final = {
        ...submission,
        submissionStatus: 'REJECTED',
        outcomeNotification: summary as never,
        metadata: {
          ...submission.metadata,
          reviewKey: 'private-key-is-not-authority',
          reviewDecision: 'REJECTED',
          outcomeDelivery: {
            status: 'PENDING',
            message: 'Legacy metadata must not supply summary copy.',
            diagnostic: {
              stage: 'ADMISSION',
              code: 'ERR_TEST',
              message: 'unused',
              retryAllowed: true,
            },
          },
        },
      };
      vi.mocked(loadWasteReviewDetail).mockResolvedValue(final);
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [final],
        total: 1,
        page: 1,
        limit: 25,
        counts: {},
      });
      const user = userEvent.setup();
      renderPage();
      await user.click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
      await screen.findByRole('img', { name: 'Original submission evidence' });
      expect(
        screen.queryByRole('button', { name: 'Retry notification' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Legacy metadata must not supply summary copy.'),
      ).not.toBeInTheDocument();
      if (summary?.status === 'NOT_ESTABLISHED') {
        expect(
          screen.getByText('Original review authority is not established.'),
        ).toBeVisible();
        expect(screen.getByText(/Outcome notification: NOT_ESTABLISHED/)).toBeVisible();
      }
      if (summary?.status === 'DELIVERED')
        expect(screen.getByText(/Outcome notification: DELIVERED/)).toBeVisible();
      if (summary?.status === 'UNCONFIGURED')
        expect(screen.getByText(/Outcome notification: UNCONFIGURED/)).toBeVisible();
      if (!summary || typeof summary.retryAllowed !== 'boolean')
        expect(screen.queryByText(/Outcome notification:/)).not.toBeInTheDocument();
      expect(retryWasteOutcome).not.toHaveBeenCalled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it('uses owner labels and explicit summary retry without requiring metadata or inventing delivery', async () => {
    const context = await vi.mocked(loadWasteOperationsContext)({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...context,
      reviewWorkspace: {
        ...context.reviewWorkspace!,
        labels: {
          ...assignmentLabels,
          outcomeNotification: 'Owner notice state',
          outcomeRetry: 'Recover original notice',
        },
      },
    });
    const final = {
      ...submission,
      submissionStatus: 'REJECTED',
      outcomeNotification: {
        status: 'NOT_ESTABLISHED',
        message: 'No delivery is established.',
        retryAllowed: true,
      },
    };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(final);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [final],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    vi.mocked(retryWasteOutcome).mockResolvedValue(final);
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    expect(
      await screen.findByText(/Owner notice state: NOT_ESTABLISHED/),
    ).toBeVisible();
    expect(screen.queryByText(/PENDING/)).not.toBeInTheDocument();
    expect(retryWasteOutcome).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Recover original notice' }));
    await waitFor(() => expect(retryWasteOutcome).toHaveBeenCalledTimes(1));
    expect(decideWasteReview).not.toHaveBeenCalled();
  });

  it('does not invent notification labels or retry copy for an older workspace', async () => {
    const context = await vi.mocked(loadWasteOperationsContext)({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...context,
      reviewWorkspace: { ...context.reviewWorkspace!, labels: {} },
    });
    const final = {
      ...submission,
      submissionStatus: 'REJECTED',
      outcomeNotification: { status: 'NOT_ESTABLISHED', retryAllowed: true },
    };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(final);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [final],
      total: 1,
      page: 1,
      limit: 25,
      counts: {},
    });
    renderPage();
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
    await screen.findByRole('img', { name: 'Original submission evidence' });
    expect(screen.queryByText(/Outcome notification:/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry notification' }),
    ).not.toBeInTheDocument();
    expect(retryWasteOutcome).not.toHaveBeenCalled();
  });
});

describe('authority-stable review refresh', () => {
  type PageProps = ComponentProps<typeof WasteManagementRoutePage>;
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
      resolve = complete;
    });
    return { promise, resolve };
  }
  async function openEditableReview() {
    const page = renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await screen.findByRole('img', { name: 'Original submission evidence' });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeEnabled(),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Review feedback' }),
      'Held evidence',
    );
    return { page, user };
  }
  it('retains dirty feedback, property edits and evidence across equivalent bootstrap and row refreshes', async () => {
    vi.mocked(loadWasteReviewPage).mockImplementation(() =>
      Promise.resolve({
        contractVersion: 1,
        items: [{ ...structuredClone(submission), descriptor }],
        total: 1,
        page: 1,
        limit: 25,
        counts: { OPEN: 1 },
      }),
    );
    const page = renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await screen.findByRole('img', { name: 'Original submission evidence' });
    await user.type(
      screen.getByRole('textbox', { name: 'Final verified name' }),
      ' corrected',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Review feedback' }),
      'Illustrative evidence, not a verified physical item.',
    );
    // Thumbnail refreshes may reread evidence; the already authorized detail preview must stay visible.
    vi.mocked(loadWasteReviewPhoto).mockImplementation(() => new Promise(() => {}));
    page.refreshPage();
    await waitFor(() => expect(loadWasteReviewPage).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toHaveValue(
      'Customer tablet corrected',
    );
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toHaveValue(
      'Illustrative evidence, not a verified physical item.',
    );
    expect(
      screen.getByRole('button', { name: 'Discard unsaved changes' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Return to review queue' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('img', { name: 'Original submission evidence' }),
    ).toHaveAttribute('src', 'data:image/png;base64,test');
    expect(assignWasteReview).not.toHaveBeenCalled();
    expect(verifyWasteSubmission).not.toHaveBeenCalled();
    expect(decideWasteReview).not.toHaveBeenCalled();
  });

  const authorityChanges: [string, (props: PageProps) => Partial<PageProps>][] = [
    ['employee', () => ({ employeeId: 'another-operator' })],
    ['credential', () => ({ accessToken: 'new-token' })],
    ['same-token admission generation', () => ({ sessionGeneration: 2 })],
    [
      'tenant',
      (props) => ({ bootstrap: { ...props.bootstrap, tenantCode: 'another-tenant' } }),
    ],
    [
      'enterprise',
      (props) => ({
        runtime: { ...props.runtime, enterpriseCode: 'another-enterprise' },
      }),
    ],
    [
      'project',
      (props) => ({ runtime: { ...props.runtime, projectCode: 'another-project' } }),
    ],
    [
      'BackOffice authority',
      (props) => ({
        runtime: {
          ...props.runtime,
          backofficeBaseUrl: 'https://platform.example/other',
        },
      }),
    ],
    [
      'owner endpoint',
      (props) => ({
        bootstrap: {
          ...props.bootstrap,
          moduleConnections: {
            eWaste: [
              {
                ...props.bootstrap.moduleConnections.eWaste![0]!,
                endpoint: 'https://other.example/nodics/eWaste',
              },
            ],
          },
        },
      }),
    ],
    [
      'owner instance',
      (props) => ({
        bootstrap: {
          ...props.bootstrap,
          moduleConnections: {
            eWaste: [
              {
                ...props.bootstrap.moduleConnections.eWaste![0]!,
                instanceId: 'waste-two',
              },
            ],
          },
        },
      }),
    ],
    [
      'owner removal',
      (props) => ({ bootstrap: { ...props.bootstrap, moduleConnections: {} } }),
    ],
    [
      'workspace binding',
      (props) => ({
        navigation: { ...props.navigation, route: '/waste/another-view' },
      }),
    ],
    [
      'navigation denial',
      (props) => ({ navigation: { ...props.navigation, featureState: 'DISABLED' } }),
    ],
  ];
  it.each(authorityChanges)(
    'retires private drafts and evidence immediately on a real %s change',
    async (_name, change) => {
      const { page } = await openEditableReview();
      vi.mocked(loadWasteOperationsContext).mockImplementation(
        () => new Promise(() => {}),
      );
      page.refreshPage(change(page.pageProps));
      expect(
        screen.queryByRole('textbox', { name: 'Review feedback' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('img', { name: 'Original submission evidence' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Confirm decision' }),
      ).not.toBeInTheDocument();
      expect(assignWasteReview).not.toHaveBeenCalled();
      expect(verifyWasteSubmission).not.toHaveBeenCalled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it.each(['canApprove', 'canVerify', 'canReadEvidence'] as const)(
    'resets drafts and pending confirmation when fresh %s permission is lost',
    async (permission) => {
      const { page, user } = await openEditableReview();
      const context = await loadWasteOperationsContext({} as never);
      await user.click(screen.getByRole('button', { name: 'Review verification' }));
      expect(
        screen.getByRole('heading', { name: 'Confirm verified facts' }),
      ).toBeVisible();
      vi.mocked(loadWasteOperationsContext).mockResolvedValue({
        ...context,
        [permission]: false,
      });
      page.refreshPage();
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'Confirm verified facts' }),
        ).not.toBeInTheDocument(),
      );
      expect(
        await screen.findByRole('textbox', { name: 'Review feedback' }),
      ).toHaveValue('');
      if (permission === 'canReadEvidence')
        expect(
          screen.queryByRole('img', { name: 'Original submission evidence' }),
        ).not.toBeInTheDocument();
      if (permission === 'canApprove')
        expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeDisabled();
      expect(verifyWasteSubmission).not.toHaveBeenCalled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['revision', { ...submission, revision: 5 }],
    [
      'same-revision assignment',
      {
        ...submission,
        metadata: {
          ...submission.metadata,
          reviewAssignment: {
            type: 'EMPLOYEE' as const,
            principalCode: 'other-reviewer',
          },
        },
      },
    ],
    [
      'same-revision facts',
      {
        ...submission,
        submittedFacts: {
          ...submission.submittedFacts,
          name: 'Changed persisted tablet',
        },
      },
    ],
  ])(
    'resets drafts and pending confirmation on persisted %s drift',
    async (_name, record) => {
      const { page, user } = await openEditableReview();
      await user.click(screen.getByRole('button', { name: 'Review verification' }));
      vi.mocked(loadWasteReviewPage).mockResolvedValue({
        contractVersion: 1,
        items: [record],
        total: 1,
        page: 1,
        limit: 25,
        counts: { OPEN: 1 },
      });
      vi.mocked(loadWasteReviewDetail).mockResolvedValue(record);
      page.refreshPage();
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: 'Confirm verified facts' }),
        ).not.toBeInTheDocument(),
      );
      expect(
        await screen.findByRole('textbox', { name: 'Review feedback' }),
      ).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: 'Discard unsaved changes' }),
      ).not.toBeInTheDocument();
      expect(verifyWasteSubmission).not.toHaveBeenCalled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it('removes the private editor after failed refresh and recovers without resurrecting a draft', async () => {
    const { page, user } = await openEditableReview();
    vi.mocked(loadWasteReviewPage).mockRejectedValueOnce(
      new Error('Fresh scope denied'),
    );
    page.refreshPage();
    await screen.findByText('Fresh scope denied');
    expect(
      screen.queryByRole('textbox', { name: 'Review feedback' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Original submission evidence' }),
    ).not.toBeInTheDocument();
    page.refreshPage();
    await screen.findByRole('textbox', { name: 'Review feedback' });
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Review approval' }));
    expect(decideWasteReview).not.toHaveBeenCalled();
  });

  it('ignores late evidence from the retired authority', async () => {
    let complete!: (src: string) => void;
    vi.mocked(loadWasteReviewPhoto).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const page = renderPage();
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeEnabled(),
    );
    const completeRetired = complete;
    page.refreshPage({ accessToken: 'replacement-token' });
    await act(() => {
      completeRetired('data:image/png;base64,retired');
      return Promise.resolve();
    });
    expect(
      screen.queryByRole('img', { name: 'Original submission evidence' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Review feedback' }),
    ).not.toBeInTheDocument();
  });

  it('retires same-token readmission and reloads its context even when bootstrap identity is unchanged', async () => {
    const { page } = await openEditableReview();
    page.rerenderPage({ sessionGeneration: 2 });
    expect(
      screen.queryByRole('textbox', { name: 'Review feedback' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(loadWasteReviewPage).toHaveBeenCalledTimes(2));
    expect(loadWasteOperationsContext).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('img', { name: 'Original submission evidence' }),
    ).not.toBeInTheDocument();
    expect(verifyWasteSubmission).not.toHaveBeenCalled();
    expect(decideWasteReview).not.toHaveBeenCalled();
  });

  it.each(['replacement token', 'equivalent bootstrap'] as const)(
    'never admits an older manual refresh when cleanup overlaps a new %s read',
    async (change) => {
      const page = renderPage();
      const user = userEvent.setup();
      await screen.findByRole('button', { name: 'Open details: Customer tablet' });
      await user.click(screen.getByRole('button', { name: 'Refresh' }));
      await waitFor(() =>
        expect(vi.mocked(loadWasteReviewPage).mock.settledResults[1]?.type).toBe(
          'fulfilled',
        ),
      );
      const oldQueue = deferred<Awaited<ReturnType<typeof loadWasteReviewPage>>>();
      vi.mocked(loadWasteReviewPage).mockReturnValueOnce(oldQueue.promise);
      await user.click(screen.getByRole('button', { name: 'Refresh' }));
      expect(loadWasteReviewPage).toHaveBeenCalledTimes(3);
      const context = await loadWasteOperationsContext({} as never);
      const nextContext = deferred<typeof context>();
      vi.mocked(loadWasteOperationsContext).mockReturnValueOnce(nextContext.promise);
      page.refreshPage(
        change === 'replacement token' ? { accessToken: 'replacement-token' } : {},
      );
      const retired = {
        ...submission,
        code: 'WST_RETIRED',
        submittedFacts: {
          ...submission.submittedFacts,
          name: 'Retired private tablet',
        },
      };
      await act(() => {
        oldQueue.resolve({
          contractVersion: 1,
          items: [retired],
          total: 1,
          page: 1,
          limit: 25,
          counts: { OPEN: 1 },
        });
        return oldQueue.promise;
      });
      expect(
        screen.queryByRole('button', { name: 'Open details: Retired private tablet' }),
      ).not.toBeInTheDocument();
      expect(loadWasteReviewPhoto).not.toHaveBeenCalledWith(
        expect.anything(),
        'WST_RETIRED',
      );
      await act(() => {
        nextContext.resolve(context);
        return nextContext.promise;
      });
      await waitFor(() => expect(loadWasteReviewPage).toHaveBeenCalledTimes(4));
      expect(
        screen.queryByRole('button', { name: 'Open details: Retired private tablet' }),
      ).not.toBeInTheDocument();
      expect(loadWasteReviewPhoto).not.toHaveBeenCalledWith(
        expect.anything(),
        'WST_RETIRED',
      );
      expect(assignWasteReview).not.toHaveBeenCalled();
      expect(decideWasteReview).not.toHaveBeenCalled();
    },
  );

  it.each(['permission', 'record revision', 'session generation'] as const)(
    'ignores a pending decision response after a real %s change',
    async (change) => {
      const { page, user } = await openEditableReview();
      const pending = deferred<Awaited<ReturnType<typeof decideWasteReview>>>();
      vi.mocked(decideWasteReview).mockReturnValueOnce(pending.promise);
      await user.click(screen.getByRole('button', { name: 'Review approval' }));
      await user.click(screen.getByRole('button', { name: 'Confirm decision' }));
      expect(decideWasteReview).toHaveBeenCalledOnce();
      if (change === 'permission') {
        const context = await loadWasteOperationsContext({} as never);
        vi.mocked(loadWasteOperationsContext).mockResolvedValue({
          ...context,
          canApprove: false,
        });
      } else if (change === 'record revision') {
        const record = { ...submission, revision: 5 };
        vi.mocked(loadWasteReviewDetail).mockResolvedValue(record);
        vi.mocked(loadWasteReviewPage).mockResolvedValue({
          contractVersion: 1,
          items: [record],
          total: 1,
          page: 1,
          limit: 25,
          counts: { OPEN: 1 },
        });
      }
      page.refreshPage(change === 'session generation' ? { sessionGeneration: 2 } : {});
      await waitFor(() =>
        expect(vi.mocked(loadWasteReviewPage).mock.settledResults[1]?.type).toBe(
          'fulfilled',
        ),
      );
      await act(() => {
        pending.resolve({ settlementStatus: 'COMPLETED' });
        return pending.promise;
      });
      expect(screen.queryByText('Review decision saved.')).not.toBeInTheDocument();
      expect(loadWasteReviewPage).toHaveBeenCalledTimes(2);
      expect(decideWasteReview).toHaveBeenCalledOnce();
    },
  );

  it('keeps a pending explicit decision live across an equivalent refresh without replaying it', async () => {
    const { page, user } = await openEditableReview();
    const pending = deferred<Awaited<ReturnType<typeof decideWasteReview>>>();
    vi.mocked(decideWasteReview).mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole('button', { name: 'Review approval' }));
    await user.click(screen.getByRole('button', { name: 'Confirm decision' }));
    page.refreshPage();
    await waitFor(() =>
      expect(vi.mocked(loadWasteReviewPage).mock.settledResults[1]?.type).toBe(
        'fulfilled',
      ),
    );
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await act(() => {
      pending.resolve({ settlementStatus: 'COMPLETED' });
      return pending.promise;
    });
    expect(await screen.findByText('Review decision saved.')).toBeVisible();
    expect(decideWasteReview).toHaveBeenCalledOnce();
    expect(decideWasteReview).toHaveBeenCalledWith(
      expect.anything(),
      submission,
      'APPROVED',
      'Held evidence',
      { name: 'Customer tablet' },
      false,
    );
  });

  it('ignores a late assignment response after the persisted record revision changes', async () => {
    const page = renderPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Return to review queue' }),
      ).toBeEnabled(),
    );
    const pending = deferred<Awaited<ReturnType<typeof assignWasteReview>>>();
    vi.mocked(assignWasteReview).mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole('button', { name: 'Return to review queue' }));
    const record = { ...submission, revision: 6 };
    vi.mocked(loadWasteReviewDetail).mockResolvedValue(record);
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      items: [record],
      total: 1,
      page: 1,
      limit: 25,
      counts: { OPEN: 1 },
    });
    page.refreshPage();
    await waitFor(() =>
      expect(vi.mocked(loadWasteReviewPage).mock.settledResults[1]?.type).toBe(
        'fulfilled',
      ),
    );
    await act(() => {
      pending.resolve({
        ...submission,
        revision: 5,
        metadata: {
          ...submission.metadata,
          reviewAssignment: { type: 'QUEUE', queueCode: 'REVIEW' },
        },
      });
      return pending.promise;
    });
    expect(await screen.findByText('Assigned to you')).toBeVisible();
    expect(screen.queryByText(assignmentLabels.releaseSaved)).not.toBeInTheDocument();
    expect(assignWasteReview).toHaveBeenCalledOnce();
  });
});

describe('WasteManagementRoutePage', () => {
  it('loads original evidence and requires explicit approval confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Customer tablet' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('img', { name: 'Original submission evidence' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Review approval' }));
    expect(decideWasteReview).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirm decision',
      }),
    );
    await waitFor(() =>
      expect(decideWasteReview).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'token' }),
        submission,
        'APPROVED',
        '',
        { name: 'Customer tablet' },
        false,
      ),
    );
    expect(await screen.findByText('Review decision saved.')).toBeVisible();
  });
  it('labels sample imagery and still resolves it through the protected endpoint', async () => {
    vi.mocked(loadWasteReviewPage).mockResolvedValue({
      contractVersion: 1,
      total: 1,
      page: 1,
      limit: 25,
      counts: { OPEN: 1 },
      items: [
        {
          ...submission,
          metadata: {
            sample: true,
            photo: { url: 'https://images.example/queue-preview.jpg' },
          },
        },
      ],
    });
    vi.mocked(loadWasteReviewDetail).mockResolvedValue({
      ...submission,
      metadata: {
        sample: true,
        photo: { url: 'https://images.example/queue-preview.jpg' },
      },
    });
    vi.mocked(loadWasteReviewPhoto).mockResolvedValue(
      'https://images.example/governed-preview.jpg',
    );
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    const image = await screen.findByRole('img', { name: 'Reference image' });
    expect(image).toHaveAttribute('src', 'https://images.example/governed-preview.jpg');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(loadWasteReviewPhoto).toHaveBeenCalledWith(expect.anything(), 'WST_TEST');
  });
  it('requires customer-visible feedback before rejection', async () => {
    const user = userEvent.setup();
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    await screen.findByRole('heading', { name: 'Customer tablet' });
    expect(screen.getByRole('button', { name: 'Review rejection' })).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'Review feedback' }),
      'The label is not readable.',
    );
    await user.click(screen.getByRole('button', { name: 'Review rejection' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirm decision',
      }),
    );
    await waitFor(() =>
      expect(decideWasteReview).toHaveBeenCalledWith(
        expect.anything(),
        submission,
        'REJECTED',
        'The label is not readable.',
        { name: 'Customer tablet' },
        false,
      ),
    );
  });
  it('preserves a failed decision for retry without displaying success', async () => {
    vi.mocked(decideWasteReview).mockRejectedValueOnce(
      new Error('Review service unavailable'),
    );
    const user = userEvent.setup();
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    await screen.findByRole('heading', { name: 'Customer tablet' });
    await user.click(screen.getByRole('button', { name: 'Review approval' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirm decision',
      }),
    );
    expect(await screen.findByText('Review service unavailable')).toBeVisible();
    expect(screen.queryByText('Review decision saved.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});

describe('explicit review assignment', () => {
  function queuedReview(principalCode?: string) {
    let record = {
      ...submission,
      metadata: {
        ...submission.metadata,
        reviewAssignment: principalCode
          ? { type: 'EMPLOYEE' as const, principalCode }
          : { type: 'QUEUE' as const, queueCode: 'REVIEW' },
      },
    };
    vi.mocked(loadWasteReviewDetail).mockImplementation(() => Promise.resolve(record));
    vi.mocked(loadWasteReviewPage).mockImplementation(() =>
      Promise.resolve({
        contractVersion: 1,
        items: [record],
        total: 1,
        page: 1,
        limit: 25,
        counts: { OPEN: 1 },
      }),
    );
    vi.mocked(assignWasteReview).mockImplementation((_, current, action) => {
      record = {
        ...record,
        revision: current.revision + 1,
        submissionStatus: 'UNDER_REVIEW',
        metadata: {
          ...record.metadata,
          reviewAssignment:
            action === 'CLAIM'
              ? { type: 'EMPLOYEE', principalCode: 'operator' }
              : { type: 'QUEUE', queueCode: 'REVIEW' },
        },
      };
      return Promise.resolve(record);
    });
    return record;
  }
  async function openReview() {
    renderPage();
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
    await screen.findByRole('heading', { name: 'Customer tablet' });
    await waitFor(() => expect(loadWasteReviewDetail).toHaveBeenCalled());
  }

  it('opens read-only, confirms assignment before enabling fields, and locks again on release', async () => {
    queuedReview();
    await openReview();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Read-only preview')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review verification' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
    expect(assignWasteReview).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Assign to me' }));
    expect(await within(dialog).findByText('Assigned to you')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Final verified name' }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Review verification' })).toBeEnabled();
    expect(assignWasteReview).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ revision: 4 }),
      'CLAIM',
    );
    expect(screen.getByRole('dialog')).toBe(dialog);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Return to review queue' }));
    expect(await within(dialog).findByText('Read-only preview')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeDisabled();
    expect(assignWasteReview).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ revision: 5 }),
      'RELEASE',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(loadWasteReviewPage).toHaveBeenCalledTimes(2));
  });

  it('keeps fields locked during a pending claim and shows failures inside the detail dialog', async () => {
    queuedReview();
    let fail!: (error: Error) => void;
    vi.mocked(assignWasteReview).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    await openReview();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Assign to me' }));
    expect(screen.getByRole('button', { name: 'Assigning…' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
    fail(new Error('This review changed. Reopen it and try again.'));
    expect(
      await within(screen.getByRole('dialog')).findByText(
        'This review changed. Reopen it and try again.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeEnabled();
  });

  it('shows the other reviewer and never offers their assignment or edit controls', async () => {
    queuedReview('other-reviewer');
    await openReview();
    expect(screen.getByText('Assigned reviewer: other-reviewer')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Assign to me' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Return to review queue' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review verification' })).toBeDisabled();
  });

  it('retains unsaved edits until they are discarded before release', async () => {
    queuedReview('operator');
    await openReview();
    const user = userEvent.setup();
    await user.type(
      screen.getByRole('textbox', { name: 'Final verified name' }),
      ' corrected',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Review feedback' }),
      'Unsaved feedback',
    );
    expect(
      screen.getByRole('button', { name: 'Return to review queue' }),
    ).toBeDisabled();
    expect(screen.getByText(assignmentLabels.releaseDirty)).toBeVisible();
    expect(assignWasteReview).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard unsaved changes' }));
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toHaveValue(
      'Customer tablet',
    );
    expect(screen.getByRole('textbox', { name: 'Review feedback' })).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Return to review queue' }),
    ).toBeEnabled();
  });

  it('uses owner-provided assignment labels and rejects an unconfirmed assignment response', async () => {
    const queued = queuedReview();
    const context = await loadWasteOperationsContext({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...context,
      reviewWorkspace: {
        ...context.reviewWorkspace!,
        labels: { ...assignmentLabels, assign: 'Take responsibility' },
      },
    });
    vi.mocked(assignWasteReview).mockResolvedValueOnce(queued);
    await openReview();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Take responsibility' }));
    expect(
      await within(screen.getByRole('dialog')).findByText(
        'The review service did not confirm the assignment. Reopen the details and try again.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
  });
});

describe('scoped Waste role controls', () => {
  it('resumes original recorded verification without editable facts, reassignment or approval', async () => {
    const context = await loadWasteOperationsContext({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...context,
      canVerify: true,
      canApprove: true,
      presentation: {
        ...context.presentation,
        resumeVerificationAction: 'Resume recorded verification',
      },
    });
    vi.mocked(loadWasteReviewDetail).mockResolvedValue({
      ...submission,
      verificationPending: {
        principalCode: context.principalCode,
        facts: { name: 'Frozen inspected item' },
      },
    });
    renderPage();
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
      );
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Final verified name' })).toHaveValue(
        'Frozen inspected item',
      ),
    );
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: assignmentLabels.release }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Resume recorded verification' }));
    await userEvent.setup().click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirm decision',
      }),
    );
    await waitFor(() => expect(verifyWasteSubmission).toHaveBeenCalledOnce());
    expect(decideWasteReview).not.toHaveBeenCalled();
  });
  it('lets a verifier confirm facts but exposes no approval action', async () => {
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      principalCode: 'verifier',
      canVerify: true,
      canApprove: false,
      canReadEvidence: true,
      canAudit: false,
      requireVerification: true,
      requireDifferentApprover: true,
      presentation: {
        title: 'Waste verification and approval',
        verifyAction: 'Review verification',
        verifyTitle: 'Confirm verified facts',
        verifySaved: 'Verification saved.',
      },
    });
    vi.mocked(loadWasteReviewDetail).mockResolvedValue({
      ...submission,
      metadata: {
        ...submission.metadata,
        reviewAssignment: { type: 'EMPLOYEE', principalCode: 'verifier' },
      },
    });
    const user = userEvent.setup();
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    await screen.findByRole('heading', { name: 'Customer tablet' });
    expect(
      screen.queryByRole('button', { name: 'Review approval' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review verification' }));
    expect(verifyWasteSubmission).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Confirm decision',
      }),
    );
    await waitFor(() => expect(verifyWasteSubmission).toHaveBeenCalledOnce());
    expect(decideWasteReview).not.toHaveBeenCalled();
  });
  it('keeps an auditor read-only and avoids requesting private evidence', async () => {
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      principalCode: 'auditor',
      canVerify: false,
      canApprove: false,
      canReadEvidence: false,
      canAudit: true,
      requireVerification: true,
      requireDifferentApprover: true,
      presentation: {
        title: 'Waste audit',
        auditAction: 'View review audit',
        auditTitle: 'Review evidence',
        readOnly: 'Read-only access',
      },
    });
    const user = userEvent.setup();
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    await screen.findByRole('heading', { name: 'Customer tablet' });
    expect(loadWasteReviewPhoto).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Review approval' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review verification' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    await user.click(await screen.findByRole('button', { name: 'View review audit' }));
    await waitFor(() => expect(loadWasteAudit).toHaveBeenCalledOnce());
  });
  it('blocks an approver until independent verification exists', async () => {
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      principalCode: 'approver',
      canVerify: false,
      canApprove: true,
      canReadEvidence: true,
      canAudit: false,
      requireVerification: true,
      requireDifferentApprover: true,
      presentation: {
        title: 'Waste approval',
        verificationRequired: 'Independent verification required',
      },
    });
    renderPage();
    await userEvent.setup().click(
      await screen.findByRole('button', {
        name: 'Open details: Customer tablet',
      }),
    );
    await screen.findByRole('heading', { name: 'Customer tablet' });
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Final verified name' })).toBeDisabled();
  });
});

it('shows final reviewed facts without asking the original verifier for another decision', async () => {
  const reviewed = {
    ...submission,
    submissionStatus: 'APPROVED',
    metadata: {
      ...submission.metadata,
      verifiedBy: { code: 'operator' },
      verifiedFacts: { name: 'Reviewed tablet' },
      preApprovalVerificationRef: { code: 'V' },
    },
  };
  vi.mocked(loadWasteReviewDetail).mockResolvedValue(reviewed);
  vi.mocked(loadWasteReviewPage).mockResolvedValue({
    contractVersion: 1,
    items: [reviewed],
    total: 1,
    page: 1,
    limit: 25,
    counts: { ALL: 1, APPROVED: 1 },
  });
  vi.mocked(loadWasteOperationsContext).mockResolvedValue({
    principalCode: 'operator',
    canVerify: true,
    canApprove: false,
    canReadEvidence: true,
    canAudit: false,
    requireVerification: true,
    requireDifferentApprover: true,
    presentation: {
      title: 'Waste',
      verifyAction: 'Review verification',
      differentApproverRequired: 'Another employee must approve',
    },
  });
  renderPage();
  await userEvent.setup().click(
    await screen.findByRole('button', {
      name: 'Open details: Reviewed tablet',
    }),
  );
  await screen.findByRole('heading', { name: 'Reviewed tablet' });
  expect(screen.queryByText('Another employee must approve')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Review verification' }),
  ).not.toBeInTheDocument();
});

describe('module-owned view behavior', () => {
  async function configureView(
    mode: 'OVERVIEW' | 'SUBMISSIONS' | 'REVIEW_QUEUE',
    ownerModule = 'eWaste',
  ) {
    const base = await loadWasteOperationsContext({} as never);
    vi.mocked(loadWasteOperationsContext).mockResolvedValue({
      ...base,
      reviewWorkspace: {
        views: {
          'partner.view': {
            ownerModule,
            label: 'Partner waste view',
            mode,
            familyCode: 'PARTNER',
          },
        },
        defaultPageSize: 25,
        labels: { status: 'Submission status' },
        statuses: [
          { code: 'ALL', label: 'All submissions' },
          { code: 'OPEN', label: 'Pending and under review' },
          { code: 'APPROVED', label: 'Approved' },
        ],
      },
    });
  }
  it('overview does not expose a review editor and sends its explicit view key', async () => {
    await configureView('OVERVIEW');
    renderPage('partner.view');
    await screen.findByRole('heading', { name: 'Partner waste view', level: 4 });
    expect(
      screen.queryByRole('button', { name: 'Review approval' }),
    ).not.toBeInTheDocument();
    expect(loadWasteReviewPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        viewCode: 'partner.view',
        familyCode: 'PARTNER',
        status: 'ALL',
      }),
    );
  });
  it('review queue starts with pending work and excludes approved status', async () => {
    await configureView('REVIEW_QUEUE');
    renderPage('partner.view');
    await screen.findByRole('heading', { name: 'Partner waste view', level: 4 });
    expect(loadWasteReviewPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ viewCode: 'partner.view', status: 'OPEN' }),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('combobox', { name: 'Submission status' }));
    expect(screen.queryByRole('option', { name: /Approved/ })).not.toBeInTheDocument();
  });
  it('a view cannot be borrowed from a different contributor or unknown key', async () => {
    await configureView('SUBMISSIONS', 'otherWaste');
    renderPage('partner.view');
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(loadWasteReviewPage).not.toHaveBeenCalled();
  });
});

it('allows a user with both permissions to approve their own verified submission', async () => {
  const verified = {
    ...submission,
    submissionStatus: 'UNDER_REVIEW',
    metadata: {
      ...submission.metadata,
      verifiedBy: { code: 'operator' },
      verifiedFacts: { name: 'Customer tablet' },
      preApprovalVerificationRef: { code: 'VERIFIED_TEST' },
    },
  };
  vi.mocked(loadWasteReviewDetail).mockResolvedValue(verified);
  vi.mocked(loadWasteReviewPage).mockResolvedValue({
    contractVersion: 1,
    items: [verified],
    total: 1,
    page: 1,
    limit: 25,
    counts: { OPEN: 1 },
  });
  vi.mocked(loadWasteOperationsContext).mockResolvedValue({
    principalCode: 'operator',
    canVerify: true,
    canApprove: true,
    canReadEvidence: true,
    canAudit: false,
    requireVerification: true,
    requireDifferentApprover: false,
    presentation: {},
  });
  const user = userEvent.setup();
  renderPage();
  await userEvent.setup().click(
    await screen.findByRole('button', {
      name: 'Open details: Customer tablet',
    }),
  );
  await screen.findByRole('heading', { name: 'Customer tablet' });
  expect(screen.getByRole('button', { name: 'Review approval' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Review approval' }));
  expect(decideWasteReview).not.toHaveBeenCalled();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Confirm decision',
    }),
  );
  await waitFor(() =>
    expect(decideWasteReview).toHaveBeenCalledWith(
      expect.anything(),
      verified,
      'APPROVED',
      '',
      {},
      false,
    ),
  );
});

it('highlights flagged image evidence and requires fresh acknowledgement before human approval', async () => {
  const evidenceReview = {
    assessed: true,
    sourceType: 'PROMOTIONAL_GRAPHIC',
    sourceLabel: 'Promotional graphic',
    manualApprovalRequired: true,
    acknowledgementRequired: true,
    manualApprovalRecorded: false,
    label: 'Manual approval required',
    message: 'Inspect the physical item. Automatic approval is prohibited.',
    reason: 'Advertising composition',
    reasonCodes: ['PROMOTIONAL_GRAPHIC'],
    acknowledgementLabel: 'I inspected the evidence and verified the physical item.',
  };
  const flagged = { ...submission, evidenceReview };
  vi.mocked(loadWasteReviewDetail).mockResolvedValue(flagged);
  vi.mocked(loadWasteReviewPage).mockResolvedValue({
    contractVersion: 1,
    items: [flagged],
    total: 1,
    page: 1,
    limit: 25,
    counts: { OPEN: 1 },
  });
  const user = userEvent.setup();
  renderPage();
  await userEvent.setup().click(
    await screen.findByRole('button', {
      name: 'Open details: Customer tablet',
    }),
  );
  await screen.findByText('Advertising composition');
  expect(screen.getAllByText('Manual approval required').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Review approval' }));
  let dialog = screen.getByRole('dialog');
  expect(
    within(dialog).getByRole('button', { name: 'Confirm decision' }),
  ).toBeDisabled();
  expect(decideWasteReview).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('checkbox'));
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await screen.findByRole('dialog', { name: 'Submission details' });
  await user.click(screen.getByRole('button', { name: 'Review approval' }));
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('checkbox')).not.toBeChecked();
  await user.click(within(dialog).getByRole('checkbox'));
  await user.click(within(dialog).getByRole('button', { name: 'Confirm decision' }));
  await waitFor(() =>
    expect(decideWasteReview).toHaveBeenCalledWith(
      expect.anything(),
      flagged,
      'APPROVED',
      '',
      { name: 'Customer tablet' },
      true,
    ),
  );
});

it('keeps the list visible until requested, expands a summary, and guards dirty dialog closure', async () => {
  const user = userEvent.setup();
  renderPage();
  const row = await screen.findByRole('button', {
    name: 'Open details: Customer tablet',
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(loadWasteReviewDetail).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole('button', { name: 'Expand summary: Customer tablet' }),
  );
  expect(
    await screen.findByRole('region', { name: 'Summary: Customer tablet' }),
  ).toHaveTextContent('Quantity: 1');
  expect(loadWasteReviewDetail).not.toHaveBeenCalled();
  await user.click(row);
  await screen.findByRole('dialog', { name: 'Submission details' });
  await user.type(
    screen.getByRole('textbox', { name: 'Review feedback' }),
    'Unsaved feedback',
  );
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  expect(
    await screen.findByRole('dialog', { name: 'Discard unsaved changes?' }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(await screen.findByRole('textbox', { name: 'Review feedback' })).toHaveValue(
    'Unsaved feedback',
  );
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(
    screen.getByRole('region', { name: 'Summary: Customer tablet' }),
  ).toBeVisible();
  await user.click(row);
  expect(await screen.findByRole('textbox', { name: 'Review feedback' })).toHaveValue(
    '',
  );
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('uses a contributed clothing view in the same listing without assuming electronics', async () => {
  const context = await loadWasteOperationsContext({} as never);
  vi.mocked(loadWasteOperationsContext).mockResolvedValue({
    ...context,
    reviewWorkspace: {
      defaultPageSize: 25,
      labels: { openDetails: 'Inspect item' },
      statuses: [{ code: 'ALL', label: 'All submissions' }],
      views: {
        'clothing.submissions': {
          ownerModule: 'eWaste',
          label: 'Clothing submissions',
          mode: 'SUBMISSIONS',
          familyCode: 'CLOTHING',
        },
      },
    },
  });
  const clothing = {
    ...submission,
    code: 'SHIRT_1',
    submittedFacts: { name: 'Cotton shirt', itemTypeCode: 'SHIRT', quantity: 2 },
    metadata: {},
  };
  vi.mocked(loadWasteReviewPage).mockResolvedValue({
    contractVersion: 1,
    items: [clothing],
    total: 1,
    page: 1,
    limit: 25,
    counts: { ALL: 1 },
  });
  renderPage('clothing.submissions');
  expect(
    await screen.findByRole('button', { name: 'Inspect item: Cotton shirt' }),
  ).toBeVisible();
  expect(loadWasteReviewPage).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      viewCode: 'clothing.submissions',
      familyCode: 'CLOTHING',
    }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('blocks decisions after a failed detail read and recovers when the dialog is reopened', async () => {
  vi.mocked(loadWasteReviewDetail)
    .mockRejectedValueOnce(new Error('Detail service unavailable'))
    .mockResolvedValue(submission);
  const user = userEvent.setup();
  renderPage();
  await user.click(
    await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
  );
  expect(await screen.findByText('Detail service unavailable')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Review verification' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Review approval' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Close details' }));
  await user.click(
    await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeEnabled(),
  );
  expect(decideWasteReview).not.toHaveBeenCalled();
  expect(screen.queryByText('Detail service unavailable')).not.toBeInTheDocument();
});

it('debounces simple search into the owner query and Clear all restores the unfiltered query', async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole('button', { name: 'Open details: Customer tablet' });
  expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
  await user.type(
    screen.getByRole('textbox', { name: 'Search submissions' }),
    'tablet',
  );
  await waitFor(() =>
    expect(loadWasteReviewPage).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ q: 'tablet', page: 1 }),
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Clear all' }));
  await waitFor(() =>
    expect(loadWasteReviewPage).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ q: '', page: 1, status: 'ALL' }),
    ),
  );
});

it('keeps an authorized contributed search usable after query failure and recovers through Clear all', async () => {
  const context = await loadWasteOperationsContext({} as never);
  vi.mocked(loadWasteOperationsContext).mockResolvedValue({
    ...context,
    reviewWorkspace: {
      defaultPageSize: 25,
      labels: {},
      statuses: [{ code: 'ALL', label: 'All submissions' }],
      views: {
        'test.submissions': {
          ownerModule: 'eWaste',
          label: 'Submissions',
          mode: 'SUBMISSIONS',
        },
      },
    },
  });
  const user = userEvent.setup();
  renderPage('test.submissions');
  await screen.findByRole('button', { name: 'Open details: Customer tablet' });
  vi.mocked(loadWasteReviewPage).mockRejectedValueOnce(
    new Error('Invalid search criteria'),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Search submissions' }),
    'invalid',
  );
  expect(await screen.findByText('Invalid search criteria')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Search submissions' })).toBeEnabled();
  expect(
    screen.queryByText('No submissions match these filters.'),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(
    await screen.findByRole('button', { name: 'Open details: Customer tablet' }),
  ).toBeVisible();
});
