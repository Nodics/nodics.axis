/** @file Bounded non-authoritative owner inspection choices supplied by Copilot. */
import { assistantRecord } from './assistantContractParsers';

const rulesOperations = [
  'rules.definition.list',
  'rules.definition.inspect',
  'rules.definition.versions',
  'rules.definition.audit',
  'rules.band.list',
  'rules.band.inspect',
  'rules.band.versions',
  'rules.property.catalogue',
] as const;

const processOperations = [
  'process.definition.list',
  'process.definition.inspect',
  'process.definition.versions',
  'process.instance.list',
  'process.instance.inspect',
  'process.instance.detail',
  'process.instance.tasks',
  'process.instance.activity',
  'process.instance.incidents',
  'process.task.inspect',
  'process.incident.inspect',
  'process.trigger.list',
] as const;

const importOperations = [
  'import.release.init.catalogue',
  'import.release.init.validate',
  'import.release.core.catalogue',
  'import.release.core.validate',
  'import.release.sample.catalogue',
  'import.release.sample.validate',
  'import.profile.list',
  'import.profile.validate',
  'import.run.history',
] as const;

/** Accepts only inert labels and fixed operation/code choices, never a native endpoint. */
function parseInspection<T extends string>(value: unknown, operations: readonly T[]) {
  const root = assistantRecord(value, 'Owner inspection');
  if (!Array.isArray(root.operations) || root.operations.length > operations.length)
    throw new Error('Invalid inspection operations');
  if (!root.operations.length) return undefined;
  const items = root.operations.map((value) => {
    const row = assistantRecord(value, 'Inspection operation');
    if (
      !operations.includes(row.code as (typeof operations)[number]) ||
      typeof row.label !== 'string' ||
      !row.label.trim() ||
      row.label.length > 100 ||
      (row.requiresCode !== undefined && typeof row.requiresCode !== 'boolean') ||
      !Array.isArray(row.codes) ||
      !row.codes.length ||
      row.codes.length > 100 ||
      row.codes.some(
        (code) =>
          typeof code !== 'string' ||
          !/^[A-Za-z][A-Za-z0-9._-]{0,127}(?::[A-Za-z][A-Za-z0-9_-]{0,127})?$/.test(
            code,
          ),
      ) ||
      new Set(row.codes).size !== row.codes.length
    )
      throw new Error('Invalid inspection choice');
    return {
      code: row.code as (typeof operations)[number],
      label: row.label,
      codes: row.codes as string[],
      requiresCode: row.requiresCode !== false,
    };
  });
  if (new Set(items.map((row) => row.code)).size !== items.length)
    throw new Error('Duplicate inspection operation');
  const copy = assistantRecord(root.presentation, 'Inspection presentation');
  const keys = ['title', 'operation', 'code', 'submit', 'cancel', 'failure'] as const;
  const presentation = Object.fromEntries(
    keys.map((key) => {
      const text = copy[key];
      if (typeof text !== 'string' || !text.trim() || text.length > 200)
        throw new Error('Invalid inspection label');
      return [key, text];
    }),
  ) as Record<(typeof keys)[number], string>;
  return { operations: items, presentation };
}

/** Accepts the fixed Rules family only, even when another inspection family is valid. */
export function parseCopilotRulesInspection(value: unknown) {
  return parseInspection(value, rulesOperations);
}

/** Accepts the fixed Process family only; no workflow mutation can become a read choice. */
export function parseCopilotProcessInspection(value: unknown) {
  return parseInspection(value, processOperations);
}

/** Accepts only fixed nImport catalogue, history and validation operations. */
export function parseCopilotImportInspection(value: unknown) {
  return parseInspection(value, importOperations);
}

export type CopilotRulesInspection = NonNullable<
  ReturnType<typeof parseCopilotRulesInspection>
>;

export type CopilotInspection =
  | CopilotRulesInspection
  | NonNullable<ReturnType<typeof parseCopilotProcessInspection>>
  | NonNullable<ReturnType<typeof parseCopilotImportInspection>>;
