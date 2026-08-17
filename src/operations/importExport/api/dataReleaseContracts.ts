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
}

export interface DataReleasePlan {
  readonly dataType: DataReleaseType;
  readonly modules?: readonly string[];
  readonly releaseCodes?: readonly string[];
  readonly expectedReleases: Readonly<Record<string, string>>;
}

export interface DataReleaseOperationResult {
  readonly dataType: DataReleaseType;
  readonly tenant: string;
  readonly releases: readonly DataRelease[];
  readonly importRun?: string;
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
