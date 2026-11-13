import type {
  AxisNavigationItem,
  AxisModuleConnection,
  AxisAuthenticatedBootstrap,
} from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
export const connection: AxisModuleConnection = {
  moduleName: 'installer',
  instanceId: 'fixture-owner',
  environment: 'test',
  endpoint: 'https://builder.invalid/installer',
  state: 'UP',
};
export const configuration = {
  accessToken: 'synthetic-not-a-credential',
  sessionGeneration: 1,
  enterpriseCode: 'fixture',
  timeoutMs: 1000,
};
export const presentation = {
  introduction: 'Review the selected workspace.',
  preview: 'Planning preview',
  reserved: 'Application creation is reserved. A plan creates nothing.',
  prerequisite: 'An approved workspace must be selected.',
  formTitle: 'Prepare plan',
  workspaceRoot: 'Approved workspace',
  applicationName: 'Application name',
  companySiteName: 'Company site',
  accelerator: 'Family',
  environment: 'Environment',
  plan: 'Review plan',
  refresh: 'Refresh Builder availability',
  planTitle: 'Reviewed plan',
  vendorRepositories: 'Required repositories',
  customerProjects: 'Customer projects',
  firstEnvironment: 'First environment',
  dryRun: 'Dry run only. Nothing created.',
};
export const info = {
  apiOperationsEnabled: true,
  mutatingOperationsEnabled: false,
  workspaceAccessConfigured: true,
  presentation,
  planningOptions: {
    supportedAccelerators: ['apparel', 'telco'],
    defaultAccelerator: 'apparel',
    defaultEnvironment: 'local',
    nameMaxLength: 128,
  },
};
export const operations = [
  {
    code: 'setup.plan',
    label: 'Review plan',
    mutating: false,
    executable: true,
    state: 'AVAILABLE',
  },
  {
    code: 'lifecycle.start',
    label: 'Start',
    mutating: true,
    executable: false,
    state: 'RESERVED',
  },
];
export const plan = {
  valid: true,
  messages: [],
  plan: {
    vendorRepositories: ['nodics.ai', 'nodics.axis'],
    customerProjects: ['example.app'],
    firstEnvironment: 'local',
    dryRunOnly: true,
  },
};
export const envelope = (data: unknown) => ({
  code: 'SUC_IST_00000',
  contractVersion: 'installer-api-scope/v0',
  status: 'SUCCESS',
  data,
});
export const navigation: AxisNavigationItem = {
  id: 'builder',
  order: 1,
  category: 'platform',
  icon: 'settings',
  label: 'Application Builder',
  moduleName: 'installer',
  route: '/application-builder',
  featureState: 'PREVIEW',
  availability: 'UP',
  lifecycleActions: [
    {
      id: 'installer-plan',
      order: 30,
      label: 'Review plan',
      intent: 'READ',
      ownerModule: 'installer',
      handlerAction: 'setup.plan',
      featureState: 'ACTIVE',
      httpMethod: 'POST',
      operationRoute: '/nodics/installer/v0/setup/plan',
    },
  ],
  backendWorkspace: {
    tabs: [],
    contractVersion: 1,
    renderer: 'axis.workspace.native',
    workspaceCode: 'installer.applicationBuilder',
    viewCode: 'overview',
    title: 'Application Builder',
  },
};
export const bootstrap = {
  tenantCode: 'fixture',
  moduleConnections: { installer: [connection] },
} as unknown as AxisAuthenticatedBootstrap;
export const runtime = {
  enterpriseCode: 'fixture',
  requestTimeoutMs: 1000,
} as AxisRuntimeConfig;
