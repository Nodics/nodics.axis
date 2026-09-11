import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportWasteSubmissions } from '../../src/operations/wasteManagement/wasteSubmissionExport';
import { loadWasteReviewPage } from '../../src/operations/wasteManagement/api/wasteReviewClient';
vi.mock('../../src/operations/wasteManagement/api/wasteReviewClient', () => ({
  loadWasteReviewPage: vi.fn(),
}));
const record = (code: string) => ({
  code,
  revision: 1,
  submissionStatus: 'SUBMITTED',
  submitterRef: { code: 'customer' },
  submittedFacts: { name: '=DANGEROUS(),"text"', quantity: 1 },
  metadata: {},
});
const response = (page: number, total = 2) => ({
  contractVersion: 1 as const,
  page,
  total,
  limit: 1,
  counts: { ALL: total },
  items: [record('ITEM_' + page)],
});
let emitted: Blob | undefined;
const downloadClick = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  emitted = undefined;
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob: Blob) {
        emitted = blob;
        return 'blob:test';
      }
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(downloadClick);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('Waste submission export', () => {
  it('exports all matching pages with the same owner filters and neutralizes spreadsheet formulas', async () => {
    vi.mocked(loadWasteReviewPage)
      .mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce(response(2));
    await exportWasteSubmissions(
      {} as never,
      {
        viewCode: 'clothing.submissions',
        familyCode: 'CLOTHING',
        status: 'SUBMITTED',
        q: 'shirt',
        channel: 'WEB',
      },
      {},
    );
    expect(loadWasteReviewPage).toHaveBeenNthCalledWith(
      2,
      {},
      expect.objectContaining({
        page: 2,
        familyCode: 'CLOTHING',
        viewCode: 'clothing.submissions',
        status: 'SUBMITTED',
        q: 'shirt',
        channel: 'WEB',
        dashboard: false,
      }),
    );
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.readAsText(emitted!);
    });
    expect(text).toContain('ITEM_1');
    expect(text).toContain('ITEM_2');
    expect(text).toContain('"\'=DANGEROUS(),""text"""');
    expect(downloadClick).toHaveBeenCalledOnce();
  });
  it('does not download a partial export if a subsequent page fails', async () => {
    vi.mocked(loadWasteReviewPage)
      .mockResolvedValueOnce(response(1))
      .mockRejectedValueOnce(new Error('Access revoked'));
    await expect(exportWasteSubmissions({} as never, {}, {})).rejects.toThrow(
      'Access revoked',
    );
    expect(downloadClick).not.toHaveBeenCalled();
  });
  it('detects changed totals and repeated pages rather than silently dropping records', async () => {
    vi.mocked(loadWasteReviewPage)
      .mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce(response(2, 3));
    await expect(exportWasteSubmissions({} as never, {}, {})).rejects.toThrow(
      'changed',
    );
    vi.mocked(loadWasteReviewPage)
      .mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce({ ...response(2), items: [record('ITEM_1')] });
    await expect(exportWasteSubmissions({} as never, {}, {})).rejects.toThrow(
      'changed',
    );
    expect(downloadClick).not.toHaveBeenCalled();
  });
});
