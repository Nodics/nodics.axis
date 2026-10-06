/** @file Validates inert, complete owner-projected confirmation details without interpreting business schemas. */
import { assistantRecord } from './assistantContractParsers';

/** Returns bounded labeled fields; malformed review evidence must disable approval, never disappear silently. */
export function parseAssistantReview(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.length || value.length > 200)
    throw new Error('Invalid action review');
  return value.map((raw) => {
    const section = assistantRecord(raw, 'Review section');
    if (
      typeof section.title !== 'string' ||
      !section.title.trim() ||
      section.title.length > 128 ||
      !Array.isArray(section.fields) ||
      !section.fields.length ||
      section.fields.length > 20
    )
      throw new Error('Invalid review section');
    return {
      title: section.title,
      fields: section.fields.map((raw) => {
        const field = assistantRecord(raw, 'Review field');
        if (
          typeof field.label !== 'string' ||
          !field.label.trim() ||
          field.label.length > 128 ||
          typeof field.value !== 'string' ||
          field.value.length > 2000
        )
          throw new Error('Invalid review field');
        return { label: field.label, value: field.value };
      }),
    };
  });
}
