import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadWasteReviewPhoto,
  rejectWasteEvidence,
  verifyWasteSubmission,
  type WasteReviewSubmission,
} from '../../src/operations/wasteManagement/api/wasteReviewClient';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: () => ({ endpoint: 'https://waste.example/nodics/eWaste' }),
}));
const configuration = {
  accessToken: 'employee-test-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
  bootstrap: {} as never,
};
afterEach(() => vi.unstubAllGlobals());
it('resumes a recorded verification with only current revision and confirmation, never replacement facts', async () => {
  const fetch = respond({});
  await verifyWasteSubmission(
    configuration,
    {
      code: 'submission',
      revision: 4,
      verificationPending: {
        principalCode: 'verifier',
        facts: { name: 'Original recorded facts' },
      },
    } as WasteReviewSubmission,
    { name: 'Must not replace recorded facts' },
  );
  const init = fetch.mock.calls[0]?.[1] as RequestInit;
  expect(JSON.parse(init.body as string)).toEqual({
    resumeVerification: true,
    expectedRevision: 4,
    confirmed: true,
    idempotencyKey: 'submission:verify:4',
  });
});
/** Provide a bounded response from the authenticated owning endpoint. */
function respond(photo: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: photo }), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
describe('Waste evidence preview contract', () => {
  it('renders an original inline image after an authenticated owner request', async () => {
    const fetch = respond({ mimeType: 'image/png', contentBase64: 'aW1hZ2U=' });
    expect(await loadWasteReviewPhoto(configuration, 'submission')).toBe(
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer employee-test-token',
          'Content-Type': 'application/json',
          'x-enterprise-code': 'default',
        },
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      }),
    );
  });
  it('allows SVG only when the owning endpoint marks it as public media', async () => {
    respond({
      mimeType: 'image/svg+xml',
      contentBase64: 'PHN2Zy8+',
      previewType: 'PUBLIC_MEDIA',
    });
    expect(await loadWasteReviewPhoto(configuration, 'sample')).toBe(
      'data:image/svg+xml;base64,PHN2Zy8+',
    );
    respond({
      mimeType: 'image/svg+xml',
      contentBase64: 'PHN2Zy8+',
      previewType: 'CUSTOMER_ORIGINAL',
    });
    await expect(loadWasteReviewPhoto(configuration, 'original')).rejects.toThrow(
      'response is invalid',
    );
  });
  it('uses a governed sample URL without sending credentials to its image host', async () => {
    const fetch = respond({ url: 'https://images.example/sample.jpg' });
    expect(await loadWasteReviewPhoto(configuration, 'sample')).toBe(
      'https://images.example/sample.jpg',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'https://waste.example/nodics/eWaste/v0/reviews/sample/photo',
    );
  });
  it.each([
    'javascript:alert(1)',
    'file:///tmp/photo.png',
    'data:image/svg+xml,<svg/>',
    'https://user:password@images.example/sample.jpg',
    '/untrusted-relative.png',
  ])('rejects unsafe URL %s', async (url) => {
    respond({ url });
    await expect(loadWasteReviewPhoto(configuration, 'sample')).rejects.toThrow(
      'preview URL is invalid',
    );
  });
  it('keeps authorization failures as failures instead of using the queue photo URL', async () => {
    respond({ message: 'Denied' }, 403);
    await expect(loadWasteReviewPhoto(configuration, 'sample')).rejects.toThrow();
  });
  it('rejects empty and non-image original evidence', async () => {
    respond({ mimeType: 'text/html', contentBase64: 'aW1hZ2U=' });
    await expect(loadWasteReviewPhoto(configuration, 'sample')).rejects.toThrow(
      'response is invalid',
    );
  });
});

describe('evidence-only rejection transport', () => {
  const record: WasteReviewSubmission = {
    code: 'SUB_ARTWORK',
    revision: 3,
    submissionStatus: 'UNDER_REVIEW',
    submitterRef: { code: 'customer' },
    submittedFacts: {},
    metadata: {},
  };
  it('sends one dedicated exact-revision command with no verification or approval fields', async () => {
    const fetch = respond({
      decisionBasis: 'EVIDENCE_ONLY',
      submission: { ...record, revision: 5, submissionStatus: 'REJECTED' },
    });
    await rejectWasteEvidence(configuration, record, 'Unusable photo');
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'https://waste.example/nodics/eWaste/v0/review-workspace/SUB_ARTWORK/evidence-rejection',
    );
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      reason: 'Unusable photo',
      expectedRevision: 3,
      confirmed: true,
      idempotencyKey: 'SUB_ARTWORK:evidence-rejection:3',
    });
  });
  it.each([
    {},
    { decisionBasis: 'EVIDENCE_ONLY' },
    {
      decisionBasis: 'EVIDENCE_ONLY',
      submission: { ...record, revision: 5, submissionStatus: 'APPROVED' },
    },
    {
      decisionBasis: 'EVIDENCE_ONLY',
      submission: {
        ...record,
        revision: 5,
        code: 'OTHER',
        submissionStatus: 'REJECTED',
      },
    },
    {
      decisionBasis: 'EVIDENCE_ONLY',
      submission: { ...record, submissionStatus: 'REJECTED' },
    },
  ])(
    'does not treat an invalid or conflicting acknowledgement as saved: %j',
    async (response) => {
      const fetch = respond(response);
      await expect(
        rejectWasteEvidence(configuration, record, 'Unusable photo'),
      ).rejects.toThrow('Inspect the saved review');
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
});
