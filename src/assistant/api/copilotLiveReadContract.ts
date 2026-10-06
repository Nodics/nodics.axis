/** @file Validated, non-authoritative source choices for the conversation evidence composer. */
import { assistantRecord } from './assistantContractParsers';

const keys = [
  'open',
  'title',
  'source',
  'collection',
  'search',
  'page',
  'correlation',
  'from',
  'to',
  'submit',
  'cancel',
  'failed',
  'database',
  'logs',
] as const;

/** Parses only identifiers, fingerprints and bounded owner copy; no command paths or executable configuration. */
export function parseCopilotLiveReads(value: unknown) {
  const root = assistantRecord(value, 'Live evidence choices');
  const copy = assistantRecord(root.presentation, 'Live evidence copy');
  if (!Array.isArray(root.sources) || root.sources.length > 1000)
    throw new Error('Invalid live sources');
  const sources = root.sources.map((value) => {
    const row = assistantRecord(value, 'Live source');
    if (
      typeof row.code !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(row.code) ||
      !['DATABASE', 'EXTERNAL_LOG'].includes(String(row.sourceType)) ||
      typeof row.sourcePolicyDigest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.sourcePolicyDigest) ||
      !Array.isArray(row.groupCodes) ||
      row.groupCodes.length > 100 ||
      row.groupCodes.some(
        (code) =>
          typeof code !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(code),
      ) ||
      new Set(row.groupCodes).size !== row.groupCodes.length
    )
      throw new Error('Invalid live source');
    return {
      code: row.code,
      sourceType: row.sourceType as 'DATABASE' | 'EXTERNAL_LOG',
      sourcePolicyDigest: row.sourcePolicyDigest,
      groupCodes: row.groupCodes as string[],
    };
  });
  if (new Set(sources.map((source) => source.code)).size !== sources.length)
    throw new Error('Duplicate live source');
  for (const key of keys)
    if (
      typeof copy[key] !== 'string' ||
      !String(copy[key]).trim() ||
      String(copy[key]).length > 500
    )
      throw new Error('Invalid live evidence copy');
  /** Accepts optional backend labels without widening unknown values into renderable content. */
  function optionalLabel(key: string): string | undefined {
    const value = copy[key];
    if (
      value !== undefined &&
      (typeof value !== 'string' || !value.trim() || value.length > 500)
    )
      throw new Error('Invalid collection inspection copy');
    return value;
  }
  return {
    sources,
    presentation: {
      ...(Object.fromEntries(keys.map((key) => [key, copy[key]])) as Record<
        (typeof keys)[number],
        string
      >),
      inspectCollections: optionalLabel('inspectCollections'),
      inspectSchema: optionalLabel('inspectSchema'),
      inspectCapabilities: optionalLabel('inspectCapabilities'),
    },
  };
}
export type CopilotLiveReads = ReturnType<typeof parseCopilotLiveReads>;
