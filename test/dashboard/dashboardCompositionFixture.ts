import type { CmsComponentContract } from '../../src/cms/cmsContract';

// Delivery-shaped fixture matching the Axis core-v003 owner records.
export const dashboardFixture: CmsComponentContract = {
  code: 'axisDashboardWorkspaceComponent',
  typeCode: 'axisDashboardWorkspaceComponentType',
  renderer: 'axis.component.dashboard-workspace',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  properties: {
    title: 'Dashboard',
    defaultView: 'overview',
  },
  slot: 'workspace',
  index: 10,
  components: [
    {
      code: 'axisDashboardOverviewTab',
      typeCode: 'axisDashboardTabComponentType',
      renderer: 'axis.component.dashboard-tab',
      rendererContractVersion: 1,
      rendererChannels: ['web', 'mobile-webview'],
      rendererDeprecated: false,
      properties: {
        view: 'overview',
        title: 'Overview',
        description: 'Your applications, readiness and next decisions.',
      },
      slot: 'tabs',
      index: 10,
      components: [
        {
          code: 'axisDashboardOverviewTabMetrics',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'metrics',
            title: 'At a glance',
            published: 'Published',
            approval: 'Awaiting approval',
            preparing: 'In preparation',
            available: 'Available to set up',
            unknown: 'Status unavailable',
            configuration: 'Configuration notices',
            checked: 'application statuses verified',
            incomplete:
              'Some statuses are unavailable or stale. Counts show verified responses only.',
          },
          slot: 'sections',
          index: 10,
          components: [],
        },
        {
          code: 'axisDashboardOverviewTabApplications',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'applications',
            title: 'Your applications',
            published: 'Published',
            approval: 'Awaiting approval',
            preparing: 'In preparation',
            available: 'Available to set up',
            unknown: 'Status unavailable',
            previous: 'Previous applications',
            next: 'Next applications',
            steps: 'preparation steps verified',
            review: 'Review setup',
            empty: 'No applications are available for your account.',
          },
          slot: 'sections',
          index: 20,
          components: [],
        },
        {
          code: 'axisDashboardOverviewTabReadiness',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'readiness',
            title: 'Application readiness',
            published: 'Published',
            approval: 'Awaiting approval',
            preparing: 'In preparation',
            available: 'Available to set up',
            unknown: 'Status unavailable',
            description:
              'Current publication status across the available catalogue. Published content does not imply that every business dependency is ready.',
          },
          slot: 'sections',
          index: 30,
          components: [],
        },
        {
          code: 'axisDashboardOverviewTabAttention',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'attention',
            title: 'Needs your attention',
            unknown:
              'Status could not be verified. Refresh or review the owning service.',
            review: 'Review setup',
            empty: 'No pending decisions reported by the current status checks.',
          },
          slot: 'sections',
          index: 40,
          components: [],
        },
      ],
    },
    {
      code: 'axisDashboardApplicationsTab',
      typeCode: 'axisDashboardTabComponentType',
      renderer: 'axis.component.dashboard-tab',
      rendererContractVersion: 1,
      rendererChannels: ['web', 'mobile-webview'],
      rendererDeprecated: false,
      properties: {
        view: 'applications',
        title: 'Applications',
        description: 'Choose an application and review its setup journey.',
      },
      slot: 'tabs',
      index: 20,
      components: [
        {
          code: 'axisDashboardApplicationsTabSettings',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'settings',
            title: 'Review environment settings',
          },
          slot: 'sections',
          index: 10,
          components: [],
        },
        {
          code: 'axisDashboardApplicationsTabCatalogue',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'catalogue',
            title: 'Applications & services',
          },
          slot: 'sections',
          index: 20,
          components: [],
        },
        {
          code: 'axisDashboardApplicationsTabDetails',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'details',
            title: 'Setup plan',
          },
          slot: 'sections',
          index: 30,
          components: [],
        },
      ],
    },
    {
      code: 'axisDashboardTechnicalTab',
      typeCode: 'axisDashboardTabComponentType',
      renderer: 'axis.component.dashboard-tab',
      rendererContractVersion: 1,
      rendererChannels: ['web', 'mobile-webview'],
      rendererDeprecated: false,
      properties: {
        view: 'technical',
        title: 'Technical overview',
        description: 'Runtime health, readiness and operational workspaces.',
      },
      slot: 'tabs',
      index: 30,
      components: [
        {
          code: 'axisDashboardTechnicalTabContext',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'context',
            title: 'Runtime context',
          },
          slot: 'sections',
          index: 10,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabMetrics',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'metrics',
            title: 'Technical signals',
          },
          slot: 'sections',
          index: 20,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabReceipts',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'receipts',
            title: 'Repair results',
          },
          slot: 'sections',
          index: 30,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabRecovery',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'recovery',
            title: 'Go-live recovery',
          },
          slot: 'sections',
          index: 40,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabBlockers',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'blockers',
            title: 'Fix these first',
          },
          slot: 'sections',
          index: 50,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabWorkspaces',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'workspaces',
            title: 'Operational workspaces',
          },
          slot: 'sections',
          index: 60,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabTimeline',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'timeline',
            title: 'Readiness timeline',
          },
          slot: 'sections',
          index: 70,
          components: [],
        },
        {
          code: 'axisDashboardTechnicalTabFootnotes',
          typeCode: 'axisDashboardSectionComponentType',
          renderer: 'axis.component.dashboard-section',
          rendererContractVersion: 1,
          rendererChannels: ['web', 'mobile-webview'],
          rendererDeprecated: false,
          properties: {
            kind: 'footnotes',
            title: 'Runtime inventory',
          },
          slot: 'sections',
          index: 80,
          components: [],
        },
      ],
    },
  ],
};

// Delivery-shaped layout introduced by the immutable Axis core-v005 release.
export const mergedDashboardFixture: CmsComponentContract = {
  ...dashboardFixture,
  components: dashboardFixture.components.map((tab) => {
    const summary = dashboardFixture.components[0]!;
    const applications = dashboardFixture.components[1]!;
    const operational = dashboardFixture.components[2]!;
    if (tab.properties.view === 'overview')
      return {
        ...tab,
        properties: { ...tab.properties, layout: 'operational' },
        components: operational.components,
      };
    if (tab.properties.view !== 'applications') return tab;
    const byKind = new Map(
      [...summary.components, ...applications.components].map((section) => [
        section.properties.kind,
        section,
      ]),
    );
    return {
      ...tab,
      properties: { ...tab.properties, layout: 'summary' },
      components: [
        'metrics',
        'catalogue',
        'applications',
        'readiness',
        'attention',
        'details',
      ].map((kind, index) => ({ ...byKind.get(kind)!, index: index * 10 })),
    };
  }),
};

// core-v006 restores every original Applications section, without a second catalogue.
export const completeApplicationsFixture: CmsComponentContract = {
  ...mergedDashboardFixture,
  components: mergedDashboardFixture.components.map((tab) => {
    if (tab.properties.view !== 'applications') return tab;
    const sections = new Map(
      [...dashboardFixture.components[1]!.components, ...tab.components].map(
        (section) => [section.properties.kind, section],
      ),
    );
    return {
      ...tab,
      components: [
        'metrics',
        'settings',
        'catalogue',
        'readiness',
        'attention',
        'details',
      ].map((kind, index) => ({ ...sections.get(kind)!, index: index * 10 })),
    };
  }),
};

// core-v007 preserves the union of Overview and Applications sections.
export const fullMergedApplicationsFixture: CmsComponentContract = {
  ...completeApplicationsFixture,
  components: completeApplicationsFixture.components.map((tab) => {
    if (tab.properties.view !== 'applications') return tab;
    const artwork = dashboardFixture.components[0]!.components.find(
      (section) => section.properties.kind === 'applications',
    )!;
    const operations: CmsComponentContract = {
      ...artwork,
      code: 'axisDashboardOverviewTabOperations',
      properties: {
        kind: 'operations',
        title: 'Operational pulse',
        checked: 'Last assessed',
        details: 'reported issues',
        review: 'Open workspace',
        empty: 'Operational evidence is not available.',
        ready: 'Ready',
        needsAttention: 'Needs attention',
        unknown: 'Not verified',
        areas: {
          runtimeCommunication: {
            title: 'Connected services',
            metric: 'serverCount',
            label: 'reported runtime servers',
          },
          imports: {
            title: 'Business data',
            metric: 'releaseCount',
            label: 'available data releases',
          },
          approval: {
            title: 'Approval workload',
            metric: 'pendingApprovalCount',
            label: 'pending application approvals',
          },
          media: {
            title: 'Media library',
            metric: 'mediaObjectCount',
            label: 'reported media objects',
          },
          search: {
            title: 'Search & discovery',
            metric: 'initializedEngineCount',
            label: 'initialized search engines',
          },
          assistant: {
            title: 'Knowledge & assistance',
            metric: 'indexedSourceCount',
            label: 'indexed knowledge sources',
          },
        },
      },
    };
    const sections = new Map(
      [...tab.components, artwork, operations].map((section) => [
        section.properties.kind,
        section,
      ]),
    );
    return {
      ...tab,
      components: [
        'metrics',
        'settings',
        'catalogue',
        'applications',
        'readiness',
        'attention',
        'details',
        'operations',
      ].map((kind, index) => ({ ...sections.get(kind)!, index: index * 10 })),
    };
  }),
};
