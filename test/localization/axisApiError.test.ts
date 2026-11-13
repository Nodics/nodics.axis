import { describe, it, expect } from 'vitest';
import { parseAxisApiError } from '../../src/localization/axisApiError';
describe('owner error localization', () => {
  it('preserves conflict identity while replacing unclassified owner text with a bounded localized fallback', async () => {
    const error = await parseAxisApiError(
      new Response(
        JSON.stringify({
          code: 'ERR_CMS_CONFLICT',
          message: 'private backend diagnostic',
        }),
        { status: 409 },
      ),
      'Inspect the current state',
    );
    expect(error).toMatchObject({
      code: 'ERR_CMS_CONFLICT',
      messageKey: 'common.http.409',
      messageExposure: 'PUBLIC',
      message: 'Inspect the current state',
    });
  });
  it('preserves an explicitly exposed owner key and only scalar message parameters', async () => {
    const error = await parseAxisApiError(
      new Response(
        JSON.stringify({
          message: 'Scoped denial',
          messageKey: 'cms.denied',
          messageExposure: 'AUTHENTICATED',
          messageParameters: { scope: 'site', secret: { value: 'hidden' } },
        }),
        { status: 403 },
      ),
      'Denied',
    );
    expect(error).toMatchObject({
      messageKey: 'cms.denied',
      messageParameters: { scope: 'site' },
      messageExposure: 'AUTHENTICATED',
    });
  });
  it('localizes a non-JSON outage without disclosing its response', async () => {
    const error = await parseAxisApiError(
      new Response('<private error>', { status: 503 }),
      'Unavailable',
    );
    expect(error).toMatchObject({
      message: 'Unavailable',
      messageKey: 'common.http.503',
      messageExposure: 'PUBLIC',
    });
  });
});
