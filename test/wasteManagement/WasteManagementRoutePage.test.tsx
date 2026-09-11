import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteManagementRoutePage } from '../../src/operations/wasteManagement/WasteManagementRoutePage';
import {
  decideWasteReview,
  loadWasteOperationsContext,
  verifyWasteSubmission,
  loadWasteAudit,
  loadWasteReviewPage,
  loadWasteReviewDetail,
  loadWasteReviewPhoto,
  assignWasteReview,
} from '../../src/operations/wasteManagement/api/wasteReviewClient';
vi.mock('../../src/operations/wasteManagement/api/wasteReviewClient', () => ({
  decideWasteReview: vi.fn(),
  loadWasteOperationsContext: vi.fn(),
  verifyWasteSubmission: vi.fn(),
  loadWasteAudit: vi.fn(),
  loadWasteReviewPage: vi.fn(),
  loadWasteReviewDetail: vi.fn(),
  assignWasteReview: vi.fn(),
  recoverWasteReview: vi.fn(),
  loadWasteReviewPhoto: vi.fn(),
}));
const assignmentLabels = {
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

  return render(
    <WasteManagementRoutePage
      accessToken="token"
      bootstrap={{ navigation: [navigation], moduleConnections: {} } as never}
      employeeId="operator"
      navigation={navigation}
      runtime={{ enterpriseCode: 'default', requestTimeoutMs: 1000 } as never}
    />,
  );
}

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
