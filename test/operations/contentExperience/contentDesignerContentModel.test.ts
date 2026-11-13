import { describe, expect, it } from 'vitest';
import {
  buildDesignerComponentContent,
  designerContentKey,
  designerLanguageReviewSignature,
} from '../../../src/operations/contentExperience/contentDesignerContentModel';
import type { ContentDesignerContentField } from '../../../src/operations/contentExperience/api/contentDesignerClient';

const fields: readonly ContentDesignerContentField[] = [
  { property: 'title', label: 'Heading', control: 'text', required: true },
  { property: 'body', label: 'Body text', control: 'multiline' },
];
const options = {
  scope: 'enterprise/site/type',
  slot: 'main',
  fields,
  defaultLocale: 'en',
  supportedLocales: ['en', 'ar'],
  propertySchema: {
    title: { localized: true, requiredLocales: ['en'] },
    body: { localized: true },
  },
  values: {},
};
const key = (locale: string) => designerContentKey(options.scope, options.slot, locale);

describe('Business content draft projection', () => {
  it('holds empty content without inventing placeholder copy or translations', () => {
    expect(buildDesignerComponentContent(options)).toEqual({
      properties: {},
      localizations: [],
      complete: false,
    });
  });

  it('keeps the default content and emits only declared entered translations with fallback for blanks', () => {
    const result = buildDesignerComponentContent({
      ...options,
      values: {
        [key('en')]: {
          title: 'Collection information',
          body: 'Bring accepted items.',
          hidden: 'not a field',
        },
        [key('ar')]: { title: '', body: 'معلومات الجمع', hidden: 'not a field' },
      },
    });
    expect(result.complete).toBe(true);
    expect(result.properties).toEqual({
      title: 'Collection information',
      body: 'Bring accepted items.',
    });
    expect(result.localizations).toEqual([
      { locale: 'en', properties: result.properties, status: 'DRAFT' },
      { locale: 'ar', properties: { body: 'معلومات الجمع' }, status: 'DRAFT' },
    ]);
  });

  it('does not substitute another scope or an Arabic-only value for required English content', () => {
    expect(
      buildDesignerComponentContent({
        ...options,
        values: {
          [key('ar')]: { title: 'عنوان' },
          [designerContentKey('another-enterprise', 'main', 'en')]: {
            title: 'Foreign draft',
          },
        },
      }).complete,
    ).toBe(false);
  });

  it('requires explicit review of each entered language and invalidates only changed language values', () => {
    const values = {
      [key('en')]: { title: 'Our services' },
      [key('ar')]: { title: 'خدماتنا' },
    };
    const reviewedLanguages = {
      [designerContentKey(options.scope, '*', 'en')]: designerLanguageReviewSignature(
        options.scope,
        ['main'],
        'en',
        values,
      ),
    };
    const project = (next = values) =>
      buildDesignerComponentContent({ ...options, values: next, reviewedLanguages });
    expect(project().localizations.map((item) => [item.locale, item.status])).toEqual([
      ['en', 'READY'],
      ['ar', 'DRAFT'],
    ]);
    expect(
      project({ ...values, [key('en')]: { title: 'Changed after review' } })
        .localizations[0]?.status,
    ).toBe('DRAFT');
    expect(
      project({ ...values, [key('ar')]: { title: 'تحديث' } }).localizations[0]?.status,
    ).toBe('READY');
    expect(
      buildDesignerComponentContent({
        ...options,
        values,
        slotsForReview: ['main', 'footer'],
        reviewedLanguages,
      }).localizations[0]?.status,
    ).toBe('DRAFT');
  });

  it('uses shared card controls, requires entered item headings, and omits removed item fields', () => {
    const cards: readonly ContentDesignerContentField[] = [
      {
        property: 'items',
        label: 'Cards',
        control: 'items',
        required: true,
        maximumItems: 2,
        itemFields: [
          { property: 'title', label: 'Card heading', control: 'text', required: true },
        ],
      },
    ];
    const shared = { ...options, fields: cards, propertySchema: undefined };
    expect(
      buildDesignerComponentContent({
        ...shared,
        values: { [key('*')]: { items: [{}] } },
      }).complete,
    ).toBe(false);
    const result = buildDesignerComponentContent({
      ...shared,
      values: {
        [key('*')]: {
          items: [{ title: 'Accepted items', retiredField: 'must not be sent' }],
        },
      },
    });
    expect(result).toEqual({
      properties: { items: [{ title: 'Accepted items' }] },
      localizations: [],
      complete: true,
    });
    expect(
      buildDesignerComponentContent({
        ...shared,
        values: {
          [key('*')]: { items: Array.from({ length: 3 }, () => ({ title: 'Extra' })) },
        },
      }).complete,
    ).toBe(false);
  });
});
