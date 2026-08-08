import type { CmsComponentContract } from '../../cmsContract';
import type { AxisHelpMetadata } from '../../../app/help/workspaceHelpModel';

export function stringProperty(
  component: CmsComponentContract,
  name: string,
  fallback = '',
): string {
  const value = component.properties[name];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') {
    throw new Error(`${component.code}.${name} must be a string`);
  }
  return value;
}

export function assetPathProperty(
  component: CmsComponentContract,
  name: string,
  aliases: Readonly<Record<string, string>> = {},
  fallback = '',
): string {
  const value = stringProperty(component, name, fallback);
  if (!value) return '';
  const resolved = aliases[value] ?? value;
  if (
    !resolved.startsWith('/') ||
    resolved.startsWith('//') ||
    resolved.includes('\\') ||
    resolved.includes('://') ||
    resolved.length > 512
  ) {
    throw new Error(`${component.code}.${name} must be a safe asset path`);
  }
  return resolved;
}

export function booleanProperty(
  component: CmsComponentContract,
  name: string,
): boolean {
  const value = component.properties[name];
  if (value === undefined) return false;
  if (typeof value !== 'boolean') {
    throw new Error(`${component.code}.${name} must be a boolean`);
  }
  return value;
}

export function arrayProperty(
  component: CmsComponentContract,
  name: string,
): readonly unknown[] {
  const value = component.properties[name];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${component.code}.${name} must be an array`);
  }
  return value;
}

export function helpProperty(
  component: CmsComponentContract,
  name = 'help',
): AxisHelpMetadata | undefined {
  const value = component.properties[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${component.code}.${name} must be an object`);
  }
  const help = value as Readonly<Record<string, unknown>>;
  const summary = help.summary;
  const documentationRoute = help.documentationRoute;
  const documentationFragment = help.documentationFragment;
  if (summary !== undefined && (typeof summary !== 'string' || summary.length > 320)) {
    throw new Error(`${component.code}.${name}.summary must be a bounded string`);
  }
  if (
    documentationRoute !== undefined &&
    (typeof documentationRoute !== 'string' ||
      (documentationRoute !== '/docs' && !documentationRoute.startsWith('/docs/')) ||
      documentationRoute.startsWith('//') ||
      documentationRoute.includes('://'))
  ) {
    throw new Error(
      `${component.code}.${name}.documentationRoute must be a documentation route`,
    );
  }
  if (
    documentationFragment !== undefined &&
    (typeof documentationFragment !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(documentationFragment))
  ) {
    throw new Error(
      `${component.code}.${name}.documentationFragment must be a safe fragment`,
    );
  }
  return Object.freeze({
    summary,
    documentationRoute,
    documentationFragment,
  });
}
