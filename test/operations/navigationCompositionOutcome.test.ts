import { describe, expect, it } from 'vitest';
import { navigationCompositionOutcome } from '../../src/operations/navigationComposition/navigationCompositionOutcome';

const scope = {
  tenantCode: 'default',
  enterpriseCode: 'enterprise',
  projectCode: 'project',
};
const snapshot = () => ({
  exportFormatVersion: 0,
  exportedAt: '2026-11-03T17:00:00.000Z',
  composition: {
    contractVersion: 0,
    version: 0,
    checksum: 'a'.repeat(64),
    lifecycleState: 'PUBLISHED',
    source: 'MODULE_DEFAULTS',
    scope: { ...scope },
    groups: [],
    navigation: [{ moduleName: 'cms', id: 'pages', route: '/content/pages' }],
    sourceTrace: { unchanged: true },
  },
});

describe('native navigation action evidence', () => {
  it('preserves the exact owner snapshot and version zero in the download', () => {
    const data = snapshot();
    const result = navigationCompositionOutcome('export', data, scope);
    expect(JSON.parse(result.snapshot!.json)).toEqual(data);
    expect(result.snapshot).toMatchObject({
      version: 0,
      itemCount: 1,
      filename: 'axis-navigation-v0-aaaaaaaaaaaa.json',
    });
    expect(result.message).not.toMatch(/published effective/);
  });
  it.each(['tenantCode', 'enterpriseCode', 'projectCode'] as const)(
    'refuses a foreign %s snapshot',
    (key) => {
      const data = snapshot();
      data.composition.scope[key] = 'other';
      expect(() => navigationCompositionOutcome('export', data, scope)).toThrow(
        /scope/,
      );
    },
  );
  it.each([
    { exportFormatVersion: 1 },
    { exportedAt: 'invalid' },
    { composition: null },
    { composition: { ...snapshot().composition, version: -1 } },
    { composition: { ...snapshot().composition, checksum: 'invented' } },
    { composition: { ...snapshot().composition, navigation: {} } },
    { composition: { ...snapshot().composition, lifecycleState: 'DRAFT' } },
  ])('holds malformed owner snapshots', (patch) => {
    expect(() =>
      navigationCompositionOutcome('export', { ...snapshot(), ...patch }, scope),
    ).toThrow();
  });
  it('does not require a project scope the owner omits', () => {
    const data = snapshot();
    const { projectCode: unused, ...ownerScope } = data.composition.scope;
    void unused;
    expect(
      navigationCompositionOutcome(
        'export',
        { ...data, composition: { ...data.composition, scope: ownerScope } },
        scope,
      ).snapshot,
    ).toBeDefined();
  });
  it('shows rejected preview issues with no persistence or publication claim', () => {
    const result = navigationCompositionOutcome(
      'preview',
      {
        mode: 'DRY_RUN_ONLY',
        persisted: false,
        published: false,
        validation: {
          valid: false,
          issues: [
            {
              code: 'DUPLICATE_ROUTE',
              message: 'Two owners use the same route.',
              route: '/content',
            },
          ],
        },
        impact: { currentItemCount: 3, candidateItemCount: 4 },
      },
      scope,
    );
    expect(result.severity).toBe('warning');
    expect(result.issues).toEqual(['Two owners use the same route. Route: /content.']);
    expect(result.message).toContain('Nothing was saved or published.');
  });
  it('confirms only a genuine dry run', () => {
    const data = {
      mode: 'DRY_RUN_ONLY',
      persisted: false,
      published: false,
      validation: { valid: true, issues: [] },
      impact: { currentItemCount: 0, candidateItemCount: 0 },
    };
    expect(navigationCompositionOutcome('preview', data, scope).message).toContain(
      '0 navigation items',
    );
    expect(() =>
      navigationCompositionOutcome('preview', { ...data, published: true }, scope),
    ).toThrow();
  });
  it('keeps approval separate from publication and rejects mismatched lifecycle acknowledgements', () => {
    const receipt = {
      version: 1,
      checksum: 'b'.repeat(64),
      lifecycleState: 'APPROVED',
    };
    expect(navigationCompositionOutcome('approve', receipt, scope).message).toContain(
      'Publication is a separate action.',
    );
    expect(() => navigationCompositionOutcome('publish', receipt, scope)).toThrow(
      /Inspect the owner/,
    );
  });
});
