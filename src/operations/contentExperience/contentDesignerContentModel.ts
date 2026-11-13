import type {
  ContentDesignerContentField,
  ContentDesignerDraftLocalization,
} from './api/contentDesignerClient';

export type DesignerContentValues = Readonly<
  Record<string, Readonly<Record<string, unknown>>>
>;

/** Local form identity only; it carries no CMS persistence or scope authority. */
export function designerContentKey(
  scope: string,
  slot: string,
  locale: string,
): string {
  return JSON.stringify([scope, slot, locale]);
}

export function isLocalizedContentProperty(
  schema: Readonly<Record<string, unknown>> | undefined,
  property: string,
): boolean {
  const declaration = schema?.[property];
  return (
    typeof declaration === 'object' &&
    declaration !== null &&
    !Array.isArray(declaration) &&
    (declaration as Record<string, unknown>).localized === true
  );
}

function meaningful(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'string' || value.trim().length > 0) &&
    (!Array.isArray(value) || value.length > 0)
  );
}

function projectedValue(field: ContentDesignerContentField, value: unknown): unknown {
  if (field.control !== 'items' || !Array.isArray(value)) return value;
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(
      (field.itemFields ?? []).flatMap((child) => {
        const value = Object.getOwnPropertyDescriptor(item, child.property)
          ?.value as unknown;
        return value === undefined ? [] : [[child.property, value]];
      }),
    );
  });
}

function validValue(
  field: ContentDesignerContentField,
  value: unknown,
  required: boolean,
): boolean {
  if (!meaningful(value)) return !required;
  if (field.control !== 'items')
    return (
      typeof value === 'string' &&
      (field.maxLength === undefined || value.length <= field.maxLength)
    );
  return (
    Array.isArray(value) &&
    value.length <= (field.maximumItems ?? 32) &&
    value.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item) &&
        (field.itemFields ?? []).every((child) =>
          validValue(
            child,
            (item as Record<string, unknown>)[child.property],
            child.required === true,
          ),
        ),
    )
  );
}

/** Projects entered values into the existing CMS shared/locale DTOs, never generated placeholder copy. */
export function buildDesignerComponentContent(options: {
  readonly scope: string;
  readonly slot: string;
  readonly fields: readonly ContentDesignerContentField[];
  readonly propertySchema?: Readonly<Record<string, unknown>> | undefined;
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly values: DesignerContentValues;
  readonly slotsForReview?: readonly string[];
  readonly reviewedLanguages?: Readonly<Record<string, string>>;
}): {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly localizations: readonly ContentDesignerDraftLocalization[];
  readonly complete: boolean;
} {
  const {
    scope,
    slot,
    fields,
    propertySchema,
    defaultLocale,
    supportedLocales,
    values,
  } = options;
  const properties: Record<string, unknown> = {};
  let complete = fields.length > 0;
  for (const field of fields) {
    const localized = isLocalizedContentProperty(propertySchema, field.property);
    const value = projectedValue(
      field,
      values[designerContentKey(scope, slot, localized ? defaultLocale : '*')]?.[
        field.property
      ],
    );
    if (value !== undefined) properties[field.property] = value;
    complete &&= validValue(field, value, field.required === true);
    const declaration = propertySchema?.[field.property];
    const requiredLocales =
      typeof declaration === 'object' &&
      declaration !== null &&
      !Array.isArray(declaration)
        ? (declaration as Record<string, unknown>).requiredLocales
        : undefined;
    if (localized && Array.isArray(requiredLocales))
      for (const locale of requiredLocales) {
        complete &&=
          typeof locale === 'string' &&
          supportedLocales.includes(locale) &&
          validValue(
            field,
            values[designerContentKey(scope, slot, String(locale))]?.[field.property],
            true,
          );
      }
  }
  const localizations = supportedLocales.flatMap(
    (locale): readonly ContentDesignerDraftLocalization[] => {
      const localized: Record<string, unknown> = {};
      for (const field of fields) {
        if (!isLocalizedContentProperty(propertySchema, field.property)) continue;
        const value = projectedValue(
          field,
          values[designerContentKey(scope, slot, locale)]?.[field.property],
        );
        // A blank translation means fallback, rather than an invented or empty heading.
        if (meaningful(value)) {
          localized[field.property] = value;
          complete &&= validValue(field, value, false);
        }
      }
      return Object.keys(localized).length
        ? [
            {
              locale,
              properties: Object.freeze(localized),
              status:
                options.reviewedLanguages?.[designerContentKey(scope, '*', locale)] ===
                designerLanguageReviewSignature(
                  scope,
                  options.slotsForReview ?? [slot],
                  locale,
                  values,
                )
                  ? 'READY'
                  : 'DRAFT',
            },
          ]
        : [];
    },
  );
  return {
    properties: Object.freeze(properties),
    localizations: Object.freeze(localizations),
    complete,
  };
}

/** A review applies to the exact entered language values, shared values and section order. */
export function designerLanguageReviewSignature(
  scope: string,
  slots: readonly string[],
  locale: string,
  values: DesignerContentValues,
): string {
  return JSON.stringify(
    slots.map((slot) => [
      slot,
      values[designerContentKey(scope, slot, locale)] ?? {},
      values[designerContentKey(scope, slot, '*')] ?? {},
    ]),
  );
}
