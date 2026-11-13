import { expect, it } from 'vitest';
import {
  localizeNavigationItem,
  localizeNavigationGroup,
} from '../../src/app/shell/navigationLocalization';
import type { AxisNavigationItem } from '../../src/bootstrap/publicBootstrap';
const messages: Record<string, string> = {
  'axis.navigation.cms.sites.source': 'Websites and Content Catalogs',
  'axis.navigation.cms.sites': 'المواقع وكتالوجات المحتوى',
  'axis.navigation-group.content.source': 'Content and Experience',
  'axis.navigation-group.content': 'المحتوى والتجارب',
};
const format = (key: string, fallback: string) => messages[key] ?? fallback;
const item = {
  id: 'sites',
  moduleName: 'cms',
  label: 'Websites & Content Catalogs',
  route: '/content/sites',
} as AxisNavigationItem;
it('matches the canonical source after the existing display normalization', () => {
  expect(localizeNavigationItem(item, format).label).toBe('المواقع وكتالوجات المحتوى');
  expect(localizeNavigationGroup('content', 'Content & Experience', format)).toBe(
    'المحتوى والتجارب',
  );
});
it('preserves project-specific labels and refuses absent source witnesses', () => {
  const customized = { ...item, label: 'Our business websites' };
  expect(localizeNavigationItem(customized, format)).toBe(customized);
  expect(localizeNavigationGroup('content', 'Project experiences', format)).toBe(
    'Project experiences',
  );
  expect(localizeNavigationItem({ ...item, id: 'unknown' }, format).label).toBe(
    item.label,
  );
});
