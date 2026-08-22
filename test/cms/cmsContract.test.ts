import { describe, expect, it } from 'vitest';

import { parseCmsResolvedPage } from '../../src/cms/cmsContract';
import { validResolvedPage } from './fixtures/resolvedPage';

describe('parseCmsResolvedPage', () => {
  it('accepts and freezes the supported delivery contract', () => {
    const contract = parseCmsResolvedPage(validResolvedPage);
    expect(contract.page.renderer).toBe('axis.page.authentication');
    expect(contract.page.templateContract.renderer).toBe(
      'axis.template.authentication',
    );
    expect(contract.page.rendererChannels).toContain('web');
    expect(Object.isFrozen(contract.page.components)).toBe(true);
  });

  it.each([
    ['unsupported delivery version', { ...validResolvedPage, contractVersion: 99 }],
    [
      'missing renderer channels',
      {
        ...validResolvedPage,
        page: {
          ...validResolvedPage.page,
          rendererChannels: undefined,
        },
      },
    ],
    [
      'missing renderer version',
      {
        ...validResolvedPage,
        page: {
          ...validResolvedPage.page,
          rendererContractVersion: undefined,
        },
      },
    ],
    [
      'malformed properties',
      {
        ...validResolvedPage,
        page: {
          ...validResolvedPage.page,
          components: [
            {
              ...validResolvedPage.page.components[0],
              properties: 'unsafe',
            },
          ],
        },
      },
    ],
  ])('rejects %s', (_caseName, value) => {
    expect(() => parseCmsResolvedPage(value)).toThrow();
  });
});
