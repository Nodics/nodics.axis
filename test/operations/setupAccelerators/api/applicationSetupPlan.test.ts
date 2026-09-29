import { describe, expect, it } from 'vitest';
import { parseApplicationSetupPlan } from '../../../../src/operations/setupAccelerators/api/applicationSetupPlan';

const stage = {
  code: 'newStage',
  title: 'New stage',
  summary: 'Owner-provided step',
  items: [
    {
      code: 'item',
      label: 'An optional item',
      required: false,
      type: 'NEW_TYPE',
      owner: 'newOwner',
      script: 'should not be carried',
    },
  ],
};
describe('setup plan contract', () => {
  it('accepts a future stage and projects only inert public fields', () => {
    const plan = parseApplicationSetupPlan({
      contractVersion: 1,
      stages: [stage],
      secret: 'not public',
    });
    expect(plan?.stages[0]?.code).toBe('newStage');
    expect(plan?.stages[0]?.items[0]?.required).toBe(false);
    expect(JSON.stringify(plan)).not.toContain('script');
    expect(JSON.stringify(plan)).not.toContain('secret');
  });
  it('rejects incompatible, duplicate and unbounded plans', () => {
    for (const value of [
      null,
      { contractVersion: 2, stages: [] },
      { contractVersion: 1, stages: [stage, stage] },
      {
        contractVersion: 1,
        stages: [{ ...stage, items: [stage.items[0], stage.items[0]] }],
      },
      { contractVersion: 1, stages: [{ ...stage, title: 'a'.repeat(2001) }] },
    ])
      expect(() => parseApplicationSetupPlan(value)).toThrow('incompatible');
    expect(parseApplicationSetupPlan(undefined)).toBeUndefined();
  });
});
