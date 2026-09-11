import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWasteReviewPhoto } from '../../src/operations/wasteManagement/api/wasteReviewClient';

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
