import type { AxisNavigationItem } from './publicBootstrap';

export type DocumentationGuideKind = 'framework' | 'axis' | 'project';

/** Identifies the backend navigation item used by the docs route availability gate. */
export function isDocumentationNavigationItem(item: AxisNavigationItem): boolean {
  const route = item.route.replace(/\/$/, '') || '/';
  const groupId = item.group?.id?.trim().toLowerCase();
  const groupLabel = item.group?.label?.trim().toLowerCase();
  return (
    (item.id === 'documentation' && item.moduleName === 'backoffice') ||
    route === '/docs' ||
    route.startsWith('/docs/') ||
    groupId === 'documentation' ||
    groupLabel === 'documentation'
  );
}
