import type { CmsComponentContract } from '../cms/cmsContract';
import type { AxisLocalizationState } from '../localization/localizationContracts';

/** Translate published copy only when its approved source witness still matches. Composition, routes and owner identifiers remain authoritative. */
export function localizeDashboardComposition(
  component: CmsComponentContract,
  format: AxisLocalizationState['format'],
  locale: string,
): CmsComponentContract {
  if (locale.startsWith('en')) return component;
  const translate = (value: unknown, path: readonly string[]): unknown => {
    if (typeof value === 'string') {
      const key = [
        'axis.dashboard',
        component.code.toLowerCase(),
        ...path.map((part) => part.toLowerCase()),
      ].join('.');
      return format(key + '.source', '') === value ? format(key, value) : value;
    }
    if (value && typeof value === 'object' && !Array.isArray(value))
      return Object.fromEntries(
        Object.entries(value).map(([name, child]) => [
          name,
          translate(child, [...path, name]),
        ]),
      );
    return value;
  };
  return {
    ...component,
    properties: Object.fromEntries(
      Object.entries(component.properties).map(([name, value]) => [
        name,
        translate(value, [name]),
      ]),
    ),
    components: component.components.map((child) =>
      localizeDashboardComposition(child, format, locale),
    ),
  };
}
