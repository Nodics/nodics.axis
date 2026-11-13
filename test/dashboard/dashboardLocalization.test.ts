import { describe, it, expect } from 'vitest';
import { localizeDashboardComposition } from '../../src/dashboard/dashboardLocalization';
import { mergedDashboardFixture } from './dashboardCompositionFixture';
describe('published dashboard localization', () => {
  it('translates exact approved source text and preserves authored replacements and routing values', () => {
    const root = {
      ...mergedDashboardFixture,
      code: 'dashboard',
      properties: { title: 'Business', defaultView: 'overview' },
      components: [
        {
          ...mergedDashboardFixture,
          code: 'section',
          properties: { title: 'Customer authored title', route: '/authoritative' },
          components: [],
        },
      ],
    };
    const messages: Record<string, string> = {
      'axis.dashboard.dashboard.title': 'أعمال',
      'axis.dashboard.dashboard.title.source': 'Business',
      'axis.dashboard.section.title': 'عنوان سابق',
      'axis.dashboard.section.title.source': 'Previous title',
    };
    const translated = localizeDashboardComposition(
      root,
      (key, fallback) => messages[key] ?? fallback,
      'ar',
    );
    expect(translated.properties).toEqual({ title: 'أعمال', defaultView: 'overview' });
    expect(translated.components[0]?.properties).toEqual({
      title: 'Customer authored title',
      route: '/authoritative',
    });
    expect(root.properties.title).toBe('Business');
    expect(
      localizeDashboardComposition(
        root,
        (key, fallback) => messages[key] ?? fallback,
        'en',
      ),
    ).toBe(root);
  });
});
