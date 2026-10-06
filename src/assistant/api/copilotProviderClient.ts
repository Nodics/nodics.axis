/** @file Typed, secret-free provider connection probe through the canonical Copilot API. */
import { assistantRecord } from './assistantContractParsers';
import {
  createAssistantTransport,
  type AssistantTransportConfiguration,
} from './assistantTransport';

/** Accepts only bounded health, identity, time and owner-authored presentation. */
export function parseProviderCheck(value: unknown, enterpriseCode: string) {
  const root = assistantRecord(value, 'Provider check');
  const context = assistantRecord(root.context, 'Provider check scope');
  if (
    root.contractVersion !== 1 ||
    context.enterpriseCode !== enterpriseCode ||
    !['UP', 'DEGRADED', 'DOWN', 'NOT_CONFIGURED', 'UNSUPPORTED'].includes(
      String(root.state),
    ) ||
    ['title', 'message', 'observedAt'].some(
      (key) =>
        typeof root[key] !== 'string' ||
        !String(root[key]).trim() ||
        String(root[key]).length > 500,
    ) ||
    !Number.isFinite(Date.parse(String(root.observedAt))) ||
    (root.model !== null && (typeof root.model !== 'string' || root.model.length > 128))
  )
    throw new Error('Invalid provider check');
  return {
    state: String(root.state),
    title: String(root.title),
    message: String(root.message),
    observedAt: String(root.observedAt),
    model: root.model,
  };
}

/** Issues exactly one explicit probe; never accepts provider URLs, prompts or secrets. */
export async function checkProvider(
  configuration: AssistantTransportConfiguration,
  adapter?: string,
  signal?: AbortSignal,
) {
  const result = await createAssistantTransport(configuration).request(
    '/providers/check',
    {
      method: 'POST',
      body: adapter ? { adapter } : {},
      signal,
    },
  );
  if (adapter && assistantRecord(result, 'Provider check').adapter !== adapter)
    throw new Error('Provider selection changed');
  return parseProviderCheck(result, configuration.enterpriseCode);
}
