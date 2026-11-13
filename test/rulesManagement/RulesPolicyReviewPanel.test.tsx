import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRulesReview } from '../../src/operations/rulesManagement/api/rulesReviewClient';
import * as client from '../../src/operations/rulesManagement/api/rulesClient';
import { rule, catalogue, bandSet } from './fixtures';
vi.mock('../../src/operations/rulesManagement/api/rulesClient', () => ({
  loadRuleDefinition: vi.fn(),
  loadPropertyCatalogue: vi.fn(),
  loadScoreBandVersions: vi.fn(),
}));
const configuration = {
  bootstrap: {} as never,
  accessToken: 'reviewer',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const identity = {
  ruleSetCode: rule.code,
  draftRevision: 3,
  instanceCode: 'rules-review-3',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(client.loadRuleDefinition).mockResolvedValue({
    ...rule,
    approval: { status: 'PENDING', processInstanceCode: identity.instanceCode },
    validation: { valid: true, issues: [] },
    lastSimulation: {
      draftRevision: 3,
      sourceHash: 'a'.repeat(64),
      bandSetCode: bandSet.code,
      bandSetVersion: 1,
    },
  });
  vi.mocked(client.loadPropertyCatalogue).mockResolvedValue(catalogue);
  vi.mocked(client.loadScoreBandVersions).mockResolvedValue([
    { ...bandSet, version: 1 },
  ]);
});
describe('Rules exact Process review', () => {
  it('reads the pending saved revision and immutable simulated bands', async () => {
    const result = await loadRulesReview(configuration, identity);
    expect(result.rule.draftRevision).toBe(3);
    expect(result.band?.version).toBe(1);
  });
  it('refuses a different revision or workflow before showing its content', async () => {
    await expect(
      loadRulesReview(configuration, { ...identity, draftRevision: 4 }),
    ).rejects.toThrow(/no longer/);
    expect(client.loadPropertyCatalogue).not.toHaveBeenCalled();
    await expect(
      loadRulesReview(configuration, { ...identity, instanceCode: 'other' }),
    ).rejects.toThrow(/no longer/);
  });
  it('refuses missing or ambiguous immutable band evidence and denied owner reads', async () => {
    vi.mocked(client.loadScoreBandVersions).mockResolvedValue([]);
    await expect(loadRulesReview(configuration, identity)).rejects.toThrow(
      /unavailable/,
    );
    vi.mocked(client.loadRuleDefinition).mockRejectedValue(new Error('Access denied'));
    await expect(loadRulesReview(configuration, identity)).rejects.toThrow(
      'Access denied',
    );
  });
});
