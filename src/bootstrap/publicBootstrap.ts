export interface AxisPublicBootstrap {
  readonly contractVersion: number;
  readonly clientContractVersion: number;
  readonly endpoints: {
    readonly profile: string;
    readonly cms: string;
    readonly localization?: string | undefined;
  };
  readonly uiComposition: {
    readonly site: string;
    readonly catalog: string;
    readonly defaultPublicPage: string;
    readonly defaultAuthenticatedPage: string;
    readonly locale: string;
    readonly supportedLocales: readonly string[];
    readonly fallbackLocales: readonly string[];
    readonly channel: string;
    readonly fallbackMode: 'STATIC_RECOVERY_SHELL';
  };
}

export interface AxisEmployeePolicy {
  readonly contractVersion: number;
  readonly screenLockEnabled: boolean;
  readonly idleTimeoutSeconds: number;
  readonly recentNavigationLimit: number;
  readonly revision: number;
  readonly source: 'DEFAULT' | 'PERSISTED';
}

export type AxisModuleAvailability = 'UP' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
export type AxisNavigationFeatureState = 'ACTIVE' | 'PREVIEW' | 'DISABLED' | 'HIDDEN';

export interface AxisNavigationGroup {
  readonly id: string;
  readonly label: string;
  readonly labelKey?: string | undefined;
  readonly order: number;
}

export interface AxisNavigationBadgeProvider {
  readonly moduleName: string;
  readonly operationId: string;
}

export interface AxisWorkbenchTarget {
  readonly moduleName: string;
  readonly schemaName: string;
  readonly mode?: 'create' | undefined;
  readonly governanceService?: string | undefined;
  readonly authoringModelRoute?: string | undefined;
  readonly validationRoute?: string | undefined;
  readonly renderProjectionRoute?: string | undefined;
  readonly searchRoute?: string | undefined;
  readonly publicationHandoffRoute?: string | undefined;
  readonly migrationPlanRoute?: string | undefined;
}

export interface AxisWorkbenchPresentationQuickFilter {
  readonly id: string;
  readonly label: string;
  readonly field: string;
  readonly value?: string | undefined;
  readonly values?: readonly string[] | undefined;
  readonly order: number;
}

export interface AxisWorkbenchPresentationRecoveryAction {
  readonly id: string;
  readonly label: string;
  readonly ownerModule: string;
  readonly strategy: string;
  readonly handlerAction: string;
  readonly summary?: string | undefined;
  readonly order: number;
}

export interface AxisWorkbenchPresentation {
  readonly defaultColumns?: readonly string[] | undefined;
  readonly hiddenFields?: readonly string[] | undefined;
  readonly editableFields?: readonly string[] | undefined;
  readonly readonlyFields?: readonly string[] | undefined;
  readonly forbiddenFields?: readonly string[] | undefined;
  readonly quickFilters?: readonly AxisWorkbenchPresentationQuickFilter[] | undefined;
  readonly fixedFilters?: readonly AxisWorkbenchPresentationQuickFilter[] | undefined;
  readonly recoveryActions?:
    | readonly AxisWorkbenchPresentationRecoveryAction[]
    | undefined;
}

export interface AxisNavigationDetailPanelRelation {
  readonly sourceField: string;
  readonly targetField: string;
  readonly cardinality?: 'ONE' | 'MANY' | undefined;
}

export interface AxisNavigationDetailPanel {
  readonly id: string;
  readonly label: string;
  readonly summary?: string | undefined;
  readonly order: number;
  readonly target: AxisWorkbenchTarget;
  readonly relation?: AxisNavigationDetailPanelRelation | undefined;
}

export interface AxisNavigationLifecycleAction {
  readonly id: string;
  readonly label: string;
  readonly intent:
    | 'CREATE'
    | 'UPDATE'
    | 'APPROVE'
    | 'REJECT'
    | 'RETRY'
    | 'CANCEL'
    | 'SUBMIT'
    | 'EXECUTE'
    | 'PUBLISH'
    | 'REPAIR'
    | 'RECONCILE'
    | 'EXPORT'
    | 'VALIDATE'
    | 'TEST'
    | 'ACTIVATE'
    | 'ROTATE_CONNECTOR'
    | 'OTHER';
  readonly permission?: string | undefined;
  readonly ownerModule?: string | undefined;
  readonly handlerAction?: string | undefined;
  readonly summary?: string | undefined;
  readonly operationRoute?: string | undefined;
  readonly httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | undefined;
  readonly inputFields?: readonly AxisNavigationLifecycleActionInputField[] | undefined;
  readonly targetStatuses?: readonly string[] | undefined;
  readonly featureState?: AxisNavigationFeatureState | undefined;
  readonly order: number;
}

export interface AxisNavigationLifecycleActionInputField {
  readonly name: string;
  readonly label: string;
  readonly type: 'TEXT' | 'MULTILINE' | 'SELECT' | 'JSON' | 'HIDDEN';
  readonly required: boolean;
  readonly options?: readonly string[] | undefined;
  readonly valueFromRecord?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly maximumLength: number;
}

export interface AxisNavigationHelp {
  readonly summary: string;
  readonly documentationRoute?: string | undefined;
  readonly documentationFragment?: string | undefined;
}

export interface AxisNavigationSourceTrace {
  readonly sourceType: string;
  readonly ownerModule: string;
  readonly stableIdentity: string;
  readonly overrideApplied: boolean;
  readonly editable: boolean;
  readonly lifecycleState: string;
}

export interface AxisNavigationRouteOwner {
  readonly ownerType: string;
  readonly ownerModule: string;
}

export interface AxisNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly order: number;
  readonly moduleName: string;
  readonly category: string;
  readonly icon: string;
  readonly availability: AxisModuleAvailability;
  readonly labelKey?: string | undefined;
  readonly parentId?: string | undefined;
  readonly parentModuleName?: string | undefined;
  readonly group?: AxisNavigationGroup | undefined;
  readonly perspectives?: readonly string[] | undefined;
  readonly contexts?: readonly string[] | undefined;
  readonly featureState?: AxisNavigationFeatureState | undefined;
  readonly badgeProvider?: AxisNavigationBadgeProvider | undefined;
  readonly workbenchTarget?: AxisWorkbenchTarget | undefined;
  readonly workbenchPresentation?: AxisWorkbenchPresentation | undefined;
  readonly detailPanels?: readonly AxisNavigationDetailPanel[] | undefined;
  readonly lifecycleActions?: readonly AxisNavigationLifecycleAction[] | undefined;
  readonly help?: AxisNavigationHelp | undefined;
  readonly sourceTrace?: AxisNavigationSourceTrace | undefined;
  readonly routeOwner?: AxisNavigationRouteOwner | undefined;
}

export interface AxisEffectiveNavigationComposition {
  readonly contractVersion: number;
  readonly version: number;
  readonly checksum: string;
  readonly lifecycleState: string;
  readonly source: string;
  readonly fallbackActive: boolean;
  readonly fallbackReason?: string | undefined;
  readonly authoring?: Readonly<Record<string, unknown>> | undefined;
  readonly navigation: readonly AxisNavigationItem[];
  readonly warnings: readonly Readonly<Record<string, unknown>>[];
  readonly generatedAt: string;
}

export interface AxisModuleCatalogEntry {
  readonly moduleName: string;
  readonly displayName?: string | undefined;
  readonly parentModule?: string | undefined;
  readonly canonicalIdentity?: string | undefined;
  readonly moduleKind?: string | undefined;
}

export interface AxisModuleConnection {
  readonly moduleName: string;
  readonly instanceId: string;
  readonly endpoint: string;
  readonly environment: string;
  readonly server?: string | undefined;
  readonly runtimeRole?:
    | Readonly<{
        readonly code: string;
        readonly publication: string;
      }>
    | undefined;
  readonly state: AxisModuleAvailability;
}

export interface AxisDocumentationCoverage {
  readonly score: number;
  readonly status: 'STRONG' | 'PARTIAL' | 'NEEDS_WORK' | 'REFERENCE';
  readonly signals: readonly string[];
  readonly gaps: readonly string[];
}

export interface AxisDocumentationDashboardMetadata {
  readonly summary?: string | undefined;
  readonly kind?: string | undefined;
  readonly icon?: string | undefined;
  readonly audiences: readonly string[];
  readonly coverage?: AxisDocumentationCoverage | undefined;
}

export interface AxisAuthenticatedBootstrap {
  readonly axisPolicy: AxisEmployeePolicy;
  readonly navigation: readonly AxisNavigationItem[];
  readonly effectiveNavigationComposition?:
    | AxisEffectiveNavigationComposition
    | undefined;
  readonly moduleCatalog: Readonly<Record<string, AxisModuleCatalogEntry>>;
  readonly environments: readonly string[];
  readonly moduleConnections: Readonly<Record<string, readonly AxisModuleConnection[]>>;
  readonly applicationInitializationProfiles?:
    | readonly AxisApplicationInitializationProfile[]
    | undefined;
  readonly documentationSources: readonly AxisDocumentationSource[];
  readonly tenantCode: string;
}

export interface AxisApplicationInitializationProfile {
  readonly code: string;
  readonly title: string;
  readonly kind: string;
  readonly category: string;
  readonly summary: string;
  readonly order: number;
  readonly type: string;
  readonly owner: string;
  readonly applicationCode: string;
  readonly siteCode: string;
  readonly baselineCode: string;
  readonly contentPackCode?: string | undefined;
  readonly requiredServers: readonly string[];
  readonly dataPackages: readonly Readonly<{
    readonly code: string;
    readonly kind: string;
    readonly required: boolean;
    readonly trigger: string;
  }>[];
  readonly activationPolicy: Readonly<{
    readonly approvalRequiredForOnline: boolean;
    readonly requiredDataTrigger: string;
    readonly sampleDataTrigger: string;
  }>;
}

export type AxisDocumentationSource =
  | {
      readonly id: string;
      readonly label: string;
      readonly type: 'CMS';
      readonly route: string;
      readonly order: number;
      readonly ownerModule: string;
      readonly connectionModule: string;
      readonly site: string;
      readonly catalog: string;
      readonly defaultPage: string;
      readonly packCode: string;
      readonly initializationProfile?: string | undefined;
      readonly labelKey?: string | undefined;
      readonly dashboard: AxisDocumentationDashboardMetadata;
    }
  | {
      readonly id: string;
      readonly label: string;
      readonly type: 'OPENAPI';
      readonly route: string;
      readonly order: number;
      readonly ownerModule: string;
      readonly connectionModule: string;
      readonly openApiPath: string;
      readonly swaggerPath: string;
      readonly labelKey?: string | undefined;
      readonly dashboard: AxisDocumentationDashboardMetadata;
    };

export function selectModuleConnection(
  bootstrap: AxisAuthenticatedBootstrap,
  moduleName: string,
  selector?: Readonly<{
    server?: string;
    environment?: string;
    publicationRole?: string;
    runtimeRoleCode?: string;
  }>,
): AxisModuleConnection | undefined {
  const connections = (bootstrap.moduleConnections[moduleName] ?? []).filter(
    (connection) =>
      (!selector?.server || connection.server === selector.server) &&
      (!selector?.environment || connection.environment === selector.environment) &&
      (!selector?.publicationRole ||
        connection.runtimeRole?.publication === selector.publicationRole) &&
      (!selector?.runtimeRoleCode ||
        connection.runtimeRole?.code === selector.runtimeRoleCode),
  );
  return (
    connections.find((connection) => connection.state === 'UP') ??
    connections.find((connection) => connection.state === 'DEGRADED')
  );
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function baseUrl(value: unknown, name: string): string {
  const parsed = new URL(text(value, name));
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`${name} must be a safe HTTP endpoint`);
  }
  return parsed.toString().replace(/\/$/, '');
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return Number(value);
}

function stringList(value: unknown, name: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.trim() === '')
  ) {
    throw new Error(`${name} must be a list of non-empty strings`);
  }
  return Object.freeze([...new Set(value as string[])]);
}

function object(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function array(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function relativeRoute(value: unknown, name: string): string {
  const route = text(value, name);
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('://')) {
    throw new Error(`${name} must be an application-relative route`);
  }
  return route;
}

function documentationRoute(value: unknown, name: string): string {
  const route = relativeRoute(value, name);
  if (route !== '/docs' && !route.startsWith('/docs/')) {
    throw new Error(`${name} must target Axis documentation`);
  }
  return route;
}

function availabilityState(value: unknown): AxisModuleAvailability {
  return ['UP', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN'].includes(String(value))
    ? (value as AxisModuleAvailability)
    : 'UNKNOWN';
}

function optionalText(value: unknown, name: string): string | undefined {
  return value === undefined ? undefined : text(value, name);
}

function safeModuleName(value: unknown, name: string): string {
  const parsed = text(value, name);
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(parsed)) {
    throw new Error(`${name} is unsafe`);
  }
  return parsed;
}

function navigationFeatureState(value: unknown): AxisNavigationFeatureState {
  if (value === undefined) return 'ACTIVE';
  if (
    typeof value !== 'string' ||
    !['ACTIVE', 'PREVIEW', 'DISABLED', 'HIDDEN'].includes(value)
  ) {
    throw new Error('BackOffice navigation feature state is unsupported');
  }
  return value as AxisNavigationFeatureState;
}

function navigationDisplayLabel(label: string): string {
  return label
    .replace(/\bAnd\b/g, '&')
    .replace(/\band\b/g, '&')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNavigationGroup(
  value: unknown,
  moduleName: string,
): AxisNavigationGroup | undefined {
  if (value === undefined) return undefined;
  const group = record(value, `${moduleName} navigation group`);
  return Object.freeze({
    id: text(group.id, `${moduleName} navigation group id`),
    label: navigationDisplayLabel(
      text(group.label, `${moduleName} navigation group label`),
    ),
    labelKey: optionalText(group.labelKey, `${moduleName} navigation group label key`),
    order: Number.isInteger(group.order) ? Number(group.order) : 0,
  });
}

function parseBadgeProvider(
  value: unknown,
  moduleName: string,
): AxisNavigationBadgeProvider | undefined {
  if (value === undefined) return undefined;
  const provider = record(value, `${moduleName} navigation badge provider`);
  return Object.freeze({
    moduleName: text(
      provider.moduleName,
      `${moduleName} navigation badge provider module`,
    ),
    operationId: text(
      provider.operationId,
      `${moduleName} navigation badge provider operation`,
    ),
  });
}

function parseWorkbenchTarget(
  value: unknown,
  moduleName: string,
): AxisWorkbenchTarget | undefined {
  if (value === undefined) return undefined;
  const target = record(value, `${moduleName} navigation workbench target`);
  const schemaName = text(
    target.schemaName,
    `${moduleName} navigation workbench target schema`,
  );
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(schemaName)) {
    throw new Error(`${moduleName} navigation workbench target schema is unsafe`);
  }
  const mode = optionalText(
    target.mode,
    `${moduleName} navigation workbench target mode`,
  );
  if (mode !== undefined && mode !== 'create') {
    throw new Error(`${moduleName} navigation workbench target mode is unsupported`);
  }
  const governanceService = optionalText(
    target.governanceService,
    `${moduleName} navigation documentation governance service`,
  );
  if (
    governanceService !== undefined &&
    !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(governanceService)
  ) {
    throw new Error(
      `${moduleName} navigation documentation governance service is unsafe`,
    );
  }
  const authoringModelRoute =
    target.authoringModelRoute === undefined
      ? undefined
      : relativeRoute(
          target.authoringModelRoute,
          `${moduleName} navigation documentation authoring model route`,
        );
  const validationRoute =
    target.validationRoute === undefined
      ? undefined
      : relativeRoute(
          target.validationRoute,
          `${moduleName} navigation documentation validation route`,
        );
  const renderProjectionRoute =
    target.renderProjectionRoute === undefined
      ? undefined
      : relativeRoute(
          target.renderProjectionRoute,
          `${moduleName} navigation documentation render projection route`,
        );
  const searchRoute =
    target.searchRoute === undefined
      ? undefined
      : relativeRoute(
          target.searchRoute,
          `${moduleName} navigation documentation search route`,
        );
  const publicationHandoffRoute =
    target.publicationHandoffRoute === undefined
      ? undefined
      : relativeRoute(
          target.publicationHandoffRoute,
          `${moduleName} navigation documentation publication handoff route`,
        );
  const migrationPlanRoute =
    target.migrationPlanRoute === undefined
      ? undefined
      : relativeRoute(
          target.migrationPlanRoute,
          `${moduleName} navigation documentation migration plan route`,
        );
  return Object.freeze({
    moduleName: text(
      target.moduleName,
      `${moduleName} navigation workbench target module`,
    ),
    schemaName,
    ...(mode === undefined ? {} : { mode }),
    ...(governanceService === undefined ? {} : { governanceService }),
    ...(authoringModelRoute === undefined ? {} : { authoringModelRoute }),
    ...(validationRoute === undefined ? {} : { validationRoute }),
    ...(renderProjectionRoute === undefined ? {} : { renderProjectionRoute }),
    ...(searchRoute === undefined ? {} : { searchRoute }),
    ...(publicationHandoffRoute === undefined ? {} : { publicationHandoffRoute }),
    ...(migrationPlanRoute === undefined ? {} : { migrationPlanRoute }),
  });
}

function parseNavigationDetailPanelRelation(
  value: unknown,
  moduleName: string,
): AxisNavigationDetailPanelRelation | undefined {
  if (value === undefined) return undefined;
  const relation = record(value, `${moduleName} navigation detail panel relation`);
  const cardinality = optionalText(
    relation.cardinality,
    `${moduleName} navigation detail panel relation cardinality`,
  );
  if (cardinality !== undefined && cardinality !== 'ONE' && cardinality !== 'MANY') {
    throw new Error(
      `${moduleName} navigation detail panel relation cardinality is unsupported`,
    );
  }
  return Object.freeze({
    sourceField: text(
      relation.sourceField,
      `${moduleName} navigation detail panel relation source field`,
    ),
    targetField: text(
      relation.targetField,
      `${moduleName} navigation detail panel relation target field`,
    ),
    ...(cardinality === undefined ? {} : { cardinality }),
  });
}

function parseNavigationDetailPanels(
  value: unknown,
  moduleName: string,
): readonly AxisNavigationDetailPanel[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 16) {
    throw new Error(`${moduleName} navigation detail panels must be a bounded list`);
  }
  const ids = new Set<string>();
  return Object.freeze(
    value
      .map((rawPanel, index) => {
        const panel = record(rawPanel, `${moduleName} navigation detail panel`);
        const id = text(panel.id, `${moduleName} navigation detail panel id`);
        if (ids.has(id)) {
          throw new Error(`${moduleName} navigation detail panels contain duplicates`);
        }
        ids.add(id);
        const summary = optionalText(
          panel.summary,
          `${moduleName} navigation detail panel summary`,
        );
        if (summary !== undefined && summary.length > 320) {
          throw new Error(`${moduleName} navigation detail panel summary is too long`);
        }
        return Object.freeze({
          id,
          label: text(panel.label, `${moduleName} navigation detail panel label`),
          ...(summary === undefined ? {} : { summary }),
          order: Number.isInteger(panel.order) ? Number(panel.order) : index,
          target: parseWorkbenchTarget(
            panel.target,
            `${moduleName} navigation detail panel`,
          ) as AxisWorkbenchTarget,
          relation: parseNavigationDetailPanelRelation(panel.relation, moduleName),
        });
      })
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function parseNavigationHelp(
  value: unknown,
  moduleName: string,
): AxisNavigationHelp | undefined {
  if (value === undefined) return undefined;
  const help = record(value, `${moduleName} navigation help`);
  const summary = text(help.summary, `${moduleName} navigation help summary`);
  if (summary.length > 320) {
    throw new Error(`${moduleName} navigation help summary is too long`);
  }
  const fragment = optionalText(
    help.documentationFragment,
    `${moduleName} navigation help documentation fragment`,
  );
  if (fragment !== undefined && !/^[A-Za-z0-9._:-]{1,128}$/.test(fragment)) {
    throw new Error(`${moduleName} navigation help documentation fragment is unsafe`);
  }
  return Object.freeze({
    summary,
    documentationRoute:
      help.documentationRoute === undefined
        ? undefined
        : documentationRoute(
            help.documentationRoute,
            `${moduleName} navigation help documentation route`,
          ),
    documentationFragment: fragment,
  });
}

function parseNavigationLifecycleActions(
  value: unknown,
  moduleName: string,
): readonly AxisNavigationLifecycleAction[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 12) {
    throw new Error(
      `${moduleName} navigation lifecycle actions must be a bounded list`,
    );
  }
  const seen = new Set<string>();
  return Object.freeze(
    value
      .map((rawAction, index) => {
        const action = record(rawAction, `${moduleName} navigation lifecycle action`);
        const id = text(action.id, `${moduleName} navigation lifecycle action id`);
        if (seen.has(id)) {
          throw new Error(
            `${moduleName} navigation lifecycle actions contain duplicates`,
          );
        }
        seen.add(id);
        const intent = text(
          action.intent,
          `${moduleName} navigation lifecycle action intent`,
        );
        const supportedIntents = [
          'CREATE',
          'UPDATE',
          'APPROVE',
          'REJECT',
          'RETRY',
          'CANCEL',
          'SUBMIT',
          'EXECUTE',
          'PUBLISH',
          'REPAIR',
          'RECONCILE',
          'EXPORT',
          'VALIDATE',
          'TEST',
          'ACTIVATE',
          'ROTATE_CONNECTOR',
          'OTHER',
        ];
        if (!supportedIntents.includes(intent)) {
          throw new Error(
            `${moduleName} navigation lifecycle action intent is unsupported`,
          );
        }
        const summary = optionalText(
          action.summary,
          `${moduleName} navigation lifecycle action summary`,
        );
        if (summary !== undefined && summary.length > 240) {
          throw new Error(
            `${moduleName} navigation lifecycle action summary is too long`,
          );
        }
        const httpMethod =
          action.httpMethod === undefined
            ? undefined
            : text(
                action.httpMethod,
                `${moduleName} navigation lifecycle action HTTP method`,
              ).toUpperCase();
        if (
          httpMethod !== undefined &&
          !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)
        ) {
          throw new Error(
            `${moduleName} navigation lifecycle action HTTP method is unsupported`,
          );
        }
        return Object.freeze({
          id,
          label: text(action.label, `${moduleName} navigation lifecycle action label`),
          intent: intent as AxisNavigationLifecycleAction['intent'],
          permission: optionalText(
            action.permission,
            `${moduleName} navigation lifecycle action permission`,
          ),
          ownerModule:
            action.ownerModule === undefined
              ? undefined
              : safeModuleName(
                  action.ownerModule,
                  `${moduleName} navigation lifecycle action owner module`,
                ),
          handlerAction: optionalText(
            action.handlerAction,
            `${moduleName} navigation lifecycle action handler`,
          ),
          summary,
          operationRoute:
            action.operationRoute === undefined
              ? undefined
              : relativeRoute(
                  action.operationRoute,
                  `${moduleName} navigation lifecycle action operation route`,
                ),
          httpMethod:
            httpMethod === undefined
              ? undefined
              : (httpMethod as AxisNavigationLifecycleAction['httpMethod']),
          inputFields:
            action.inputFields === undefined
              ? undefined
              : array(
                  action.inputFields,
                  `${moduleName} navigation lifecycle action input fields`,
                ).map((candidate, fieldIndex) => {
                  const field = object(
                    candidate,
                    `${moduleName} navigation lifecycle action input field`,
                  );
                  const fieldType = text(
                    field.type,
                    `${moduleName} navigation lifecycle action input field type`,
                  );
                  if (
                    !['TEXT', 'MULTILINE', 'SELECT', 'JSON', 'HIDDEN'].includes(
                      fieldType,
                    )
                  ) {
                    throw new Error(
                      `${moduleName} navigation lifecycle action input field type is unsupported`,
                    );
                  }
                  const options =
                    field.options === undefined
                      ? undefined
                      : stringList(
                          field.options,
                          `${moduleName} navigation lifecycle action input options`,
                        );
                  if (fieldType === 'SELECT' && (!options || options.length === 0)) {
                    throw new Error(
                      `${moduleName} navigation lifecycle SELECT input requires options`,
                    );
                  }
                  const fieldName = text(
                    field.name,
                    `${moduleName} navigation lifecycle action input name`,
                  );
                  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(fieldName)) {
                    throw new Error(
                      `${moduleName} navigation lifecycle action input name is unsafe`,
                    );
                  }
                  const maximumLength = Number.isInteger(field.maximumLength)
                    ? Number(field.maximumLength)
                    : fieldType === 'MULTILINE' || fieldType === 'JSON'
                      ? 2000
                      : 256;
                  if (maximumLength < 1 || maximumLength > 4000) {
                    throw new Error(
                      `${moduleName} navigation lifecycle action input maximum length is invalid`,
                    );
                  }
                  return Object.freeze({
                    name: fieldName,
                    label: text(
                      field.label,
                      `${moduleName} navigation lifecycle action input label`,
                    ),
                    type: fieldType as AxisNavigationLifecycleActionInputField['type'],
                    required: field.required === true,
                    options,
                    valueFromRecord: optionalText(
                      field.valueFromRecord,
                      `${moduleName} navigation lifecycle action input record field`,
                    ),
                    defaultValue: optionalText(
                      field.defaultValue,
                      `${moduleName} navigation lifecycle action input default`,
                    ),
                    maximumLength,
                    order: fieldIndex,
                  });
                }),
          targetStatuses:
            action.targetStatuses === undefined
              ? undefined
              : stringList(
                  action.targetStatuses,
                  `${moduleName} navigation lifecycle action target statuses`,
                ),
          featureState: navigationFeatureState(action.featureState),
          order: Number.isInteger(action.order) ? Number(action.order) : index,
        });
      })
      .sort((left, right) => left.order - right.order),
  );
}

function parseWorkbenchPresentation(
  value: unknown,
  moduleName: string,
): AxisWorkbenchPresentation | undefined {
  if (value === undefined) return undefined;
  const presentation = record(value, `${moduleName} workbench presentation`);
  const defaultColumns =
    presentation.defaultColumns === undefined
      ? undefined
      : stringList(
          presentation.defaultColumns,
          `${moduleName} workbench presentation default columns`,
        );
  const hiddenFields =
    presentation.hiddenFields === undefined
      ? undefined
      : stringList(
          presentation.hiddenFields,
          `${moduleName} workbench presentation hidden fields`,
        );
  const editableFields =
    presentation.editableFields === undefined
      ? undefined
      : stringList(
          presentation.editableFields,
          `${moduleName} workbench presentation editable fields`,
        );
  const readonlyFields =
    presentation.readonlyFields === undefined
      ? undefined
      : stringList(
          presentation.readonlyFields,
          `${moduleName} workbench presentation readonly fields`,
        );
  const forbiddenFields =
    presentation.forbiddenFields === undefined
      ? undefined
      : stringList(
          presentation.forbiddenFields,
          `${moduleName} workbench presentation forbidden fields`,
        );
  const quickFilters =
    presentation.quickFilters === undefined
      ? undefined
      : parseWorkbenchPresentationQuickFilters(presentation.quickFilters, moduleName);
  const fixedFilters =
    presentation.fixedFilters === undefined
      ? undefined
      : parseWorkbenchPresentationQuickFilters(presentation.fixedFilters, moduleName);
  const recoveryActions =
    presentation.recoveryActions === undefined
      ? undefined
      : parseWorkbenchPresentationRecoveryActions(
          presentation.recoveryActions,
          moduleName,
        );
  return Object.freeze({
    ...(defaultColumns === undefined ? {} : { defaultColumns }),
    ...(hiddenFields === undefined ? {} : { hiddenFields }),
    ...(editableFields === undefined ? {} : { editableFields }),
    ...(readonlyFields === undefined ? {} : { readonlyFields }),
    ...(forbiddenFields === undefined ? {} : { forbiddenFields }),
    ...(quickFilters === undefined ? {} : { quickFilters }),
    ...(fixedFilters === undefined ? {} : { fixedFilters }),
    ...(recoveryActions === undefined ? {} : { recoveryActions }),
  });
}

function parseWorkbenchPresentationQuickFilters(
  value: unknown,
  moduleName: string,
): readonly AxisWorkbenchPresentationQuickFilter[] {
  if (!Array.isArray(value) || value.length > 24) {
    throw new Error(`${moduleName} workbench quick filters must be a bounded list`);
  }
  const ids = new Set<string>();
  return Object.freeze(
    value
      .map((candidate, index) => {
        const filter = record(candidate, `${moduleName} workbench quick filter`);
        const id = text(filter.id, `${moduleName} workbench quick filter id`);
        if (ids.has(id)) {
          throw new Error(`${moduleName} workbench quick filters contain duplicates`);
        }
        ids.add(id);
        const value = optionalText(
          filter.value,
          `${moduleName} workbench quick filter value`,
        );
        const values =
          filter.values === undefined
            ? undefined
            : stringList(filter.values, `${moduleName} workbench quick filter values`);
        if (value === undefined && (values === undefined || values.length === 0)) {
          throw new Error(`${moduleName} workbench quick filter value is required`);
        }
        return Object.freeze({
          id,
          label: text(filter.label, `${moduleName} workbench quick filter label`),
          field: text(filter.field, `${moduleName} workbench quick filter field`),
          ...(value === undefined ? {} : { value }),
          ...(values === undefined ? {} : { values }),
          order: Number.isInteger(filter.order) ? Number(filter.order) : index,
        });
      })
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function parseWorkbenchPresentationRecoveryActions(
  value: unknown,
  moduleName: string,
): readonly AxisWorkbenchPresentationRecoveryAction[] {
  if (!Array.isArray(value) || value.length > 24) {
    throw new Error(`${moduleName} workbench recovery actions must be a bounded list`);
  }
  const ids = new Set<string>();
  return Object.freeze(
    value
      .map((candidate, index) => {
        const action = record(candidate, `${moduleName} workbench recovery action`);
        const id = text(action.id, `${moduleName} workbench recovery action id`);
        if (ids.has(id)) {
          throw new Error(
            `${moduleName} workbench recovery actions contain duplicates`,
          );
        }
        ids.add(id);
        const summary = optionalText(
          action.summary,
          `${moduleName} workbench recovery action summary`,
        );
        if (summary !== undefined && summary.length > 320) {
          throw new Error(
            `${moduleName} workbench recovery action summary is too long`,
          );
        }
        return Object.freeze({
          id,
          label: text(action.label, `${moduleName} workbench recovery action label`),
          ownerModule: text(
            action.ownerModule,
            `${moduleName} workbench recovery action owner module`,
          ),
          strategy: text(
            action.strategy,
            `${moduleName} workbench recovery action strategy`,
          ),
          handlerAction: text(
            action.handlerAction,
            `${moduleName} workbench recovery action handler`,
          ),
          ...(summary === undefined ? {} : { summary }),
          order: Number.isInteger(action.order) ? Number(action.order) : index,
        });
      })
      .sort(
        (left, right) =>
          left.order - right.order || left.label.localeCompare(right.label),
      ),
  );
}

function parseNavigation(
  catalogueValue: unknown,
  availabilityValue: unknown,
): readonly AxisNavigationItem[] {
  const catalogue = record(catalogueValue, 'BackOffice module catalogue');
  const availability = record(availabilityValue, 'BackOffice module availability');
  const navigation: AxisNavigationItem[] = [];

  Object.entries(catalogue).forEach(([moduleName, rawMetadata]) => {
    const metadata = record(rawMetadata, `BackOffice catalogue entry ${moduleName}`);
    if (metadata.enabled === false) return;
    const compatibility = record(metadata.compatibility, `${moduleName} compatibility`);
    if (compatibility.status === 'INCOMPATIBLE') return;
    if (metadata.requiredPermissions !== undefined) {
      stringList(metadata.requiredPermissions, `${moduleName} required permissions`);
    }
    if (!Array.isArray(metadata.navigation)) return;
    const moduleAvailability =
      availability[moduleName] === undefined
        ? 'UNKNOWN'
        : availabilityState(
            record(availability[moduleName], `${moduleName} availability`).state,
          );

    metadata.navigation.forEach((rawItem, index) => {
      const item = record(rawItem, `${moduleName} navigation item`);
      if (item.requiredPermissions !== undefined) {
        stringList(item.requiredPermissions, `${moduleName} navigation permissions`);
      }
      navigation.push(
        Object.freeze({
          id: text(item.id, `${moduleName} navigation id`),
          label: navigationDisplayLabel(
            text(item.label, `${moduleName} navigation label`),
          ),
          route: relativeRoute(item.route, `${moduleName} navigation route`),
          order: Number.isInteger(item.order) ? Number(item.order) : index,
          moduleName,
          category:
            typeof metadata.category === 'string' && metadata.category !== ''
              ? metadata.category
              : 'other',
          icon:
            typeof item.icon === 'string' && item.icon !== ''
              ? item.icon
              : typeof metadata.icon === 'string' && metadata.icon !== ''
                ? metadata.icon
                : 'module',
          availability: moduleAvailability,
          labelKey: optionalText(item.labelKey, `${moduleName} navigation label key`),
          parentId: optionalText(item.parentId, `${moduleName} navigation parent id`),
          parentModuleName:
            item.parentModuleName === undefined
              ? undefined
              : safeModuleName(
                  item.parentModuleName,
                  `${moduleName} navigation parent module name`,
                ),
          group: parseNavigationGroup(item.group, moduleName),
          perspectives:
            item.perspectives === undefined
              ? Object.freeze(['operations'])
              : stringList(item.perspectives, `${moduleName} navigation perspectives`),
          contexts:
            item.contexts === undefined
              ? Object.freeze([])
              : stringList(item.contexts, `${moduleName} navigation contexts`),
          featureState: navigationFeatureState(item.featureState),
          badgeProvider: parseBadgeProvider(item.badgeProvider, moduleName),
          workbenchTarget: parseWorkbenchTarget(item.workbenchTarget, moduleName),
          workbenchPresentation: parseWorkbenchPresentation(
            item.workbenchPresentation,
            moduleName,
          ),
          detailPanels: parseNavigationDetailPanels(item.detailPanels, moduleName),
          lifecycleActions: parseNavigationLifecycleActions(
            item.lifecycleActions,
            moduleName,
          ),
          help: parseNavigationHelp(item.help, moduleName),
        }),
      );
    });
  });

  const byModule = new Map<string, AxisNavigationItem[]>();
  navigation.forEach((item) => {
    byModule.set(item.moduleName, [...(byModule.get(item.moduleName) ?? []), item]);
  });
  byModule.forEach((items, moduleName) => {
    const byId = new Map(items.map((item) => [item.id, item]));
    if (byId.size !== items.length) {
      throw new Error(`${moduleName} navigation contains duplicate ids`);
    }
  });
  const byNavigationKey = new Map(
    navigation.map((item) => [`${item.moduleName}:${item.id}`, item]),
  );
  navigation.forEach((item) => {
    if (item.parentModuleName && !item.parentId) {
      throw new Error(`${item.moduleName} navigation parent module requires parent id`);
    }
    const visited = new Set([`${item.moduleName}:${item.id}`]);
    let parentId = item.parentId;
    let parentModuleName = item.parentModuleName ?? item.moduleName;
    while (parentId) {
      const parentKey = `${parentModuleName}:${parentId}`;
      const parent = byNavigationKey.get(parentKey);
      if (!parent) {
        throw new Error(`${item.moduleName} navigation contains an orphan item`);
      }
      if (visited.has(parentKey)) {
        throw new Error(`${item.moduleName} navigation contains a cycle`);
      }
      visited.add(parentKey);
      parentId = parent.parentId;
      parentModuleName = parent.parentModuleName ?? parent.moduleName;
    }
  });

  return Object.freeze(
    navigation.sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label),
    ),
  );
}

function parseNavigationSourceTrace(
  value: unknown,
  moduleName: string,
): AxisNavigationSourceTrace | undefined {
  if (value === undefined) return undefined;
  const trace = record(value, `${moduleName} navigation source trace`);
  return Object.freeze({
    sourceType: text(trace.sourceType, `${moduleName} navigation source type`),
    ownerModule: safeModuleName(
      trace.ownerModule,
      `${moduleName} navigation source owner module`,
    ),
    stableIdentity: text(
      trace.stableIdentity,
      `${moduleName} navigation source stable identity`,
    ),
    overrideApplied: trace.overrideApplied === true,
    editable: trace.editable === true,
    lifecycleState: text(
      trace.lifecycleState,
      `${moduleName} navigation source lifecycle state`,
    ),
  });
}

function parseNavigationRouteOwner(
  value: unknown,
  moduleName: string,
): AxisNavigationRouteOwner | undefined {
  if (value === undefined) return undefined;
  const owner = record(value, `${moduleName} navigation route owner`);
  return Object.freeze({
    ownerType: text(owner.ownerType, `${moduleName} navigation route owner type`),
    ownerModule: safeModuleName(
      owner.ownerModule,
      `${moduleName} navigation route owner module`,
    ),
  });
}

function parseEffectiveNavigationComposition(
  value: unknown,
): AxisEffectiveNavigationComposition | undefined {
  if (value === undefined) return undefined;
  const composition = record(value, 'BackOffice effective navigation composition');
  const navigationValue = composition.navigation;
  if (!Array.isArray(navigationValue)) {
    throw new Error(
      'BackOffice effective navigation composition must contain navigation',
    );
  }
  const navigation = navigationValue.map((rawItem, index) => {
    const item = record(rawItem, 'BackOffice effective navigation item');
    const moduleName = safeModuleName(
      item.moduleName,
      'BackOffice effective navigation module name',
    );
    return Object.freeze({
      id: text(item.id, `${moduleName} effective navigation id`),
      label: navigationDisplayLabel(
        text(item.label, `${moduleName} effective navigation label`),
      ),
      route: relativeRoute(item.route, `${moduleName} effective navigation route`),
      order: Number.isInteger(item.order) ? Number(item.order) : index,
      moduleName,
      category:
        typeof item.category === 'string' && item.category !== ''
          ? item.category
          : 'other',
      icon: typeof item.icon === 'string' && item.icon !== '' ? item.icon : 'module',
      availability: availabilityState(item.availability),
      labelKey: optionalText(
        item.labelKey,
        `${moduleName} effective navigation label key`,
      ),
      parentId: optionalText(
        item.parentId,
        `${moduleName} effective navigation parent id`,
      ),
      parentModuleName:
        item.parentModuleName === undefined
          ? undefined
          : safeModuleName(
              item.parentModuleName,
              `${moduleName} effective navigation parent module name`,
            ),
      group: parseNavigationGroup(item.group, moduleName),
      perspectives:
        item.perspectives === undefined
          ? Object.freeze(['operations'])
          : stringList(
              item.perspectives,
              `${moduleName} effective navigation perspectives`,
            ),
      contexts:
        item.contexts === undefined
          ? Object.freeze([])
          : stringList(item.contexts, `${moduleName} effective navigation contexts`),
      featureState: navigationFeatureState(item.featureState),
      badgeProvider: parseBadgeProvider(item.badgeProvider, moduleName),
      workbenchTarget: parseWorkbenchTarget(item.workbenchTarget, moduleName),
      workbenchPresentation: parseWorkbenchPresentation(
        item.workbenchPresentation,
        moduleName,
      ),
      detailPanels: parseNavigationDetailPanels(item.detailPanels, moduleName),
      lifecycleActions: parseNavigationLifecycleActions(
        item.lifecycleActions,
        moduleName,
      ),
      help: parseNavigationHelp(item.help, moduleName),
      sourceTrace: parseNavigationSourceTrace(item.sourceTrace, moduleName),
      routeOwner: parseNavigationRouteOwner(item.routeOwner, moduleName),
    } satisfies AxisNavigationItem);
  });
  const warnings = Array.isArray(composition.warnings)
    ? composition.warnings
        .filter(
          (warning): warning is Record<string, unknown> =>
            typeof warning === 'object' && warning !== null && !Array.isArray(warning),
        )
        .map((warning) => Object.freeze({ ...warning }))
    : [];
  return Object.freeze({
    contractVersion: Number.isInteger(composition.contractVersion)
      ? Number(composition.contractVersion)
      : 0,
    version: Number.isInteger(composition.version) ? Number(composition.version) : 0,
    checksum: text(composition.checksum, 'BackOffice effective navigation checksum'),
    lifecycleState: text(
      composition.lifecycleState,
      'BackOffice effective navigation lifecycle state',
    ),
    source: text(composition.source, 'BackOffice effective navigation source'),
    fallbackActive: composition.fallbackActive === true,
    fallbackReason: optionalText(
      composition.fallbackReason,
      'BackOffice effective navigation fallback reason',
    ),
    authoring:
      typeof composition.authoring === 'object' &&
      composition.authoring !== null &&
      !Array.isArray(composition.authoring)
        ? Object.freeze({ ...(composition.authoring as Record<string, unknown>) })
        : undefined,
    navigation: Object.freeze(navigation),
    warnings: Object.freeze(warnings),
    generatedAt: text(
      composition.generatedAt,
      'BackOffice effective navigation generated time',
    ),
  });
}

function parseModuleContext(modulesValue: unknown): {
  readonly environments: readonly string[];
  readonly connections: Readonly<Record<string, readonly AxisModuleConnection[]>>;
  readonly catalog: Readonly<Record<string, AxisModuleCatalogEntry>>;
} {
  const modules = record(modulesValue, 'BackOffice authorized modules');
  const environments: string[] = [];
  const connections: Record<string, readonly AxisModuleConnection[]> = {};
  const catalog: Record<string, AxisModuleCatalogEntry> = {};
  Object.entries(modules).forEach(([moduleName, instances]) => {
    if (!Array.isArray(instances)) {
      throw new Error('BackOffice module instances must be a list');
    }
    const moduleConnections: AxisModuleConnection[] = [];
    instances.forEach((instance) => {
      const lease = record(instance, 'BackOffice module lease');
      if (!catalog[moduleName]) {
        catalog[moduleName] = Object.freeze({
          moduleName,
          displayName: optionalText(lease.displayName, `${moduleName} display name`),
          parentModule: optionalText(lease.parentModule, `${moduleName} parent module`),
          canonicalIdentity: optionalText(
            lease.canonicalIdentity,
            `${moduleName} canonical identity`,
          ),
          moduleKind: optionalText(lease.moduleKind, `${moduleName} kind`),
        });
      }
      const environment =
        typeof lease.environment === 'string' && lease.environment !== ''
          ? lease.environment
          : undefined;
      if (environment) environments.push(environment);
      if (
        lease.clientCallable === true &&
        lease.endpoint !== undefined &&
        environment
      ) {
        const server = optionalText(lease.server, `${moduleName} server`);
        const runtimeRoleValue =
          lease.runtimeRole === undefined
            ? undefined
            : record(lease.runtimeRole, `${moduleName} runtime role`);
        const runtimeRole = runtimeRoleValue
          ? Object.freeze({
              code: text(runtimeRoleValue.code, `${moduleName} runtime role code`),
              publication: text(
                runtimeRoleValue.publication,
                `${moduleName} publication role`,
              ),
            })
          : undefined;
        moduleConnections.push(
          Object.freeze({
            moduleName,
            instanceId: text(lease.instanceId, `${moduleName} instanceId`),
            endpoint: baseUrl(lease.endpoint, `${moduleName} endpoint`),
            environment,
            ...(server === undefined ? {} : { server }),
            ...(runtimeRole === undefined ? {} : { runtimeRole }),
            state: availabilityState(lease.state),
          }),
        );
      }
    });
    if (moduleConnections.length > 0) {
      connections[moduleName] = Object.freeze(
        moduleConnections.sort((left, right) =>
          left.instanceId.localeCompare(right.instanceId),
        ),
      );
    }
  });
  return Object.freeze({
    environments: Object.freeze([...new Set(environments)].sort()),
    connections: Object.freeze({ ...connections }),
    catalog: Object.freeze({ ...catalog }),
  });
}

function parseDocumentationSources(value: unknown): readonly AxisDocumentationSource[] {
  if (!Array.isArray(value)) {
    throw new Error('BackOffice documentation sources must be a list');
  }
  const ids = new Set<string>();
  const sources = value.map((candidate, index): AxisDocumentationSource => {
    const source = record(candidate, 'BackOffice documentation source');
    const id = text(source.id, 'documentation source id');
    if (ids.has(id))
      throw new Error('BackOffice documentation sources contain duplicate ids');
    ids.add(id);
    const common = {
      id,
      label: text(source.label, `${id} documentation label`),
      route: relativeRoute(source.route, `${id} documentation route`),
      order: Number.isInteger(source.order) ? Number(source.order) : index,
      ownerModule: text(source.ownerModule, `${id} documentation owner`),
      connectionModule: text(
        source.connectionModule,
        `${id} documentation connection module`,
      ),
      labelKey: optionalText(source.labelKey, `${id} documentation label key`),
      dashboard: parseDocumentationDashboard(source.dashboard, `${id} documentation`),
    };
    if (source.type === 'CMS') {
      return Object.freeze({
        ...common,
        type: 'CMS',
        site: text(source.site, `${id} documentation Site`),
        catalog: text(source.catalog, `${id} documentation catalog`),
        defaultPage: relativeRoute(source.defaultPage, `${id} default page`),
        packCode: text(source.packCode, `${id} content-pack code`),
        ...(source.initializationProfile === undefined
          ? {}
          : {
              initializationProfile: text(
                source.initializationProfile,
                `${id} initialization profile`,
              ),
            }),
      });
    }
    if (source.type === 'OPENAPI') {
      return Object.freeze({
        ...common,
        type: 'OPENAPI',
        openApiPath: relativeRoute(source.openApiPath, `${id} OpenAPI path`),
        swaggerPath: relativeRoute(source.swaggerPath, `${id} Swagger path`),
      });
    }
    throw new Error(`${id} documentation source type is unsupported`);
  });
  return Object.freeze(
    sources.sort(
      (left, right) =>
        left.order - right.order || left.label.localeCompare(right.label),
    ),
  );
}

function parseDocumentationDashboard(
  value: unknown,
  name: string,
): AxisDocumentationDashboardMetadata {
  if (value === undefined) {
    return Object.freeze({ audiences: Object.freeze([]) });
  }
  const dashboard = record(value, `${name} dashboard`);
  return Object.freeze({
    summary: optionalText(dashboard.summary, `${name} dashboard summary`),
    kind: optionalText(dashboard.kind, `${name} dashboard kind`),
    icon: optionalText(dashboard.icon, `${name} dashboard icon`),
    audiences:
      dashboard.audiences === undefined
        ? Object.freeze([])
        : stringList(dashboard.audiences, `${name} dashboard audiences`),
    coverage:
      dashboard.coverage === undefined
        ? undefined
        : parseDocumentationCoverage(dashboard.coverage, `${name} dashboard coverage`),
  });
}

function parseDocumentationCoverage(
  value: unknown,
  name: string,
): AxisDocumentationCoverage {
  const coverage = record(value, name);
  const score = nonNegativeInteger(coverage.score, `${name} score`);
  if (score > 100) {
    throw new Error(`${name} score must be between 0 and 100`);
  }
  if (
    typeof coverage.status !== 'string' ||
    !['STRONG', 'PARTIAL', 'NEEDS_WORK', 'REFERENCE'].includes(coverage.status)
  ) {
    throw new Error(`${name} status is unsupported`);
  }
  return Object.freeze({
    score,
    status: coverage.status as AxisDocumentationCoverage['status'],
    signals:
      coverage.signals === undefined
        ? Object.freeze([])
        : stringList(coverage.signals, `${name} signals`),
    gaps:
      coverage.gaps === undefined
        ? Object.freeze([])
        : stringList(coverage.gaps, `${name} gaps`),
  });
}

export function parseEmployeePolicy(value: unknown): AxisEmployeePolicy {
  const policy = record(value, 'BackOffice Axis employee policy');
  if (
    policy.contractVersion !== 0 ||
    typeof policy.screenLockEnabled !== 'boolean' ||
    !Number.isInteger(policy.idleTimeoutSeconds) ||
    Number(policy.idleTimeoutSeconds) < 60 ||
    Number(policy.idleTimeoutSeconds) > 86_400 ||
    !Number.isInteger(policy.recentNavigationLimit) ||
    Number(policy.recentNavigationLimit) < 1 ||
    Number(policy.recentNavigationLimit) > 24 ||
    !['DEFAULT', 'PERSISTED'].includes(String(policy.source))
  ) {
    throw new Error('BackOffice Axis employee policy is incompatible');
  }
  return Object.freeze({
    contractVersion: 0,
    screenLockEnabled: policy.screenLockEnabled,
    idleTimeoutSeconds: Number(policy.idleTimeoutSeconds),
    recentNavigationLimit: Number(policy.recentNavigationLimit),
    revision: nonNegativeInteger(policy.revision, 'Axis policy revision'),
    source: policy.source as 'DEFAULT' | 'PERSISTED',
  });
}

export function parsePublicBootstrap(
  value: unknown,
  expectedVersion: number,
): AxisPublicBootstrap {
  const envelope = record(value, 'BackOffice public bootstrap response');
  const data = record(envelope.data, 'BackOffice public bootstrap data');
  if (
    data.contractVersion !== expectedVersion ||
    data.clientContractVersion !== expectedVersion
  ) {
    throw new Error('BackOffice public bootstrap contract is incompatible');
  }
  const endpoints = record(data.endpoints, 'public bootstrap endpoints');
  const composition = record(data.uiComposition, 'public bootstrap composition');
  if (composition.fallbackMode !== 'STATIC_RECOVERY_SHELL') {
    throw new Error('BackOffice public bootstrap fallback mode is unsupported');
  }
  return Object.freeze({
    contractVersion: expectedVersion,
    clientContractVersion: expectedVersion,
    endpoints: Object.freeze({
      profile: baseUrl(endpoints.profile, 'profile endpoint'),
      cms: baseUrl(endpoints.cms, 'cms endpoint'),
      ...(endpoints.localization !== undefined
        ? { localization: baseUrl(endpoints.localization, 'localization endpoint') }
        : {}),
    }),
    uiComposition: Object.freeze({
      site: text(composition.site, 'composition site'),
      catalog: text(composition.catalog, 'composition catalog'),
      defaultPublicPage: text(composition.defaultPublicPage, 'default public page'),
      defaultAuthenticatedPage: text(
        composition.defaultAuthenticatedPage,
        'default authenticated page',
      ),
      locale: text(composition.locale, 'composition locale'),
      supportedLocales:
        composition.supportedLocales === undefined
          ? Object.freeze([text(composition.locale, 'composition locale')])
          : stringList(composition.supportedLocales, 'composition supported locales'),
      fallbackLocales:
        composition.fallbackLocales === undefined
          ? Object.freeze([])
          : stringList(composition.fallbackLocales, 'composition fallback locales'),
      channel: text(composition.channel, 'composition channel'),
      fallbackMode: 'STATIC_RECOVERY_SHELL',
    }),
  });
}

export async function loadPublicBootstrap(
  backofficeBaseUrl: string,
  clientContractVersion: number,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<AxisPublicBootstrap> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL('/nodics/backoffice/v0/bootstrap/public', backofficeBaseUrl);
    const response = await fetchImplementation(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-nodics-client-contract-version': String(clientContractVersion),
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `BackOffice public bootstrap returned HTTP ${String(response.status)}`,
      );
    }
    return parsePublicBootstrap(await response.json(), clientContractVersion);
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error('BackOffice public bootstrap timed out');
    }
    throw error instanceof Error
      ? error
      : new Error('BackOffice public bootstrap failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function parseApplicationInitializationProfiles(
  value: unknown,
): readonly AxisApplicationInitializationProfile[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('BackOffice application initialization profiles must be a list');
  }
  return Object.freeze(
    value.map((candidate) => {
      const profile = record(
        candidate,
        'BackOffice application initialization profile',
      );
      const activationPolicy = record(
        profile.activationPolicy ?? {},
        'BackOffice application initialization activation policy',
      );
      const dataPackages = Array.isArray(profile.dataPackages)
        ? profile.dataPackages.map((candidatePackage) => {
            const dataPackage = record(
              candidatePackage,
              'BackOffice application initialization data package',
            );
            return Object.freeze({
              code: text(
                dataPackage.code,
                'application initialization data package code',
              ),
              kind: text(
                dataPackage.kind,
                'application initialization data package kind',
              ),
              required:
                typeof dataPackage.required === 'boolean' ? dataPackage.required : true,
              trigger: text(
                dataPackage.trigger,
                'application initialization data package trigger',
              ),
            });
          })
        : [];
      return Object.freeze({
        code: text(profile.code, 'application initialization profile code'),
        title: text(profile.title, 'application initialization profile title'),
        kind: text(profile.kind, 'application initialization profile kind'),
        category: text(profile.category, 'application initialization profile category'),
        summary: typeof profile.summary === 'string' ? profile.summary : '',
        order: nonNegativeInteger(
          profile.order ?? 1000,
          'application initialization profile order',
        ),
        type: text(profile.type, 'application initialization profile type'),
        owner: text(profile.owner, 'application initialization profile owner'),
        applicationCode: text(
          profile.applicationCode,
          'application initialization application code',
        ),
        siteCode: text(profile.siteCode, 'application initialization site code'),
        baselineCode: text(
          profile.baselineCode,
          'application initialization baseline code',
        ),
        ...(profile.contentPackCode === undefined
          ? {}
          : {
              contentPackCode: text(
                profile.contentPackCode,
                'application initialization content pack code',
              ),
            }),
        requiredServers: Object.freeze(
          Array.isArray(profile.requiredServers)
            ? profile.requiredServers.map((server) =>
                text(server, 'application initialization required server'),
              )
            : [],
        ),
        dataPackages: Object.freeze(dataPackages),
        activationPolicy: Object.freeze({
          approvalRequiredForOnline:
            typeof activationPolicy.approvalRequiredForOnline === 'boolean'
              ? activationPolicy.approvalRequiredForOnline
              : true,
          requiredDataTrigger:
            typeof activationPolicy.requiredDataTrigger === 'string'
              ? activationPolicy.requiredDataTrigger
              : 'ACTIVATION',
          sampleDataTrigger:
            typeof activationPolicy.sampleDataTrigger === 'string'
              ? activationPolicy.sampleDataTrigger
              : 'USER',
        }),
      });
    }),
  );
}

export async function loadAuthenticatedBootstrap(
  backofficeBaseUrl: string,
  clientContractVersion: number,
  accessToken: string,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch,
): Promise<AxisAuthenticatedBootstrap> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImplementation(
      new URL('/nodics/backoffice/v0/bootstrap', backofficeBaseUrl),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'x-nodics-client-contract-version': String(clientContractVersion),
        },
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? 'This employee is not authorized to use Nodics Axis.'
          : `BackOffice employee bootstrap returned HTTP ${String(response.status)}`,
      );
    }
    const envelope = record(
      await response.json(),
      'BackOffice employee bootstrap response',
    );
    const data = record(envelope.data, 'BackOffice employee bootstrap data');
    const moduleContext = parseModuleContext(data.modules);
    const effectiveNavigationComposition = parseEffectiveNavigationComposition(
      data.effectiveNavigationComposition,
    );
    return Object.freeze({
      axisPolicy: parseEmployeePolicy(data.axisPolicy),
      navigation:
        effectiveNavigationComposition?.navigation ??
        parseNavigation(data.catalogue, data.availability),
      effectiveNavigationComposition,
      moduleCatalog: moduleContext.catalog,
      environments: moduleContext.environments,
      moduleConnections: moduleContext.connections,
      applicationInitializationProfiles: parseApplicationInitializationProfiles(
        data.applicationInitializationProfiles,
      ),
      documentationSources: parseDocumentationSources(data.documentationSources),
      tenantCode: text(data.tenantCode, 'BackOffice employee tenant code'),
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
