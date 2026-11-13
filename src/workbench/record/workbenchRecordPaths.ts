import type { WorkbenchField } from '../api/workbenchContracts';

export function workbenchRecordValue(
  record: Readonly<Record<string, unknown>> | undefined,
  path: string,
): unknown {
  if (!record) return undefined;
  if (Object.prototype.hasOwnProperty.call(record, path)) {
    return record[path];
  }
  return path.split('.').reduce<unknown>((current, segment) => {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, record);
}

export function setWorkbenchRecordValue(
  record: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path.includes('.')) {
    record[path] = value;
    return;
  }
  const segments = path.split('.');
  const leaf = segments.pop();
  if (!leaf) return;
  let current: Record<string, unknown> = record;
  segments.forEach((segment) => {
    const existing = current[segment];
    if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      current = existing as Record<string, unknown>;
      return;
    }
    const next: Record<string, unknown> = {};
    current[segment] = next;
    current = next;
  });
  current[leaf] = value;
}

export function compactWorkbenchDraft(
  draft: Readonly<Record<string, unknown>>,
  operation: 'create' | 'update' = 'create',
  original?: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  Object.entries(draft).forEach(([path, value]) => {
    if (value === undefined) return;
    if (value === '') {
      const previous = workbenchRecordValue(original, path);
      if (operation === 'create' || typeof previous !== 'string' || previous === '')
        return;
    }
    setWorkbenchRecordValue(model, path, value);
  });
  return model;
}

export function containerFieldNames(
  fields: readonly WorkbenchField[],
): ReadonlySet<string> {
  return new Set(
    fields
      .map((field) => field.name)
      .filter((name) => fields.some((field) => field.name.startsWith(`${name}.`))),
  );
}
