export type CmsRendererKind = 'page' | 'template' | 'component';

export interface CmsRendererManifestEntry {
  readonly kind: CmsRendererKind;
  readonly contractVersions: readonly number[];
}

export const CMS_RENDERER_MANIFEST = Object.freeze({
  'axis.page.authentication': {
    kind: 'page',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.page.dashboard': {
    kind: 'page',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.page.assistant': {
    kind: 'page',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.page.schema-workbench': {
    kind: 'page',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.page.media-management': {
    kind: 'page',
    contractVersions: Object.freeze([0, 1]),
  },
  'documentation.page.article': {
    kind: 'page',
    contractVersions: Object.freeze([0, 1, 2]),
  },
  'axis.template.authentication': {
    kind: 'template',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.template.dashboard': {
    kind: 'template',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.template.assistant': {
    kind: 'template',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.template.schema-workbench': {
    kind: 'template',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.template.media-management': {
    kind: 'template',
    contractVersions: Object.freeze([0, 1]),
  },
  'documentation.template.article': {
    kind: 'template',
    contractVersions: Object.freeze([0, 1, 2]),
  },
  'axis.component.brand': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.message': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.authentication-showcase': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.employee-login-form': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.employee-recovery-form': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.employee-lock-form': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.link': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.dashboard-summary': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.dashboard-actions': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.assistant-workspace': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.schema-workbench': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.schema-query-builder': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'axis.component.media-management-workspace': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1]),
  },
  'documentation.component.article': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1, 2]),
  },
  'documentation.component.navigation': {
    kind: 'component',
    contractVersions: Object.freeze([0, 1, 2]),
  },
  'cms.component.rich-text': {
    kind: 'component',
    contractVersions: Object.freeze([0]),
  },
} satisfies Readonly<Record<string, CmsRendererManifestEntry>>);

export type CmsRendererKey = keyof typeof CMS_RENDERER_MANIFEST;

export function isRendererSupported(
  renderer: string,
  kind: CmsRendererKind,
  contractVersion: number,
): renderer is CmsRendererKey {
  const entry = (
    CMS_RENDERER_MANIFEST as Readonly<
      Record<string, CmsRendererManifestEntry | undefined>
    >
  )[renderer];
  return entry?.kind === kind && entry.contractVersions.includes(contractVersion);
}
