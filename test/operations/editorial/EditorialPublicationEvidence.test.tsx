import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import type { WorkbenchRendererController } from '../../../src/cms/renderers/shared/rendererTypes';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import { EditorialArticleWorkbenchDetail } from '../../../src/operations/editorial/EditorialArticleWorkbenchDetail';
import { editorialPublicationPath } from '../../../src/operations/editorial/editorialPublicationPresentation';

const bootstrap = {
  navigation: [
    {
      moduleName: 'publish',
      route: '/publishing/requests',
      featureState: 'ACTIVE',
      availability: 'UP',
    },
  ],
  moduleConnections: {
    publish: [
      {
        moduleName: 'publish',
        instanceId: 'source',
        endpoint: 'http://localhost:4312/nodics/publish',
        server: 'content',
        environment: 'local',
        state: 'UP',
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
const schema = {
  schemaName: 'editorialArticle',
  connectionServer: 'content',
  connectionEnvironment: 'local',
  fields: [],
} as unknown as WorkbenchSchema;

describe('Editorial publication evidence', () => {
  it('presents a recorded reference without claiming a live version or performing a publication read or write', () => {
    const updateRecord = vi.fn();
    const controller = {
      bootstrap,
      accessToken: 'private-employee-token',
      enterpriseCode: 'default',
      locale: 'en',
      runtime: { requestTimeoutMs: 1000 },
      relationshipRuntime: { schemas: [] },
      updateRecord,
      closeRecord: vi.fn(),
    } as unknown as WorkbenchRendererController;
    render(
      <MemoryRouter>
        <EditorialArticleWorkbenchDetail
          controller={controller}
          schema={schema}
          record={{
            code: 'article-a',
            internalName: 'A business update',
            status: 'APPROVED',
            publicationCode: 'article-a-publication-r1',
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Publication reference recorded')).toBeVisible();
    expect(
      screen.queryByText(
        /Live version exists|previous live version|previous published version/i,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inspect publication' })).toHaveAttribute(
      'href',
      '/publishing/requests?publicationCode=article-a-publication-r1&sourceServer=content&sourceEnvironment=local',
    );
    expect(updateRecord).not.toHaveBeenCalled();
  });
  it.each(['DISABLED', 'HIDDEN'])(
    'does not offer an %s inspection destination',
    (featureState) => {
      const context = {
        ...bootstrap,
        navigation: bootstrap.navigation.map((item) => ({ ...item, featureState })),
      } as AxisAuthenticatedBootstrap;
      expect(
        editorialPublicationPath(context, schema, 'publication-a'),
      ).toBeUndefined();
    },
  );
  it('rejects unqualified, unavailable, foreign and ambiguous source matches', () => {
    const source = bootstrap.moduleConnections.publish![0]!;
    expect(
      editorialPublicationPath(
        bootstrap,
        { ...schema, connectionServer: undefined },
        'publication-a',
      ),
    ).toBeUndefined();
    for (const sources of [
      [],
      [{ ...source, state: 'DOWN' }],
      [{ ...source, environment: 'other' }],
      [source, { ...source, instanceId: 'duplicate' }],
    ]) {
      expect(
        editorialPublicationPath(
          {
            ...bootstrap,
            moduleConnections: { publish: sources },
          } as AxisAuthenticatedBootstrap,
          schema,
          'publication-a',
        ),
      ).toBeUndefined();
    }
    expect(editorialPublicationPath(bootstrap, schema, '../foreign')).toBeUndefined();
  });
  it('holds duplicate inspection routes or a route published by a different owner', () => {
    for (const navigation of [
      [...bootstrap.navigation, ...bootstrap.navigation],
      bootstrap.navigation.map((item) => ({ ...item, moduleName: 'other' })),
    ]) {
      expect(
        editorialPublicationPath({ ...bootstrap, navigation }, schema, 'publication-a'),
      ).toBeUndefined();
    }
  });
});
