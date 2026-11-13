import { AxisApiError, parseAxisApiError } from '../../../localization/axisApiError';
import type { AxisLocalizedErrorContract } from '../../../localization/localizationContracts';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface ContentDesignerClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface ContentDesignerDraftComponentMedia {
  readonly code?: string | undefined;
  readonly altText?: string | undefined;
  readonly caption?: string | undefined;
  readonly componentMediaCode?: string | undefined;
  readonly mediaCode?: string | undefined;
  readonly mediaSetCode?: string | undefined;
  readonly mediaType?: string | undefined;
  readonly localeCode?: string | undefined;
  readonly position?: number | undefined;
  readonly role?: string | undefined;
  readonly slot?: string | undefined;
}

export interface ContentDesignerDraftLocalization {
  readonly code?: string | undefined;
  readonly locale: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly seo?: Readonly<Record<string, unknown>> | undefined;
  readonly status?: string | undefined;
}

export interface ContentDesignerDraftComponent {
  readonly sections?: readonly ContentDesignerDraftSection[] | undefined;
  readonly accessMode?: string | undefined;
  readonly code: string;
  readonly media?: readonly ContentDesignerDraftComponentMedia[] | undefined;
  readonly localizations?: readonly ContentDesignerDraftLocalization[] | undefined;
  readonly properties?: Readonly<Record<string, unknown>> | undefined;
  readonly renderer?: string | undefined;
  readonly typeCode: string;
}

export interface ContentDesignerDraftSection {
  readonly code?: string | undefined;
  readonly components: readonly ContentDesignerDraftComponent[];
  readonly index?: number | undefined;
  readonly slot: string;
}

export interface ContentDesignerDraft {
  readonly sourceVersion?: string | undefined;
  readonly catalogCode: string;
  readonly navigation?: Readonly<Record<string, unknown>> | undefined;
  readonly page: {
    readonly code: string;
    readonly name: string;
    readonly renderer?: string | undefined;
    readonly typeCode: string;
  };
  readonly route?: Readonly<Record<string, unknown>> | undefined;
  readonly sections: readonly ContentDesignerDraftSection[];
  readonly siteCode: string;
  readonly templateCode: string;
}

export interface ContentDesignerSavedPage {
  readonly draft: ContentDesignerDraft;
  readonly sourceVersion: string;
  readonly editable: boolean;
  readonly issues: readonly string[];
}

/** Reads a bounded owner-scoped library; a failed or oversized library is never treated as empty. */
export async function listContentDesignerPages(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  scope: { readonly catalogCode: string; readonly siteCode: string },
): Promise<readonly { readonly code: string; readonly name: string }[]> {
  const query = new URLSearchParams(scope);
  const result = asRecord(
    await designerRequest(
      connection,
      configuration,
      `/designer/composition/pages?${query}`,
      { method: 'GET' },
    ),
    'CMS saved pages',
  );
  if (!Array.isArray(result.pages) || result.pages.length > 100)
    throw new Error('CMS saved page choices are incomplete');
  const seen = new Set<string>();
  return result.pages.map((value) => {
    const page = asRecord(value, 'CMS saved page');
    if (
      typeof page.code !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(page.code) ||
      seen.has(page.code) ||
      typeof page.name !== 'string' ||
      !page.name.trim()
    )
      throw new Error('CMS saved page choices are invalid');
    seen.add(page.code);
    return { code: page.code, name: page.name };
  });
}

/** Reopens only the exact requested owner scope and saved identity, retaining inert unexposed properties. */
export async function loadContentDesignerPage(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  selection: {
    readonly catalogCode: string;
    readonly siteCode: string;
    readonly pageCode: string;
  },
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerSavedPage> {
  const query = new URLSearchParams(selection);
  const result = asRecord(
    await designerRequest(
      connection,
      configuration,
      `/designer/composition/draft?${query}`,
      { method: 'GET' },
      fetchImplementation,
    ),
    'CMS saved composition',
  );
  const draft = asRecord(result.draft, 'CMS saved draft');
  const page = asRecord(draft.page, 'CMS saved page');
  const code = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
  if (
    typeof result.sourceVersion !== 'string' ||
    !/^[a-f0-9]{64}$/.test(result.sourceVersion) ||
    draft.sourceVersion !== result.sourceVersion ||
    typeof result.editable !== 'boolean' ||
    !Array.isArray(result.issues) ||
    result.issues.length > 100 ||
    result.issues.some(
      (item: unknown) => typeof item !== 'string' || !item.trim() || item.length > 1024,
    ) ||
    draft.catalogCode !== selection.catalogCode ||
    draft.siteCode !== selection.siteCode ||
    page.code !== selection.pageCode ||
    !code(draft.templateCode) ||
    !code(page.typeCode) ||
    typeof page.name !== 'string' ||
    !page.name.trim() ||
    !Array.isArray(draft.sections) ||
    draft.sections.length > 100
  )
    throw new Error('CMS saved composition is invalid or belongs to another selection');
  const placements = new Set<string>();
  const components = new Set<string>([selection.pageCode]);
  let count = 0;
  const inspectSections = (sections: unknown[], depth: number) => {
    if (depth > 12 || sections.length > 100)
      throw new Error('CMS saved composition exceeds the supported bounds');
    for (const value of sections) {
      const section = asRecord(value, 'CMS saved section');
      if (
        !code(section.code) ||
        placements.has(section.code) ||
        !code(section.slot) ||
        !Number.isSafeInteger(section.index) ||
        !Array.isArray(section.components) ||
        section.components.length !== 1
      )
        throw new Error('CMS saved placements are invalid');
      placements.add(section.code);
      const component = asRecord(section.components[0], 'CMS saved block');
      if (
        !code(component.code) ||
        !code(component.typeCode) ||
        components.has(component.code) ||
        ++count > 100
      )
        throw new Error('CMS saved block identity is invalid');
      components.add(component.code);
      if (component.sections !== undefined) {
        if (!Array.isArray(component.sections))
          throw new Error('CMS nested sections are invalid');
        inspectSections(component.sections, depth + 1);
      }
      if (component.properties !== undefined)
        asRecord(component.properties, 'CMS saved properties');
      if (
        !Array.isArray(component.localizations) ||
        component.localizations.length > 100 ||
        !Array.isArray(component.media) ||
        component.media.length > 100
      )
        throw new Error('CMS saved block references are invalid');
      const locales = new Set<string>();
      for (const value of component.localizations) {
        const localization = asRecord(value, 'CMS saved translation');
        if (
          !code(localization.code) ||
          typeof localization.locale !== 'string' ||
          !localization.locale.trim() ||
          locales.has(localization.locale)
        )
          throw new Error('CMS saved translations are ambiguous');
        locales.add(localization.locale);
        asRecord(localization.properties, 'CMS saved translation content');
        if (localization.seo !== undefined)
          asRecord(localization.seo, 'CMS saved translation metadata');
      }
      for (const value of component.media) {
        const media = asRecord(value, 'CMS saved Media association');
        if (!code(media.code)) throw new Error('CMS saved Media identity is invalid');
      }
    }
  };
  inspectSections(draft.sections, 0);
  if (draft.route !== undefined) asRecord(draft.route, 'CMS saved route');
  return {
    draft: draft as unknown as ContentDesignerDraft,
    sourceVersion: result.sourceVersion,
    editable: result.editable,
    issues: result.issues as string[],
  };
}

export interface ContentDesignerContentField {
  readonly labelKey?: string | undefined;
  readonly itemLabelKey?: string | undefined;
  readonly property: string;
  readonly label: string;
  readonly control: 'text' | 'multiline' | 'items';
  readonly required?: boolean | undefined;
  readonly maxLength?: number | undefined;
  readonly maximumItems?: number | undefined;
  readonly itemLabel?: string | undefined;
  readonly itemFields?: readonly ContentDesignerContentField[] | undefined;
}

export interface ContentDesignerComponentKind {
  readonly compatibleRenderers?: readonly string[] | undefined;
  readonly label: string;
  readonly renderer: string;
  readonly typeCode: string;
  readonly fields?: readonly ContentDesignerContentField[] | undefined;
}

export interface ContentDesignerDraftDefaults {
  readonly accessMode?: string | undefined;
  readonly catalogCode?: string | undefined;
  readonly pageRenderer?: string | undefined;
  readonly pageTypeCode?: string | undefined;
  readonly routePath?: string | undefined;
  readonly siteCode?: string | undefined;
  readonly slots?: readonly string[] | undefined;
  readonly templateCode?: string | undefined;
}

export interface ContentDesignerReference {
  readonly access?: string | undefined;
  readonly allowedComponentTypeGroups?: readonly string[] | undefined;
  readonly allowedComponentTypes?: readonly string[] | undefined;
  readonly catalogCode?: string | undefined;
  readonly catalogType?: string | undefined;
  readonly code: string;
  readonly componentTypeCodes?: readonly string[] | undefined;
  readonly height?: number | undefined;
  readonly kind?: string | undefined;
  readonly maxItems?: number | undefined;
  readonly minItems?: number | undefined;
  readonly name: string;
  readonly nodeType?: string | undefined;
  readonly parentCode?: string | undefined;
  readonly propertySchema?: Readonly<Record<string, unknown>> | undefined;
  readonly renderer?: string | undefined;
  readonly reusable?: boolean | undefined;
  readonly siteCode?: string | undefined;
  readonly templateCode?: string | undefined;
  readonly typeCode?: string | undefined;
  readonly width?: number | undefined;
}

export interface ContentDesignerLocalizationPolicy {
  readonly routeLocale?: string | undefined;
  readonly defaultLocale: string;
  readonly fallbackLocales: readonly string[];
  readonly supportedLocales: readonly string[];
}

export interface ContentDesignerPublicationReadiness {
  readonly requiredDraftParts: readonly string[];
  readonly requireNavigationForPublish: boolean;
}

export interface ContentDesignerAuthoringMetadata {
  readonly componentTypeGroups: readonly ContentDesignerReference[];
  readonly componentTypes: readonly ContentDesignerReference[];
  readonly contentCatalogs: readonly ContentDesignerReference[];
  readonly mediaFolders: readonly ContentDesignerReference[];
  readonly mediaFormats: readonly ContentDesignerReference[];
  readonly mediaTypes: readonly string[];
  readonly localization: ContentDesignerLocalizationPolicy;
  readonly navigationNodes: readonly ContentDesignerReference[];
  readonly pageTemplates: readonly ContentDesignerReference[];
  readonly pageTypes: readonly ContentDesignerReference[];
  readonly publicationReadiness: ContentDesignerPublicationReadiness;
  readonly sites: readonly ContentDesignerReference[];
  readonly slotDefinitions: readonly ContentDesignerReference[];
}

export interface ContentDesignerAuthoringModel {
  readonly presentation?: ContentDesignerFormPresentation | undefined;
  readonly retirement?: ContentDesignerRetirementPresentation | undefined;
  readonly defaults: {
    readonly nesting?:
      | {
          readonly maximumDepth: number;
          readonly maximumComponents: number;
          readonly defaultSlot: string;
        }
      | undefined;
    readonly componentKinds: readonly ContentDesignerComponentKind[];
    readonly draftDefaults: ContentDesignerDraftDefaults;
    readonly maximumReferenceLookupItems?: number | undefined;
    readonly requireNavigationForPublish: boolean;
  };
  readonly hierarchy: readonly string[];
  readonly metadata: ContentDesignerAuthoringMetadata;
  readonly operations: readonly string[];
  readonly rules: {
    readonly arbitrarySlots: boolean;
    readonly catalogFirst: boolean;
    readonly frontendPersistence: boolean;
    readonly pixelPerfectRendering: boolean;
  };
}

/** Inert owner-defined form copy; operation admission is independent of presentation. */
export interface ContentDesignerFormPresentation {
  readonly newPageTitle: string;
  readonly pageNameLabel: string;
  readonly pageNameHelp: string;
  readonly createdMessage: string;
  readonly continueLabel: string;
  readonly knownSavedMessage: string;
  readonly changedAfterCreationMessage: string;
  readonly publicationUnconfirmedMessage: string;
}

function parseFormPresentation(
  value: unknown,
): ContentDesignerFormPresentation | undefined {
  if (value === undefined) return undefined;
  const source = asRecord(value, 'CMS Designer form presentation');
  const copy = (key: keyof ContentDesignerFormPresentation): string => {
    const text = source[key];
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 1024 ||
      [...text].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      throw new Error('CMS Designer form presentation is invalid');
    return text;
  };
  return Object.freeze({
    newPageTitle: copy('newPageTitle'),
    pageNameLabel: copy('pageNameLabel'),
    pageNameHelp: copy('pageNameHelp'),
    createdMessage: copy('createdMessage'),
    continueLabel: copy('continueLabel'),
    knownSavedMessage: copy('knownSavedMessage'),
    changedAfterCreationMessage: copy('changedAfterCreationMessage'),
    publicationUnconfirmedMessage: copy('publicationUnconfirmedMessage'),
  });
}

/** Existing CMS retirement commands, not generic CRUD or permission identifiers. */
export type ContentDesignerRetirementOperation =
  | 'deleteSection'
  | 'deleteComponent'
  | 'detachMedia';

/** Owner-provided inert review copy for the three supported retirement commands. */
export interface ContentDesignerRetirementPresentation {
  readonly title: string;
  readonly targetLabel: string;
  readonly codeLabel: string;
  readonly catalogLabel: string;
  readonly siteLabel: string;
  readonly enterpriseLabel: string;
  readonly reviewLabel: string;
  readonly reviewTitle: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly acknowledgeLabel: string;
  readonly inspectionLabel: string;
  readonly uncertainMessage: string;
  readonly successMessage: string;
  readonly changedMessage: string;
  readonly historyMessage: string;
  readonly actions: readonly Readonly<{
    operation: ContentDesignerRetirementOperation;
    label: string;
    consequence: string;
  }>[];
}

/** Exact owner command scope; neither record identities nor tenant scope are inferred from labels. */
export interface ContentDesignerRetirementIntent {
  readonly code: string;
  readonly siteCode: string;
  readonly catalogCode: string;
}

const retirementPaths = Object.freeze({
  deleteSection: '/designer/composition/sections/delete',
  deleteComponent: '/designer/composition/components/delete',
  detachMedia: '/designer/composition/media/delete',
});

/** Accepts only known transport commands and bounded owner copy, never executable owner paths. */
function parseRetirementPresentation(
  value: unknown,
): ContentDesignerRetirementPresentation | undefined {
  if (value === undefined) return undefined;
  const source = asRecord(value, 'CMS retirement presentation');
  const copy = (key: string): string => {
    const text = source[key];
    if (typeof text !== 'string' || !text.trim() || text.length > 1_024) {
      throw new Error('CMS retirement presentation is invalid');
    }
    return text;
  };
  if (!Array.isArray(source.actions) || source.actions.length > 3) {
    throw new Error('CMS retirement actions are invalid');
  }
  const seen = new Set<string>();
  const actions = source.actions.map((value) => {
    const item = asRecord(value, 'CMS retirement action');
    if (
      typeof item.operation !== 'string' ||
      !Object.hasOwn(retirementPaths, item.operation) ||
      seen.has(item.operation) ||
      typeof item.label !== 'string' ||
      !item.label.trim() ||
      item.label.length > 192 ||
      typeof item.consequence !== 'string' ||
      !item.consequence.trim() ||
      item.consequence.length > 1_024
    ) {
      throw new Error('CMS retirement action is invalid');
    }
    seen.add(item.operation);
    return Object.freeze({
      operation: item.operation as ContentDesignerRetirementOperation,
      label: item.label,
      consequence: item.consequence,
    });
  });
  return Object.freeze({
    title: copy('title'),
    targetLabel: copy('targetLabel'),
    codeLabel: copy('codeLabel'),
    catalogLabel: copy('catalogLabel'),
    siteLabel: copy('siteLabel'),
    enterpriseLabel: copy('enterpriseLabel'),
    reviewLabel: copy('reviewLabel'),
    reviewTitle: copy('reviewTitle'),
    confirmLabel: copy('confirmLabel'),
    cancelLabel: copy('cancelLabel'),
    acknowledgeLabel: copy('acknowledgeLabel'),
    inspectionLabel: copy('inspectionLabel'),
    uncertainMessage: copy('uncertainMessage'),
    successMessage: copy('successMessage'),
    changedMessage: copy('changedMessage'),
    historyMessage: copy('historyMessage'),
    actions: Object.freeze(actions),
  });
}

export interface ContentDesignerOperationResult {
  readonly publication?:
    | Readonly<{ code: string; workflowRef?: string | undefined }>
    | undefined;
  readonly evidence?: unknown;
  readonly saved?: unknown;
  readonly status?: string | undefined;
  readonly valid?: boolean | undefined;
}

export class ContentDesignerRequestError extends AxisApiError {
  readonly status: number;
  readonly ownerCode: string | undefined;

  constructor(
    status: number,
    message: string | AxisLocalizedErrorContract,
    ownerCode?: string,
  ) {
    super(typeof message === 'string' ? { message } : message);
    this.name = 'ContentDesignerRequestError';
    this.status = status;
    this.ownerCode = ownerCode;
  }
}

function cmsEndpoint(connection: AxisModuleConnection, path: string): URL {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('CMS module endpoint is invalid');
  }
  return new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`);
}

async function responseError(response: Response): Promise<Error> {
  const error = await parseAxisApiError(
    response,
    'The content request could not be confirmed. Inspect the saved state before another change.',
  );
  return new ContentDesignerRequestError(response.status, error, error.code);
}

/** Rejects owner failure envelopes even when transport succeeded; writes are never replayed. */
function envelopeResult(value: unknown): unknown {
  const source = asRecord(value, 'CMS Designer response envelope');
  if (
    source.error ||
    (source.success !== undefined && source.success !== true) ||
    (source.acknowledged !== undefined && source.acknowledged !== true) ||
    (source.errors !== undefined &&
      source.errors !== null &&
      (!Array.isArray(source.errors) || source.errors.length > 0)) ||
    (source.code !== undefined &&
      (typeof source.code !== 'string' || !source.code.startsWith('SUC_')))
  ) {
    throw new Error('CMS Designer returned an unsuccessful response envelope');
  }
  if ('result' in source) return source.result;
  throw new Error('CMS Designer response does not contain result data');
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Object.freeze(value.map(String).filter(Boolean));
}

function numericValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseReferenceArray(value: unknown): readonly ContentDesignerReference[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((item): readonly ContentDesignerReference[] => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }
      const source = item as Record<string, unknown>;
      if (typeof source.code !== 'string') return [];
      return [
        Object.freeze({
          access: typeof source.access === 'string' ? source.access : undefined,
          allowedComponentTypeGroups: stringArray(source.allowedComponentTypeGroups),
          allowedComponentTypes: stringArray(source.allowedComponentTypes),
          catalogCode:
            typeof source.catalogCode === 'string' ? source.catalogCode : undefined,
          catalogType:
            typeof source.catalogType === 'string' ? source.catalogType : undefined,
          code: source.code,
          componentTypeCodes: stringArray(source.componentTypeCodes),
          height: numericValue(source.height),
          kind: typeof source.kind === 'string' ? source.kind : undefined,
          maxItems: numericValue(source.maxItems),
          minItems: numericValue(source.minItems),
          name: typeof source.name === 'string' ? source.name : source.code,
          nodeType: typeof source.nodeType === 'string' ? source.nodeType : undefined,
          parentCode:
            typeof source.parentCode === 'string' ? source.parentCode : undefined,
          propertySchema:
            typeof source.propertySchema === 'object' &&
            source.propertySchema !== null &&
            !Array.isArray(source.propertySchema)
              ? (source.propertySchema as Readonly<Record<string, unknown>>)
              : undefined,
          renderer: typeof source.renderer === 'string' ? source.renderer : undefined,
          reusable: typeof source.reusable === 'boolean' ? source.reusable : undefined,
          siteCode: typeof source.siteCode === 'string' ? source.siteCode : undefined,
          templateCode:
            typeof source.templateCode === 'string' ? source.templateCode : undefined,
          typeCode: typeof source.typeCode === 'string' ? source.typeCode : undefined,
          width: numericValue(source.width),
        }),
      ];
    }),
  );
}

function parseAuthoringMetadata(value: unknown): ContentDesignerAuthoringMetadata {
  const source =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const publicationReadiness =
    typeof source.publicationReadiness === 'object' &&
    source.publicationReadiness !== null &&
    !Array.isArray(source.publicationReadiness)
      ? (source.publicationReadiness as Record<string, unknown>)
      : {};
  const localization =
    typeof source.localization === 'object' &&
    source.localization !== null &&
    !Array.isArray(source.localization)
      ? (source.localization as Record<string, unknown>)
      : {};
  if (
    localization.routeLocale !== undefined &&
    (typeof localization.routeLocale !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,34}$/.test(localization.routeLocale))
  )
    throw new Error('CMS route locale is incompatible');
  return Object.freeze({
    componentTypeGroups: parseReferenceArray(source.componentTypeGroups),
    componentTypes: parseReferenceArray(source.componentTypes),
    contentCatalogs: parseReferenceArray(source.contentCatalogs),
    mediaFolders: parseReferenceArray(source.mediaFolders),
    mediaFormats: parseReferenceArray(source.mediaFormats),
    mediaTypes: Array.isArray(source.mediaTypes)
      ? Object.freeze(source.mediaTypes.map(String).filter(Boolean))
      : Object.freeze([]),
    localization: Object.freeze({
      ...(typeof localization.routeLocale === 'string' &&
      /^[A-Za-z][A-Za-z0-9_-]{0,34}$/.test(localization.routeLocale)
        ? { routeLocale: localization.routeLocale }
        : {}),
      defaultLocale:
        typeof localization.defaultLocale === 'string'
          ? localization.defaultLocale
          : 'en',
      fallbackLocales: stringArray(localization.fallbackLocales) ?? Object.freeze([]),
      supportedLocales:
        stringArray(localization.supportedLocales) ?? Object.freeze(['en']),
    }),
    navigationNodes: parseReferenceArray(source.navigationNodes),
    pageTemplates: parseReferenceArray(source.pageTemplates),
    pageTypes: parseReferenceArray(source.pageTypes),
    publicationReadiness: Object.freeze({
      requiredDraftParts: Array.isArray(publicationReadiness.requiredDraftParts)
        ? Object.freeze(
            publicationReadiness.requiredDraftParts.map(String).filter(Boolean),
          )
        : Object.freeze([]),
      requireNavigationForPublish:
        publicationReadiness.requireNavigationForPublish === true,
    }),
    sites: parseReferenceArray(source.sites),
    slotDefinitions: parseReferenceArray(source.slotDefinitions),
  });
}

/** Accepts inert bounded content controls only; no paths, expressions or executable widgets. */
function parseContentFields(
  value: unknown,
  nested = false,
): readonly ContentDesignerContentField[] {
  if (!Array.isArray(value) || value.length > 16)
    throw new Error('CMS content fields are incompatible');
  const names = new Set<string>();
  return Object.freeze(
    value.map((entry) => {
      const field = asRecord(entry, 'CMS content field');
      const property = field.property;
      if (
        typeof property !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(property) ||
        ['constructor', 'prototype', '__proto__'].includes(property) ||
        names.has(property) ||
        typeof field.label !== 'string' ||
        !field.label.trim() ||
        field.label.length > 160 ||
        !['text', 'multiline', 'items'].includes(String(field.control)) ||
        (nested && field.control === 'items') ||
        (field.required !== undefined && typeof field.required !== 'boolean') ||
        (field.maxLength !== undefined &&
          (!Number.isSafeInteger(field.maxLength) ||
            Number(field.maxLength) < 1 ||
            Number(field.maxLength) > 100_000)) ||
        (field.maximumItems !== undefined &&
          (!Number.isSafeInteger(field.maximumItems) ||
            Number(field.maximumItems) < 1 ||
            Number(field.maximumItems) > 32)) ||
        (field.itemLabel !== undefined &&
          (typeof field.itemLabel !== 'string' ||
            !field.itemLabel.trim() ||
            field.itemLabel.length > 80))
      ) {
        throw new Error('CMS content fields are incompatible');
      }
      names.add(property);
      const itemFields =
        field.control === 'items'
          ? parseContentFields(field.itemFields, true)
          : undefined;
      if (itemFields?.length === 0)
        throw new Error('CMS content fields are incompatible');
      return Object.freeze({
        property,
        label: field.label,
        ...(typeof field.labelKey === 'string' &&
        /^[a-z][a-z0-9.-]{1,239}$/.test(field.labelKey)
          ? { labelKey: field.labelKey }
          : {}),
        ...(typeof field.itemLabelKey === 'string' &&
        /^[a-z][a-z0-9.-]{1,239}$/.test(field.itemLabelKey)
          ? { itemLabelKey: field.itemLabelKey }
          : {}),
        control: field.control as ContentDesignerContentField['control'],
        ...(typeof field.required === 'boolean' ? { required: field.required } : {}),
        ...(typeof field.maxLength === 'number' ? { maxLength: field.maxLength } : {}),
        ...(typeof field.maximumItems === 'number'
          ? { maximumItems: field.maximumItems }
          : {}),
        ...(typeof field.itemLabel === 'string' ? { itemLabel: field.itemLabel } : {}),
        ...(itemFields ? { itemFields } : {}),
      });
    }),
  );
}

function parseAuthoringModel(value: unknown): ContentDesignerAuthoringModel {
  const source = asRecord(value, 'CMS Designer authoring model');
  const rules = asRecord(source.rules, 'CMS Designer rules');
  if (
    source.operations !== undefined &&
    (!Array.isArray(source.operations) ||
      source.operations.length > 100 ||
      source.operations.some(
        (operation) => typeof operation !== 'string' || !operation.trim(),
      ))
  ) {
    throw new Error('CMS Designer permitted operations are invalid');
  }
  const defaults =
    typeof source.defaults === 'object' &&
    source.defaults !== null &&
    !Array.isArray(source.defaults)
      ? (source.defaults as Record<string, unknown>)
      : {};
  const draftDefaults =
    typeof defaults.draftDefaults === 'object' &&
    defaults.draftDefaults !== null &&
    !Array.isArray(defaults.draftDefaults)
      ? (defaults.draftDefaults as Record<string, unknown>)
      : {};
  return Object.freeze({
    presentation: parseFormPresentation(source.presentation),
    defaults: Object.freeze({
      nesting: parseNesting(defaults.nesting),
      componentKinds: Object.freeze(
        Array.isArray(defaults.componentKinds)
          ? defaults.componentKinds.flatMap(
              (item): readonly ContentDesignerComponentKind[] => {
                if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                  return [];
                }
                const candidate = item as Record<string, unknown>;
                if (
                  typeof candidate.label !== 'string' ||
                  typeof candidate.renderer !== 'string' ||
                  typeof candidate.typeCode !== 'string'
                ) {
                  return [];
                }
                return [
                  Object.freeze({
                    compatibleRenderers:
                      Array.isArray(candidate.compatibleRenderers) &&
                      candidate.compatibleRenderers.every(
                        (value) =>
                          typeof value === 'string' &&
                          /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value),
                      )
                        ? (candidate.compatibleRenderers as string[])
                        : undefined,
                    label: candidate.label,
                    renderer: candidate.renderer,
                    typeCode: candidate.typeCode,
                    ...(candidate.fields !== undefined
                      ? { fields: parseContentFields(candidate.fields) }
                      : {}),
                  }),
                ];
              },
            )
          : [],
      ),
      draftDefaults: Object.freeze({
        accessMode:
          typeof draftDefaults.accessMode === 'string'
            ? draftDefaults.accessMode
            : undefined,
        catalogCode:
          typeof draftDefaults.catalogCode === 'string'
            ? draftDefaults.catalogCode
            : undefined,
        pageRenderer:
          typeof draftDefaults.pageRenderer === 'string'
            ? draftDefaults.pageRenderer
            : undefined,
        pageTypeCode:
          typeof draftDefaults.pageTypeCode === 'string'
            ? draftDefaults.pageTypeCode
            : undefined,
        routePath:
          typeof draftDefaults.routePath === 'string'
            ? draftDefaults.routePath
            : undefined,
        siteCode:
          typeof draftDefaults.siteCode === 'string'
            ? draftDefaults.siteCode
            : undefined,
        slots: Array.isArray(draftDefaults.slots)
          ? Object.freeze(draftDefaults.slots.map(String).filter(Boolean))
          : undefined,
        templateCode:
          typeof draftDefaults.templateCode === 'string'
            ? draftDefaults.templateCode
            : undefined,
      }),
      maximumReferenceLookupItems:
        typeof defaults.maximumReferenceLookupItems === 'number'
          ? defaults.maximumReferenceLookupItems
          : undefined,
      requireNavigationForPublish: defaults.requireNavigationForPublish === true,
    }),
    hierarchy: Object.freeze(
      Array.isArray(source.hierarchy) ? source.hierarchy.map(String) : [],
    ),
    metadata: parseAuthoringMetadata(source.metadata),
    retirement: parseRetirementPresentation(source.retirement),
    operations: Object.freeze(
      Array.isArray(source.operations) ? (source.operations as string[]) : [],
    ),
    rules: Object.freeze({
      arbitrarySlots: rules.arbitrarySlots === true,
      catalogFirst: rules.catalogFirst === true,
      frontendPersistence: rules.frontendPersistence === true,
      pixelPerfectRendering: rules.pixelPerfectRendering === true,
    }),
  });
}

function parseOperationResult(value: unknown): ContentDesignerOperationResult {
  const source = asRecord(value, 'CMS Designer operation result');
  const publication =
    source.publication === undefined
      ? undefined
      : asRecord(source.publication, 'CMS publication');
  if (
    publication &&
    (typeof publication.code !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,511}$/.test(publication.code) ||
      (publication.workflowRef !== undefined &&
        (typeof publication.workflowRef !== 'string' ||
          !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(publication.workflowRef))))
  )
    throw new Error('CMS publication reference is incompatible');
  return Object.freeze({
    ...(publication
      ? {
          publication: Object.freeze({
            code: publication.code as string,
            ...(typeof publication.workflowRef === 'string'
              ? { workflowRef: publication.workflowRef }
              : {}),
          }),
        }
      : {}),
    evidence: source.evidence,
    saved: source.saved,
    status: typeof source.status === 'string' ? source.status : undefined,
    valid: typeof source.valid === 'boolean' ? source.valid : undefined,
  });
}

async function designerRequest(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  path: string,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(cmsEndpoint(connection, path), {
      ...options,
      cache: 'no-store',
      credentials: 'omit',
      headers: new Headers({
        Accept: 'application/json',
        Authorization: `Bearer ${configuration.accessToken}`,
        'Content-Type': 'application/json',
        'x-enterprise-code': configuration.enterpriseCode,
      }),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw await responseError(response);
    return envelopeResult(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('CMS Designer request timed out');
    throw error instanceof Error ? error : new Error('CMS Designer request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function draftMediaRequest(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  path: string,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(cmsEndpoint(connection, path), {
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${configuration.accessToken}`,
      'x-enterprise-code': configuration.enterpriseCode,
    },
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(configuration.timeoutMs)]),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'You do not have access to Staged images.'
        : 'Staged Media could not load the requested images.',
    );
  }
  return response;
}

/** Loads a bounded raster through the Staged Media owner's authenticated route. */
export async function loadContentDesignerDraftImage(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  mediaCode: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await draftMediaRequest(
    connection,
    configuration,
    '/library/' + encodeURIComponent(mediaCode) + '/draft-image',
    signal,
  );
  const type = response.headers.get('Content-Type')?.split(';')[0]?.trim();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type ?? '')) {
    throw new Error('This attachment is not available as an image preview.');
  }
  return response.blob();
}

/** Lists path-free, ready choices owned by the Staged Media library. */
export async function listContentDesignerDraftImages(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  page: number,
  signal: AbortSignal,
): Promise<{ items: readonly { code: string; fileName: string }[]; hasMore: boolean }> {
  const response = await draftMediaRequest(
    connection,
    configuration,
    '/library/draft-images?pageNumber=' + String(page),
    signal,
  );
  const envelope = asRecord(await response.json(), 'Staged Media response');
  const value = asRecord(envelope.data, 'Staged Media choices');
  if (
    envelope.code !== 'SUC_MED_00032' ||
    !Array.isArray(value.items) ||
    typeof value.hasMore !== 'boolean' ||
    !value.items.every(
      (item: unknown) =>
        item &&
        typeof item === 'object' &&
        'code' in item &&
        'fileName' in item &&
        typeof item.code === 'string' &&
        typeof item.fileName === 'string',
    )
  ) {
    throw new Error('Staged Media returned an invalid list of images.');
  }
  return { items: value.items, hasMore: value.hasMore };
}

/** Loads the CMS-owned model only; failure never falls back to generic schema discovery. */
export async function loadContentDesignerAuthoringModel(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerAuthoringModel> {
  return parseAuthoringModel(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/model',
      { method: 'GET' },
      fetchImplementation,
    ),
  );
}

export interface DocumentationDraftModel {
  readonly siteCode: string;
  readonly catalogCode: string;
  readonly rootPath: string;
  readonly templateCode: string;
  readonly typeCode: string;
  readonly renderer: string;
  readonly articleTypeCode: string;
  readonly navigationTypeCode: string;
  readonly accessMode: string;
  readonly locale: string;
}

/** Resolves the selected documentation Site's admitted article model from CMS. */
export async function loadDocumentationDraftModel(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  scope: { readonly siteCode: string; readonly catalogCode: string },
  fetchImplementation: typeof fetch = fetch,
): Promise<DocumentationDraftModel> {
  const row = asRecord(
    await designerRequest(
      connection,
      configuration,
      `/designer/composition/documentation-model?${new URLSearchParams(scope)}`,
      { method: 'GET' },
      fetchImplementation,
    ),
    'CMS documentation draft model',
  );
  const read = (key: string): string => {
    const value = row[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 512)
      throw new Error('CMS documentation draft model is invalid');
    return value;
  };
  const model = {
    siteCode: read('siteCode'),
    catalogCode: read('catalogCode'),
    rootPath: read('rootPath'),
    templateCode: read('templateCode'),
    typeCode: read('typeCode'),
    renderer: read('renderer'),
    articleTypeCode: read('articleTypeCode'),
    navigationTypeCode: read('navigationTypeCode'),
    accessMode: read('accessMode'),
    locale: read('locale'),
  };
  if (
    model.siteCode !== scope.siteCode ||
    model.catalogCode !== scope.catalogCode ||
    !/^\/docs\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(model.rootPath) ||
    model.renderer !== 'documentation.page.article' ||
    !['PUBLIC', 'AUTHENTICATED'].includes(model.accessMode)
  )
    throw new Error('CMS documentation draft scope is invalid');
  return model;
}

/** Validates a draft through its CMS command with the original enterprise context. */
export async function validateContentDesignerDraft(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  draft: ContentDesignerDraft,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerOperationResult> {
  return parseOperationResult(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/validate',
      { method: 'POST', body: JSON.stringify(draft) },
      fetchImplementation,
    ),
  );
}

/** Sends one CMS draft write; ambiguous or unsuccessful responses reject without replay. */
export async function saveContentDesignerDraft(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  draft: ContentDesignerDraft,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerOperationResult> {
  return parseOperationResult(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/draft',
      { method: 'PUT', body: JSON.stringify(draft) },
      fetchImplementation,
    ),
  );
}

/** Requests normal CMS publication governance without granting approval authority. */
export async function submitContentDesignerDraftForPublication(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  draft: ContentDesignerDraft,
  fetchImplementation: typeof fetch = fetch,
): Promise<ContentDesignerOperationResult> {
  return parseOperationResult(
    await designerRequest(
      connection,
      configuration,
      '/designer/composition/publication-request',
      { method: 'POST', body: JSON.stringify(draft) },
      fetchImplementation,
    ),
  );
}

/** Sends one existing owner retirement command and requires matching inactive version evidence; never retries. */
export async function retireContentDesignerRecord(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  operation: ContentDesignerRetirementOperation,
  intent: ContentDesignerRetirementIntent,
  fetchImplementation: typeof fetch = fetch,
): Promise<Readonly<{ code: string; versionId: number }>> {
  if (
    !Object.hasOwn(retirementPaths, operation) ||
    ![intent.code, intent.siteCode, intent.catalogCode].every((value) =>
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value),
    )
  ) {
    throw new Error('CMS retirement selection is invalid');
  }
  const result = asRecord(
    await designerRequest(
      connection,
      configuration,
      retirementPaths[operation],
      { method: 'POST', body: JSON.stringify(intent) },
      fetchImplementation,
    ),
    'CMS retirement result',
  );
  const scope = asRecord(result.authoringScope, 'CMS retirement scope');
  if (
    result.code !== intent.code ||
    result.active !== false ||
    typeof result.versionId !== 'number' ||
    !Number.isSafeInteger(result.versionId) ||
    result.versionId < 0 ||
    scope.enterpriseCode !== configuration.enterpriseCode ||
    scope.catalogCode !== intent.catalogCode ||
    (operation === 'deleteSection' &&
      scope.siteCode !== undefined &&
      scope.siteCode !== intent.siteCode)
  ) {
    throw new Error(
      'CMS retirement result is uncertain; inspect the owner record before another submission',
    );
  }
  return Object.freeze({ code: result.code, versionId: result.versionId });
}

/** Missing nesting metadata leaves nested creation unavailable; malformed limits fail closed. */
function parseNesting(
  value: unknown,
): ContentDesignerAuthoringModel['defaults']['nesting'] {
  if (value === undefined) return undefined;
  const data = asRecord(value, 'CMS nesting contract');
  if (
    !Number.isSafeInteger(data.maximumDepth) ||
    Number(data.maximumDepth) < 1 ||
    Number(data.maximumDepth) > 12 ||
    !Number.isSafeInteger(data.maximumComponents) ||
    Number(data.maximumComponents) < 1 ||
    Number(data.maximumComponents) > 100 ||
    typeof data.defaultSlot !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(data.defaultSlot)
  )
    throw new Error('CMS nesting contract is invalid');
  return {
    maximumDepth: Number(data.maximumDepth),
    maximumComponents: Number(data.maximumComponents),
    defaultSlot: data.defaultSlot,
  };
}
