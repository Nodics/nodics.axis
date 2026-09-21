import type { AxisAuthenticatedBootstrap } from '../../../bootstrap/publicBootstrap';
import { invokeOperationalOwner as invoke } from '../../shared/operationalOwnerClient';

export interface RuntimeConfigurationClientConfiguration {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface RuntimeConfigurationFieldSchema {
  readonly code: string;
  readonly label?: string;
  readonly description?: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly sensitive?: boolean;
  readonly restartRequired?: boolean;
  readonly pattern?: string;
  readonly options?: readonly string[];
}

export interface RuntimeConfigurationSchemaSummary {
  readonly code: string;
  readonly ownerModule?: string;
  readonly label?: string;
  readonly description?: string;
  readonly category?: string;
  readonly capabilityGroup?: string;
  readonly updatePermission?: string;
  readonly viewPermission?: string;
  readonly refreshBehavior?: string;
  readonly fields: readonly RuntimeConfigurationFieldSchema[];
}

export interface RuntimeConfigurationEffectiveValue {
  readonly configured: boolean;
  readonly value?: string;
  readonly sensitive?: boolean;
  readonly restartRequired?: boolean;
}

export interface RuntimeConfigurationEffective {
  readonly code: string;
  readonly ownerModule?: string;
  readonly status: 'CONFIGURED' | 'UNCONFIGURED' | string;
  readonly missingRequired: readonly string[];
  readonly values: Readonly<Record<string, RuntimeConfigurationEffectiveValue>>;
}

export interface RuntimeConfigurationValidation {
  readonly valid: boolean;
  readonly errors?: readonly string[];
}

export interface RuntimeConfigurationSavedRecord {
  readonly code: string;
  readonly ownerModule?: string;
  readonly schemaCode?: string;
  readonly status?: string;
  readonly revision?: string;
  readonly updatedAt?: string;
  readonly fields?: Readonly<
    Record<
      string,
      {
        readonly value?: string;
        readonly configured?: boolean;
        readonly sensitive?: boolean;
        readonly restartRequired?: boolean;
      }
    >
  >;
}

const owner = 'system';
const schemaPath = (schemaCode: string) =>
  '/config/runtime/schema/' + encodeURIComponent(schemaCode);

export function loadRuntimeConfigurationSchemas(
  configuration: RuntimeConfigurationClientConfiguration,
) {
  return invoke<RuntimeConfigurationSchemaSummary[]>(
    configuration,
    owner,
    '/config/runtime/schema',
  );
}

export function loadRuntimeConfigurationEffective(
  configuration: RuntimeConfigurationClientConfiguration,
  schemaCode: string,
) {
  return invoke<RuntimeConfigurationEffective>(
    configuration,
    owner,
    schemaPath(schemaCode) + '/effective',
  );
}

export function validateRuntimeConfigurationUpdate(
  configuration: RuntimeConfigurationClientConfiguration,
  schemaCode: string,
  values: Record<string, unknown>,
) {
  return invoke<RuntimeConfigurationValidation>(
    configuration,
    owner,
    schemaPath(schemaCode) + '/validate',
    { values },
  );
}

export function saveRuntimeConfigurationUpdate(
  configuration: RuntimeConfigurationClientConfiguration,
  schemaCode: string,
  values: Record<string, unknown>,
) {
  return invoke<RuntimeConfigurationSavedRecord>(
    configuration,
    owner,
    schemaPath(schemaCode),
    { values },
  );
}
