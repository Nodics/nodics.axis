import type { ReactNode } from 'react';

import type { AxisSort } from '../../../app/table/axisTableSorting';
import type { AssistantPresentationState } from '../../../assistant/presentation/assistantPresentationContracts';
import type { AssistantKnowledgeStatus } from '../../../assistant/api/assistantContracts';
import type { AxisAuthenticatedBootstrap } from '../../../bootstrap/publicBootstrap';
import type {
  AxisNavigationDetailPanel,
  AxisNavigationLifecycleAction,
} from '../../../bootstrap/publicBootstrap';
import type { AxisWorkbenchPresentation } from '../../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../runtime/runtimeConfig';
import type {
  WorkbenchFilterGroup,
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
  WorkbenchDeleteImpact,
} from '../../../workbench/api/workbenchContracts';
import type { WorkbenchSavedView } from '../../../workbench/preferences/workbenchPreferences';
import type { WorkbenchRelationshipRuntime } from '../../../workbench/form/WorkbenchRelationshipRuntime';
import type { WorkbenchRecordDetailPanel } from '../../../workbench/detail/workbenchRecordDetailPanels';
import type { CmsComponentContract, CmsPageContract } from '../../cmsContract';

export interface AssistantRendererController {
  readonly state: AssistantPresentationState;
  readonly submit: (message: string) => Promise<void>;
  readonly cancel: () => Promise<void>;
  readonly selectConversation: (conversationCode: string) => Promise<void>;
  readonly newConversation: () => void;
  readonly loadMoreConversations: () => Promise<void>;
  readonly loadMoreHistory: () => Promise<void>;
  readonly approveConfirmation: () => Promise<void>;
  readonly rejectConfirmation: () => Promise<void>;
  readonly executeConfirmation: () => Promise<void>;
  readonly knowledgeStatus?: AssistantKnowledgeStatus | undefined;
  readonly knowledgeLoading?: boolean | undefined;
  readonly knowledgeError?: string | undefined;
  readonly refreshingKnowledgeSource?: string | undefined;
  readonly refreshKnowledgeSource?: (sourceCode: string) => Promise<void>;
}

export interface WorkbenchRendererController {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly scope?: WorkbenchRendererScope | undefined;
  readonly schemas: readonly WorkbenchSchema[];
  readonly schemasError?: string | undefined;
  readonly schemasLoading: boolean;
  readonly selectedSchema?: WorkbenchSchema | undefined;
  readonly records: readonly WorkbenchRecord[];
  readonly recordSearch: string;
  readonly recordFilters?: WorkbenchFilterGroup | undefined;
  readonly recordPageNumber: number;
  readonly recordPageSize: number;
  readonly recordTotalCount: number;
  readonly recordSort: AxisSort;
  readonly recordSortOverride?: AxisSort | undefined;
  readonly visibleColumns: readonly string[];
  readonly favoriteSchemas: readonly string[];
  readonly recentSchemas: readonly string[];
  readonly selectedRecordKeys: readonly string[];
  readonly savedViews: readonly WorkbenchSavedView[];
  readonly recordsError?: string | undefined;
  readonly recordsLoading: boolean;
  readonly createError?: string | undefined;
  readonly creating: boolean;
  readonly createOpen: boolean;
  readonly relationshipRuntime: WorkbenchRelationshipRuntime;
  readonly openedReferenceRecord?:
    | {
        readonly record: WorkbenchRecord;
        readonly reference: string;
        readonly relationship: WorkbenchRelationship;
        readonly schema: WorkbenchSchema;
      }
    | undefined;
  readonly selectedRecord?: WorkbenchRecord | undefined;
  readonly selectedRecordDetailPanels?:
    | readonly WorkbenchRecordDetailPanel[]
    | undefined;
  readonly editOpen: boolean;
  readonly updateError?: string | undefined;
  readonly updating: boolean;
  readonly deleteOpen: boolean;
  readonly deleteError?: string | undefined;
  readonly deleting: boolean;
  readonly deleteImpact?: WorkbenchDeleteImpact | undefined;
  readonly deleteImpactLoading?: boolean;
  readonly bulkDeleteError?: string | undefined;
  readonly bulkDeleting?: boolean;
  readonly lifecycleActionError?: string | undefined;
  readonly lifecycleActionPendingId?: string | undefined;
  readonly lifecycleActionResult?: unknown;
  readonly tenantCode: string;
  readonly enterpriseCode: string;
  readonly locale?: string | undefined;
  readonly selectSchema: (schema: WorkbenchSchema) => void;
  readonly setRecordSearch: (search: string) => void;
  readonly setRecordFilters: (filters?: WorkbenchFilterGroup) => void;
  readonly setRecordPageNumber: (pageNumber: number) => void;
  readonly setRecordPageSize: (pageSize: number) => void;
  readonly setRecordSort: (sort: AxisSort) => void;
  readonly setRecordSortOverride: (sort: AxisSort | undefined) => void;
  readonly setVisibleColumns: (columns: readonly string[]) => void;
  readonly toggleFavoriteSchema: (schema: WorkbenchSchema) => void;
  readonly setSelectedRecordKeys: (keys: readonly string[]) => void;
  readonly saveView: (view: WorkbenchSavedView) => void;
  readonly deleteView: (name: string) => void;
  readonly applyView: (view: WorkbenchSavedView) => void;
  readonly beginCreate: () => void;
  readonly cancelCreate: () => void;
  readonly createRecord: (model: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly openReferenceRecord?: (
    relationship: WorkbenchRelationship,
    reference: string,
  ) => Promise<void>;
  readonly closeReferenceRecord?: () => void;
  readonly selectRecord: (record: WorkbenchRecord) => void;
  readonly closeRecord: () => void;
  readonly beginEdit: () => void;
  readonly cancelEdit: () => void;
  readonly updateRecord: (model: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly beginDelete: () => void;
  readonly cancelDelete: () => void;
  readonly confirmDelete: () => Promise<void>;
  readonly bulkDeleteSelected?: () => Promise<void>;
  readonly executeLifecycleAction?: (
    action: AxisNavigationLifecycleAction,
    record: WorkbenchRecord,
    input?: Readonly<Record<string, string>>,
  ) => Promise<unknown>;
  readonly retrySchemas: () => void;
  readonly retryRecords: () => void;
}

export interface WorkbenchRendererScope {
  readonly kind: 'global' | 'navigation';
  readonly navigationId?: string | undefined;
  readonly label?: string | undefined;
  readonly parentLabel?: string | undefined;
  readonly help?:
    | {
        readonly summary: string;
        readonly documentationRoute?: string | undefined;
        readonly documentationFragment?: string | undefined;
      }
    | undefined;
  readonly detailPanels?: readonly AxisNavigationDetailPanel[] | undefined;
  readonly lifecycleActions?: readonly AxisNavigationLifecycleAction[] | undefined;
  readonly workbenchPresentation?: AxisWorkbenchPresentation | undefined;
}

export interface MediaManagementRendererController {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

export interface CmsRendererActions {
  readonly onEmployeeLogin?: (loginId: string, password: string) => void;
  readonly onEmployeeRecovery?: (identifier: string) => void;
  readonly onEmployeeUnlock?: (password: string) => void;
  readonly onEmployeeSignOut?: () => void;
  readonly currentEmployeeId?: string;
  readonly authenticationError?: string;
  readonly assistant?: AssistantRendererController | undefined;
  readonly workbench?: WorkbenchRendererController | undefined;
  readonly mediaManagement?: MediaManagementRendererController | undefined;
}

export interface CmsComponentRendererProps {
  readonly component: CmsComponentContract;
  readonly actions?: CmsRendererActions | undefined;
}

export interface CmsTemplateRendererProps {
  readonly page: CmsPageContract;
  readonly children: ReactNode;
}

export interface CmsPagePresentationProps {
  readonly page: CmsPageContract;
  readonly actions?: CmsRendererActions | undefined;
}
