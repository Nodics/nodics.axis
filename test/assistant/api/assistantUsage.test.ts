/** @file Protects nullable provider usage at the Axis API boundary. */
import { describe, expect, it } from 'vitest';

import { parseAssistantUsage } from '../../../src/assistant/api/assistantContractParsers';

describe('Assistant usage measurements', () => {
  it('keeps missing and explicitly unknown counts null', () => {
    const usage = parseAssistantUsage({
      usage: { inputTokens: null, outputTokens: 0 },
    });
    expect(usage.inputTokens).toBeNull();
    expect(usage.outputTokens).toBe(0);
    expect(usage.cachedInputTokens).toBeNull();
    expect(usage.reasoningTokens).toBeNull();
    expect(usage.embeddingTokens).toBeNull();
    expect(usage.reconciliationState).toBeUndefined();
  });

  it.each([-1, 0.5, '0', NaN, Infinity])(
    'rejects invalid supplied usage: %s',
    (inputTokens) => {
      expect(() => parseAssistantUsage({ usage: { inputTokens } })).toThrow();
    },
  );

  it('does not mistake measurement state for budget reconciliation', () => {
    const usage = parseAssistantUsage({
      usage: { inputTokens: 1, outputTokens: 2, state: 'MEASURED' },
    });
    expect(usage.reconciliationState).toBeUndefined();
  });
});
