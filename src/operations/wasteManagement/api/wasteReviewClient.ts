import type { AxisAuthenticatedBootstrap } from '../../../bootstrap/publicBootstrap';
import { invokeOperationalOwner as invoke } from '../../shared/operationalOwnerClient';
export interface WasteObservation {
  value: string;
  basis: string;
  confidence?: number | null;
}
export interface WasteRange {
  min: number | null;
  max: number | null;
  unit: 'KG' | 'CM';
  basis: string;
  confidence?: number | null;
}
export interface WasteMaterial {
  ref: { code: string; module?: string; schema?: string };
  name?: string | { en?: string };
  basis: string;
  confidence?: number | null;
  kind?: string;
}
export interface WasteEnvironment {
  recyclability: WasteObservation;
  contamination: WasteObservation;
  recoveryPotential: WasteObservation;
  hazards: { code: string; basis: string; confidence?: number | null }[];
}
export interface WasteEvidenceReview {
  assessed: boolean;
  sourceType: string;
  sourceLabel: string;
  manualApprovalRequired: boolean;
  acknowledgementRequired: boolean;
  manualApprovalRecorded: boolean;
  label: string;
  message: string | null;
  reason: string | null;
  reasonCodes: string[];
  acknowledgementLabel: string;
}
export interface WasteItemDescriptor {
  evidenceReview?: WasteEvidenceReview;
  contractVersion: 1;
  stage: string;
  identity: {
    name: string | null;
    description: string | null;
    brand: string | null;
    model: string | null;
  };
  classification: Record<
    'family' | 'category' | 'itemType',
    { code: string | null; name: string | { en?: string } | null }
  >;
  physical: {
    quantity: number | null;
    size: WasteObservation;
    weight: { value: string | null; basis: string; unit: string };
    weightEstimate: WasteRange;
    dimensionsEstimate: Record<'length' | 'width' | 'height', WasteRange> | null;
  };
  condition: WasteObservation;
  materials: WasteMaterial[];
  environment: {
    observations: WasteEnvironment;
    assessment: {
      status: string;
      indicators: {
        key: string;
        label: string;
        value: string | null;
        unitOfMeasure: string;
        status: string;
      }[];
      carbonCredits: { status: string; reason: string };
      methodology?: { formulaVersion?: string; isMock?: boolean };
    } | null;
  };
}
export interface WasteReviewFacts {
  sizeClass?: string;
  materials?: WasteMaterial[];
  weightEstimate?: WasteRange;
  dimensionsEstimate?: Record<'length' | 'width' | 'height', WasteRange>;
  environment?: WasteEnvironment;
  name?: string;
  description?: string;
  categoryCode?: string;
  itemTypeCode?: string;
  quantity?: number;
  brand?: string;
  model?: string;
  weight?: string;
  conditionGrade?: string;
  preferredCollectionPointCode?: string;
}
export interface WasteReviewSubmission {
  evidenceReview?: WasteEvidenceReview;
  descriptor?: WasteItemDescriptor;
  code: string;
  revision: number;
  submissionStatus: string;
  reviewPending?: { decision: 'APPROVED' | 'REJECTED'; principalCode?: string };
  submitterRef: { code: string };
  submittedFacts: WasteReviewFacts;
  confirmedFacts?: WasteReviewFacts;
  metadata: {
    verifiedEstimate?: {
      calculationStatus: string;
      reason?: string;
      formulaVersion?: string;
      metrics?: { metricCode: string; value: string; unitOfMeasure: string }[];
    };
    verifiedFacts?: WasteReviewFacts;
    reviewedFacts?: WasteReviewFacts;
    verifiedBy?: { code: string };
    preApprovalVerificationRef?: { code: string };
    sample?: boolean;
    photo?: { code?: string; url?: string };
    suggestion?: { facts?: WasteReviewFacts };
    submittedAt?: string;
    reviewedAt?: string;
    outcomeDelivery?: {
      status: string;
      intentCode?: string;
      revision?: number;
      nextAttemptAt?: string;
    };
    publicReason?: string;
    reviewAssignment?: {
      type: 'QUEUE' | 'EMPLOYEE';
      queueCode?: string;
      principalCode?: string;
    };
  };
}
export interface WasteReviewClientConfiguration {
  bootstrap: AxisAuthenticatedBootstrap;
  accessToken: string;
  enterpriseCode: string;
  timeoutMs: number;
}
/** Loads the persisted pending review queue. */
export async function loadWasteReviews(
  configuration: WasteReviewClientConfiguration,
): Promise<WasteReviewSubmission[]> {
  const result = await invoke<unknown>(configuration, 'eWaste', '/reviews');
  if (!Array.isArray(result))
    throw new Error('The review service returned an invalid queue.');
  return result as WasteReviewSubmission[];
}
/** Sends the exact reviewed revision and explicit operator decision. */
export function decideWasteReview(
  configuration: WasteReviewClientConfiguration,
  record: WasteReviewSubmission,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
  verifiedFacts: WasteReviewFacts,
  evidenceReviewed = false,
) {
  if (record.submissionStatus === 'APPROVED' && decision === 'APPROVED')
    return invoke<{ settlementStatus?: string; settlementMessage?: string }>(
      configuration,
      'eWaste',
      '/review-workspace/' + encodeURIComponent(record.code) + '/settlement',
      {
        expectedRevision: record.revision,
        confirmed: true,
        idempotencyKey: record.code + ':settlement:' + record.revision,
      },
    );
  return invoke<{ settlementStatus?: string; settlementMessage?: string }>(
    configuration,
    'eWaste',
    '/reviews/' + encodeURIComponent(record.code),
    {
      decision,
      ...(evidenceReviewed ? { evidenceReviewed: true } : {}),
      reason,
      verifiedFacts,
      expectedRevision: record.revision,
      confirmed: true,
      idempotencyKey: record.code + ':review:' + record.revision + ':' + decision,
    },
  );
}
/** Reads original photo evidence through Media's employee authorization. */
export async function loadWasteReviewPhoto(
  configuration: WasteReviewClientConfiguration,
  code: string,
): Promise<string> {
  const photo = await invoke<{
    mimeType?: unknown;
    contentBase64?: unknown;
    url?: unknown;
    previewType?: unknown;
  }>(configuration, 'eWaste', '/reviews/' + encodeURIComponent(code) + '/photo');
  // URL previews come only from the authorized evidence endpoint. Never forward
  // the employee token to the image host or accept executable/file URL schemes.
  if (typeof photo.url === 'string' && photo.url.trim()) {
    let url: URL;
    try {
      url = new URL(photo.url);
    } catch {
      throw new Error('The photo preview URL is invalid.');
    }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new Error('The photo preview URL is invalid.');
    return url.href;
  }
  if (
    typeof photo.mimeType !== 'string' ||
    (!/^image\/(jpeg|png|webp)$/.test(photo.mimeType) &&
      !(photo.previewType === 'PUBLIC_MEDIA' && photo.mimeType === 'image/svg+xml')) ||
    typeof photo.contentBase64 !== 'string'
  )
    throw new Error('The photo evidence response is invalid.');
  return `data:${photo.mimeType};base64,${photo.contentBase64}`;
}

export interface WasteOperationsContext {
  impactAssessment?: { labels: Record<string, string> };
  principalCode: string;
  canVerify: boolean;
  canApprove: boolean;
  canReadEvidence: boolean;
  canAudit: boolean;
  canAssign?: boolean;
  reviewWorkspace?: {
    descriptorOptions?: {
      sizeClasses: string[];
      recyclability: string[];
      contamination: string[];
      hazards: string[];
    };
    views?: Record<
      string,
      {
        ownerModule: string;
        label: string;
        mode: 'OVERVIEW' | 'SUBMISSIONS' | 'REVIEW_QUEUE';
        familyCode?: string;
      }
    >;
    dashboardLabels?: Record<string, string>;
    defaultPageSize: number;
    statuses: { code: string; label: string }[];
    labels: Record<string, string>;
    fields?: {
      key: keyof WasteReviewFacts;
      label: string;
      type: 'string' | 'text' | 'number';
    }[];
  };
  requireVerification: boolean;
  requireDifferentApprover: boolean;
  presentation: Record<string, string>;
}
/** Loads the backend-owned role and review policy projection. */
export async function loadWasteOperationsContext(
  configuration: WasteReviewClientConfiguration,
): Promise<WasteOperationsContext> {
  const context = await invoke<WasteOperationsContext>(
    configuration,
    'eWaste',
    '/operations/context',
  );
  if (
    !context ||
    typeof context.canVerify !== 'boolean' ||
    typeof context.canApprove !== 'boolean' ||
    !context.presentation
  )
    throw new Error('The operations service returned an invalid access contract.');
  return context;
}
/** Saves one explicit independent verification without issuing rewards. */
export function verifyWasteSubmission(
  configuration: WasteReviewClientConfiguration,
  record: WasteReviewSubmission,
  verifiedFacts: WasteReviewFacts,
) {
  return invoke<{ settlementStatus?: string; settlementMessage?: string }>(
    configuration,
    'eWaste',
    '/reviews/' + encodeURIComponent(record.code) + '/verify',
    {
      verifiedFacts,
      expectedRevision: record.revision,
      confirmed: true,
      idempotencyKey: record.code + ':verify:' + record.revision,
    },
  );
}
export interface WasteAuditEntry {
  code: string;
  status: string;
  revision: number;
  collectionPointCode?: string;
  verifiedBy?: { code: string };
  approvedBy?: { code: string };
  publicReason?: string;
  reviewedAt?: string;
}
/** Reads scoped audit evidence without exposing a mutation operation. */
export function loadWasteAudit(configuration: WasteReviewClientConfiguration) {
  return invoke<WasteAuditEntry[]>(configuration, 'eWaste', '/operations/audit');
}

export interface WasteReviewFilters {
  viewCode?: string;
  dateFrom?: string;
  dateTo?: string;
  familyCode?: string;
  categoryCode?: string;
  itemTypeCode?: string;
  sizeClass?: string;
  channel?: string;
  area?: string;
  dashboard?: boolean;
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
  collectionPointCode?: string;
  assignedToMe?: boolean;
}
export interface WasteDashboardData {
  contractVersion: 1;
  generatedAt: string;
  dateBasis: string;
  trend: { from: string; to: string; count: number }[];
  centres: {
    code: string;
    name: string | { en?: string };
    city: string | null;
    countryCode: string | null;
  }[];
  unavailableSources: string[];
  families: { code: string; name: string | { en?: string } }[];
  categories: { code: string; name: string | { en?: string }; familyCode: string }[];
  itemTypes: {
    code: string;
    name: string | { en?: string };
    categoryCode: string;
    allowedConditionGrades?: string[];
  }[];
  materials: { code: string; name: string | { en?: string }; materialKind?: string }[];
}
export interface WasteReviewPage {
  dashboard?: WasteDashboardData;
  contractVersion: 1;
  items: WasteReviewSubmission[];
  total: number;
  page: number;
  limit: number;
  counts: Record<string, number>;
}
/** Queries the owner for scoped counts and one page; the browser never filters a capped pending queue. */
export async function loadWasteReviewPage(
  configuration: WasteReviewClientConfiguration,
  filters: WasteReviewFilters,
): Promise<WasteReviewPage> {
  const parameters = new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
  const result = await invoke<WasteReviewPage>(
    configuration,
    'eWaste',
    '/review-workspace?' + parameters.toString(),
  );
  if (
    !result ||
    result.contractVersion !== 1 ||
    !Array.isArray(result.items) ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    !result.counts
  )
    throw new Error('The review service returned an invalid page.');
  return result;
}
/** Reads a selected review through owner authorization. */
export function loadWasteReviewDetail(
  configuration: WasteReviewClientConfiguration,
  code: string,
) {
  return invoke<WasteReviewSubmission>(
    configuration,
    'eWaste',
    '/review-workspace/' + encodeURIComponent(code),
  );
}
/** Claims or releases the caller's own assignment with the exact displayed revision. */
export function assignWasteReview(
  configuration: WasteReviewClientConfiguration,
  record: WasteReviewSubmission,
  action: 'CLAIM' | 'RELEASE',
) {
  return invoke<WasteReviewSubmission>(
    configuration,
    'eWaste',
    '/review-workspace/' + encodeURIComponent(record.code) + '/assignment',
    {
      action,
      expectedRevision: record.revision,
      confirmed: true,
      idempotencyKey: record.code + ':assignment:' + record.revision + ':' + action,
    },
  );
}

/** Explicitly resumes only the backend-recorded immutable decision command. */
export function recoverWasteReview(
  configuration: WasteReviewClientConfiguration,
  record: WasteReviewSubmission,
) {
  return invoke<{ settlementStatus?: string; settlementMessage?: string }>(
    configuration,
    'eWaste',
    '/review-workspace/' + encodeURIComponent(record.code) + '/recover',
    { expectedRevision: record.revision, confirmed: true },
  );
}

/** Retries Communication only for this authorized persisted review. */
export function retryWasteOutcome(
  configuration: WasteReviewClientConfiguration,
  record: WasteReviewSubmission,
) {
  return invoke<WasteReviewSubmission>(
    configuration,
    'eWaste',
    '/review-workspace/' + encodeURIComponent(record.code) + '/notification/retry',
    { confirmed: true },
  );
}

export function resolveWasteOutcome(
  configuration: WasteReviewClientConfiguration,
  record: WasteReviewSubmission,
  action: 'MARK_DELIVERED' | 'AUTHORIZE_RESEND' | 'CANCEL',
  reason: string,
) {
  return invoke<WasteReviewSubmission>(
    configuration,
    'eWaste',
    '/review-workspace/' + encodeURIComponent(record.code) + '/notification/resolution',
    {
      confirmed: true,
      action,
      reason,
      expectedDeliveryRevision: record.metadata.outcomeDelivery?.revision,
    },
  );
}

/** A persisted assessment; values come from the owner, never from client-side formulas. */
export interface WasteSavedAssessment {
  code: string;
  accepted: boolean;
  calculatedAt: string;
  calculationStatus: string;
  formulaVersion?: string;
  reason?: string | null;
  assessment: {
    status: string;
    indicators: {
      key: string;
      value: string | null;
      unitOfMeasure: string;
      label: string;
    }[];
    inputs?: {
      weightKg?: number;
      weightSource?: string;
      weightMinKg?: number;
      weightMaxKg?: number;
    };
    factors?: {
      factorKgCO2ePerKg?: number;
      factorSetVersion?: string;
      factorSource?: string;
    };
    methodology?: {
      providerCode?: string;
      providerVersion?: string;
      isMock?: boolean;
      geography?: string;
      factorDatasetRef?: string;
      baselineScenario?: string;
      treatmentScenario?: string;
      systemBoundary?: string;
    };
  } | null;
}
export interface WasteAssessmentHistory {
  contractVersion: 1;
  assetCode: string;
  assetRevision: number;
  acceptedAssessmentCode: string | null;
  acceptedAssessment: WasteSavedAssessment | null;
  items: WasteSavedAssessment[];
  total: number;
  page: number;
  limit: number;
  recoveryRequired: boolean;
  recoveryAction: 'ASSESS' | 'SELECT' | null;
  selectionHistory: {
    total: number;
    items: {
      code: string;
      assessmentCode: string;
      previousAssessmentCode: string | null;
      at: string;
      reason: string;
    }[];
  };
}
/** Reads authorized immutable history, including the accepted result even when it is on another page. */
export function loadWasteAssessments(
  configuration: WasteReviewClientConfiguration,
  code: string,
  page = 1,
) {
  return invoke<WasteAssessmentHistory>(
    configuration,
    'eWaste',
    '/review-workspace/' +
      encodeURIComponent(code) +
      '/impact-assessments?page=' +
      page,
  );
}
/** Sends an explicitly confirmed assessment command with a stable retry key and exact asset revision. */
export function mutateWasteAssessment(
  configuration: WasteReviewClientConfiguration,
  code: string,
  action: 'ASSESS' | 'SELECT' | 'RECOVER',
  command: {
    expectedRevision: number;
    confirmed: true;
    reason?: string;
    assessmentCode?: string;
    idempotencyKey?: string;
  },
) {
  return invoke<WasteAssessmentHistory>(
    configuration,
    'eWaste',
    '/review-workspace/' +
      encodeURIComponent(code) +
      '/impact-assessments' +
      (action === 'SELECT' ? '/selection' : action === 'RECOVER' ? '/recovery' : ''),
    command,
  );
}
