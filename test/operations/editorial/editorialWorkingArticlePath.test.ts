import { describe, expect, it } from 'vitest';
import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
} from '../../../src/bootstrap/publicBootstrap';
import { editorialWorkingArticlePath } from '../../../src/operations/editorial/editorialPublicationPresentation';
import type { PublicationInspection } from '../../../src/operations/contentExperience/api/publicationInspectionClient';
const source = {
  moduleName: 'publish',
  server: 'content',
  environment: 'local',
  state: 'UP',
} as AxisModuleConnection;
const publication = {
  code: 'request-a',
  domain: 'editorial',
  rootType: 'article',
  rootCode: 'article-a',
  state: 'ROLLED_BACK',
  revision: 7,
} as PublicationInspection;
const context = {
  navigation: [
    {
      id: 'editorial-articles',
      moduleName: 'editorial',
      route: '/content/editorial/articles',
      featureState: 'ACTIVE',
      availability: 'UP',
      workbenchTarget: { moduleName: 'editorial', schemaName: 'editorialArticle' },
    },
  ],
  moduleConnections: {
    editorial: [
      {
        ...source,
        moduleName: 'editorial',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
describe('current working article handoff', () => {
  it('uses the admitted canonical all-types route and existing search contract, independently of historical state', () => {
    expect(editorialWorkingArticlePath(context, source, publication)).toBe(
      '/content/editorial/articles?module=editorial&schema=editorialArticle&search=article-a',
    );
    expect(
      editorialWorkingArticlePath(
        {
          ...context,
          navigation: context.navigation.map((item) => ({
            ...item,
            route: '/customer/articles',
          })),
        },
        source,
        publication,
      ),
    ).toContain('/customer/articles?');
  });
  it('holds foreign, invalid, unavailable and ambiguous origins rather than choosing a first schema', () => {
    for (const change of [
      { domain: 'cms' },
      { rootType: 'page' },
      { rootCode: '../other' },
      { rootCode: undefined },
    ])
      expect(
        editorialWorkingArticlePath(context, source, { ...publication, ...change }),
      ).toBeUndefined();
    for (const origins of [
      [],
      [{ ...context.moduleConnections.editorial![0]!, server: 'other' }],
      [{ ...context.moduleConnections.editorial![0]!, state: 'UNAVAILABLE' as const }],
      [
        {
          ...context.moduleConnections.editorial![0]!,
          runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' },
        },
      ],
      [
        context.moduleConnections.editorial![0]!,
        { ...context.moduleConnections.editorial![0]!, server: 'other' },
      ],
    ])
      expect(
        editorialWorkingArticlePath(
          { ...context, moduleConnections: { editorial: origins } },
          source,
          publication,
        ),
      ).toBeUndefined();
  });
  it('requires a unique active canonical authoring target without conflicting fixed filters', () => {
    for (const change of [
      { featureState: 'DISABLED' },
      { featureState: 'HIDDEN' },
      { availability: 'UNAVAILABLE' },
      { workbenchTarget: undefined },
      { route: '//foreign/articles' },
      {
        workbenchPresentation: {
          fixedFilters: [{ field: 'contentTypeCode', value: 'NEWS' }],
        },
      },
    ])
      expect(
        editorialWorkingArticlePath(
          {
            ...context,
            navigation: [{ ...context.navigation[0]!, ...change }],
          } as AxisAuthenticatedBootstrap,
          source,
          publication,
        ),
      ).toBeUndefined();
    expect(
      editorialWorkingArticlePath(
        { ...context, navigation: [...context.navigation, ...context.navigation] },
        source,
        publication,
      ),
    ).toBeUndefined();
  });
});
