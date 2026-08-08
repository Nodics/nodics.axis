import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';
import { MediaManagementWorkspaceRenderer } from '../../../../../src/cms/renderers/components/media/MediaManagementWorkspaceRenderer';
import type { AxisAuthenticatedBootstrap } from '../../../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../../../src/runtime/runtimeConfig';

vi.mock(
  '../../../../../src/operations/mediaManagement/MediaManagementRoutePage',
  () => ({
    MediaManagementRoutePage: (props: {
      readonly mediaDetailPresentation?: {
        readonly detailSections?: readonly string[];
        readonly metadataFields?: readonly { readonly key: string }[];
      };
    }) => (
      <section aria-label="Mock Media Management">
        <span>Media workspace</span>
        <span>
          {props.mediaDetailPresentation?.detailSections?.join(',') ??
            'default sections'}
        </span>
        <span>
          {props.mediaDetailPresentation?.metadataFields
            ?.map((field) => field.key)
            .join(',') ?? 'default metadata'}
        </span>
      </section>
    ),
  }),
);

const component: CmsComponentContract = {
  code: 'axisMediaManagementWorkspaceComponent',
  typeCode: 'axisMediaManagementWorkspaceComponentType',
  renderer: 'axis.component.media-management-workspace',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  properties: {
    title: 'Media Management',
    introduction: 'Use nMedia-owned contracts.',
    backendAuthority: 'nMedia owns media operations.',
    customizationBoundary: 'Customize presentation without moving backend authority.',
    detailSections: ['actions', 'preview', 'metadata'],
    metadataFields: [
      { key: 'folderCode', label: 'Folder' },
      { key: 'mimeType', label: 'MIME type' },
    ],
  },
  slot: 'workspace',
  index: 10,
  components: [],
};

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
  enterpriseCode: 'default',
  projectCode: 'kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 1_000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1_024,
  assistantReconnectWindowMs: 1_000,
  assistantIdleTimeoutMs: 1_000,
};

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [],
  environments: ['startioLocal'],
  moduleCatalog: {},
  moduleConnections: {},
  documentationSources: [],
  tenantCode: 'default',
};

describe('MediaManagementWorkspaceRenderer', () => {
  it('renders through the CMS component contract when a controller is supplied', () => {
    render(
      <MediaManagementWorkspaceRenderer
        actions={{
          mediaManagement: {
            accessToken: 'token',
            bootstrap,
            runtime,
          },
        }}
        component={component}
      />,
    );

    expect(screen.getByLabelText('Mock Media Management')).toBeVisible();
    expect(screen.getByText('actions,preview,metadata')).toBeVisible();
    expect(screen.getByText('folderCode,mimeType')).toBeVisible();
  });

  it('fails closed when rendered without its media controller', () => {
    expect(() =>
      render(<MediaManagementWorkspaceRenderer component={component} />),
    ).toThrow(/requires its presentation controller/);
  });

  it('rejects unsupported CMS-driven media detail sections', () => {
    expect(() =>
      render(
        <MediaManagementWorkspaceRenderer
          actions={{
            mediaManagement: {
              accessToken: 'token',
              bootstrap,
              runtime,
            },
          }}
          component={{
            ...component,
            properties: {
              ...component.properties,
              detailSections: ['preview', 'unknown-section'],
            },
          }}
        />,
      ),
    ).toThrow(/detailSections\[1\]/);
  });
});
