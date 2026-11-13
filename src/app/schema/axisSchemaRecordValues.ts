import type { WorkbenchField } from '../../workbench/api/workbenchContracts';

export function isDateLikeSchemaField(field: WorkbenchField): boolean {
  return (
    field.type === 'date' ||
    /(^|\.)(created|updated|createdAt|updatedAt|modified|modifiedAt)$/i.test(field.name)
  );
}

export function isLongSchemaDetailField(field: WorkbenchField, value: string): boolean {
  return (
    value.length > 72 ||
    /checksum|token|secret|signature|description|json|payload/i.test(field.name)
  );
}

export function formatAxisRecordDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
  }).format(date);
}

export function axisSchemaRecordDisplayValue(
  value: unknown,
  field?: WorkbenchField,
  trueLabel = 'Yes',
  falseLabel = 'No',
  locale?: string,
): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) {
    const values = value
      .map((item) =>
        axisSchemaRecordDisplayValue(item, field, trueLabel, falseLabel, locale),
      )
      .filter((item) => item !== '—');
    return values.length ? values.join(', ') : '—';
  }
  if (
    field &&
    isDateLikeSchemaField(field) &&
    (typeof value === 'string' || typeof value === 'number' || value instanceof Date)
  ) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      if (locale) return formatAxisRecordDate(date, locale);
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    }
  }
  if (typeof value === 'boolean') return value ? trueLabel : falseLabel;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const objectValue = value as Readonly<Record<string, unknown>>;
    const displayCandidate =
      objectValue.code ?? objectValue.name ?? objectValue.label ?? objectValue.id;
    if (
      typeof displayCandidate === 'string' ||
      typeof displayCandidate === 'number' ||
      typeof displayCandidate === 'boolean'
    ) {
      return axisSchemaRecordDisplayValue(
        displayCandidate,
        field,
        trueLabel,
        falseLabel,
        locale,
      );
    }
    return 'Related data';
  }
  return '—';
}
