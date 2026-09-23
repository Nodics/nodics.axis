import type { WorkbenchFilterGroup } from '../../../workbench/api/workbenchContracts';

export type DataReleaseType = 'init' | 'core' | 'sample';

export type DataReleaseStatus =
  | 'NOT_INSTALLED'
  | 'CURRENT'
  | 'UPDATE_AVAILABLE'
  | 'DOWNGRADE_AVAILABLE'
  | 'INVALID_RELEASE'
  | 'RUNNING'
  | 'FAILED';

export interface DataRelease {
  readonly releaseCode?: string;
  readonly sectionCode?: string;
  readonly moduleName: string;
  readonly displayName: string;
  readonly moduleIndex?: string;
  readonly parentModule?: string;
  readonly canonicalIdentity: string;
  readonly dataType: DataReleaseType;
  readonly version: string;
  readonly description: string;
  readonly destinationRole?: string;
  readonly checksum: string;
  readonly invalidReason?: string;
  readonly installedVersion?: string;
  readonly installedAt?: string;
  readonly lastAttemptAt?: string;
  readonly lastRunId?: string;
  readonly status: DataReleaseStatus;
  readonly readiness?: DataReleaseReadiness | undefined;
}

export interface DataReleaseReadiness {
  readonly capabilityCode: string;
  readonly displayName: string;
  readonly owningModule: string;
  readonly capabilityType: string;
  readonly group: string;
  readonly extendsCapability?: string | undefined;
  readonly businessOutcome?: string | undefined;
  readonly businessStatus: string;
  readonly technicalStatus: string;
  readonly releaseStatus?: string | undefined;
  readonly nextAction: string;
  readonly blockers: readonly DataReleaseReadinessBlocker[];
}

export interface DataReleaseReadinessBlocker {
  readonly blockerCode?: string | undefined;
  readonly code: string;
  readonly severity: string;
  readonly owner: string;
  readonly ownerType?: string | undefined;
  readonly source?: string | undefined;
  readonly message: string;
  readonly action: string;
  readonly disabledReason?: string | undefined;
  readonly targetServer?: string | undefined;
  readonly targetRuntimeRole?: string | undefined;
  readonly technicalStatus?: string | undefined;
  readonly repair?: DataReleaseReadinessRepairAction | undefined;
}

export interface DataReleaseReadinessRepairAction {
  readonly available: boolean;
  readonly label: string;
  readonly operation: string;
  readonly action: string;
  readonly idempotent: boolean;
  readonly requiresConfirmation: boolean;
}

export interface DataReleasePlan {
  readonly dataType: DataReleaseType;
  readonly modules?: readonly string[];
  readonly releaseCodes?: readonly string[];
  readonly expectedReleases: Readonly<Record<string, string>>;
}

export type DataReleaseDryRunOperation =
  | 'INSTALL'
  | 'UPDATE'
  | 'RETRY'
  | 'SKIP_CURRENT'
  | 'BLOCKED'
  | 'WAIT';

export interface DataReleaseDryRunOutcome {
  readonly releaseCode?: string | undefined;
  readonly displayName: string;
  readonly moduleName: string;
  readonly status: DataReleaseStatus;
  readonly operation: DataReleaseDryRunOperation;
  readonly impact: string;
  readonly nextAction: string;
  readonly blockers: readonly DataReleaseReadinessBlocker[];
}

export interface DataReleasePublicationFollowUp {
  readonly releaseCode?: string | undefined;
  readonly displayName: string;
  readonly moduleName: string;
  readonly publicationPolicy: string;
  readonly initialPublicationPolicy?: string | undefined;
  readonly targetRole?: string | undefined;
  readonly sourceRole?: string | undefined;
  readonly siteCode?: string | undefined;
  readonly catalogCode?: string | undefined;
  readonly workflowRequired: boolean;
  readonly nextAction: string;
  readonly impact: string;
}

export interface DataReleaseDryRunSummary {
  readonly mode: 'VALIDATE';
  readonly validationOnly: boolean;
  readonly importExecuted: boolean;
  readonly dataType: DataReleaseType;
  readonly tenant: string;
  readonly totalReleases: number;
  readonly executableReleases: number;
  readonly alreadyCurrent: number;
  readonly blockedReleases: number;
  readonly summary: {
    readonly install: number;
    readonly update: number;
    readonly retry: number;
    readonly skip: number;
    readonly blocked: number;
    readonly wait: number;
  };
  readonly outcomes: readonly DataReleaseDryRunOutcome[];
  readonly publicationFollowUps: readonly DataReleasePublicationFollowUp[];
  readonly messages: readonly string[];
}

export interface DataReleaseOperationResult {
  readonly dataType: DataReleaseType;
  readonly tenant: string;
  readonly releases: readonly DataRelease[];
  readonly importRun?: string;
  readonly dryRun?: DataReleaseDryRunSummary | undefined;
}

export type InitializationProfileStatus =
  | 'ACTION_REQUIRED'
  | 'BLOCKED'
  | 'RUNNING'
  | 'CURRENT';

export interface InitializationProfileStep {
  readonly order: number;
  readonly dataType: DataReleaseType;
  readonly releases: readonly DataRelease[];
}

export interface InitializationProfile {
  readonly profileCode: string;
  readonly label: string;
  readonly description: string;
  readonly completionMessage: string;
  readonly moduleIndex?: string;
  readonly destinationRole?: string;
  readonly status: InitializationProfileStatus;
  readonly blocked: boolean;
  readonly steps: readonly InitializationProfileStep[];
}

export interface InitializationProfileOperationResult {
  readonly profileCode: string;
  readonly mode: 'VALIDATE' | 'INSTALL';
  readonly profile: InitializationProfile;
}

export interface ImportRunSummary {
  readonly runId: string;
  readonly status: string;
  readonly dataType?: string;
  readonly modules: readonly string[];
  readonly requestedBy?: string;
  readonly createdAt?: string;
  readonly summary?: ImportRunRecordSummary;
  readonly failures?: readonly ImportRunFailure[];
  readonly validationErrors?: readonly ImportRunFailure[];
}

export interface ImportRunRecordSummary {
  readonly recordsRead?: number;
  readonly recordsFinalized?: number;
  readonly recordsDispatched?: number;
  readonly recordsSucceeded?: number;
  readonly recordsFailed?: number;
  readonly recordsSkipped?: number;
  readonly validationErrors?: number;
  readonly totalRecordsHandled?: number;
}

export interface ImportRunError {
  readonly code?: string;
  readonly message?: string;
  readonly name?: string;
}

export interface ImportRunFailure {
  readonly tenant?: string;
  readonly owningModule?: string;
  readonly targetModule?: string;
  readonly headerName?: string;
  readonly fileName?: string;
  readonly recordKey?: string;
  readonly schemaName?: string;
  readonly indexName?: string;
  readonly operation?: string;
  readonly propertyName?: string;
  readonly rowNumber?: number;
  readonly error?: ImportRunError;
}

export interface ImportValidationRow {
  readonly rowNumber?: number;
  readonly recordKey?: string;
  readonly status: string;
  readonly severity?: string;
  readonly fileName?: string;
  readonly schemaName?: string;
  readonly indexName?: string;
  readonly operation?: string;
  readonly tenant?: string;
  readonly field?: string;
  readonly message?: string;
  readonly howToFix?: string;
  readonly technicalCode?: string;
  readonly errorCount?: number;
}

export interface ImportValidationReport {
  readonly totalRecords: number;
  readonly validRecords: number;
  readonly invalidRecords: number;
  readonly warningRecords: number;
  readonly rows: readonly ImportValidationRow[];
}

export interface MediaUploadSummary {
  readonly mediaCode: string;
  readonly name: string;
  readonly originalFileName?: string;
  readonly extension?: string;
  readonly sizeBytes?: number;
  readonly checksum?: string;
  readonly status?: string;
}

export interface MediaUploadContext {
  readonly enterpriseCode: string;
  readonly moduleName: string;
  readonly schemaName: string;
  readonly tenantCode: string;
}

export interface MediaImportOperationResult {
  readonly validationOnly: boolean;
  readonly validationPassed?: boolean;
  readonly validationErrorCount?: number;
  readonly validationErrors?: readonly ImportRunFailure[];
  readonly validationReport?: ImportValidationReport;
  readonly importRun?: ImportRunSummary;
  readonly mediaSource?: MediaUploadSummary;
}

export interface GenericMediaImportRequest {
  readonly mediaCode: string;
  readonly moduleName: string;
  readonly schemaName: string;
  readonly operation: 'saveAll';
}

export type DataExportFileFormat = 'csv' | 'json';

export interface DataExportRequest {
  readonly enterpriseCode: string;
  readonly moduleName: string;
  readonly schemaName: string;
  readonly format: DataExportFileFormat;
  readonly query: {
    readonly search: string;
    readonly filters?: WorkbenchFilterGroup | undefined;
    readonly pageNumber: number;
    readonly pageSize: number;
    readonly sort: {
      readonly field: string;
      readonly direction: 'ASC' | 'DESC';
    };
  };
}

export interface DataExportMediaSummary {
  readonly mediaCode: string;
  readonly name: string;
  readonly originalFileName?: string;
  readonly extension?: string;
  readonly sizeBytes?: number;
  readonly checksum?: string;
  readonly status?: string;
  readonly accessUrl?: string;
}

export interface DataExportResultSummary {
  readonly requestedRecords: number;
  readonly exportedRecords: number;
  readonly totalAvailableRecords: number;
  readonly truncated: boolean;
}

export interface DataExportResult {
  readonly moduleName: string;
  readonly schemaName: string;
  readonly format: DataExportFileFormat;
  readonly fileName: string;
  readonly media: DataExportMediaSummary;
  readonly summary: DataExportResultSummary;
}
