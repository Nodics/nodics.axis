import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import { AxisOverviewDashboard } from '../../src/dashboard/AxisOverviewDashboard';
import { overviewState, type Entry } from '../../src/dashboard/overviewStatus';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { CmsComponentContract } from '../../src/cms/cmsContract';
import { dashboardFixture } from './dashboardCompositionFixture';
import * as artworkClient from '../../src/operations/setupAccelerators/api/applicationArtworkClient';

const sections = dashboardFixture.components[0]!.components;
const extra = (
  kind: string,
  properties: CmsComponentContract['properties'],
): CmsComponentContract => ({
  ...sections[0]!,
  code: kind,
  properties: { kind, ...properties },
});
const docs = extra('documentation', {
  title: 'Documentation & guidance',
  published: 'Published',
  unknown: 'Unavailable',
  review: 'Review documentation',
  empty: 'No packs',
  route: '/setup-accelerators',
});
const ops = extra('operations', {
  title: 'Operational pulse',
  checked: 'Last assessed',
  details: 'issues',
  review: 'Open workspace',
  empty: 'Evidence unavailable',
  ready: 'Ready',
  needsAttention: 'Needs review',
  unknown: 'Unavailable',
  areas: {
    imports: { title: 'Data imports', metric: 'releaseCount', label: 'releases' },
  },
});
const entry = (code: string, kind = 'PROJECT', readiness = 'READY') =>
  ({
    profile: {
      code,
      title: code,
      kind,
      type: kind === 'DOCUMENTATION' ? 'DOCUMENTATION_BUNDLE' : 'CMS_BASELINE',
      category: kind,
      summary: code + ' summary',
    },
    query: { isError: false, isPending: false, data: { readiness } },
  }) as Entry;
const bootstrap = {
  navigation: [],
  operationalReadiness: undefined,
} as unknown as AxisAuthenticatedBootstrap;
function show(
  entries: Entry[],
  selected: readonly CmsComponentContract[] = [...sections, docs, ops],
  override = bootstrap,
) {
  return render(
    <MemoryRouter>
      <AxisThemeProvider>
        <AxisOverviewDashboard
          entries={entries}
          sections={selected}
          findings={[]}
          review={vi.fn()}
          bootstrap={override}
        />
      </AxisThemeProvider>
    </MemoryRouter>,
  );
}
describe('project overview evidence boundaries', () => {
  it('makes each attention row one review action and retains expandable repair guidance', () => {
    const review = vi.fn();
    const renderAttention = (callback: typeof review | undefined) => (
      <MemoryRouter>
        <AxisThemeProvider>
          <AxisOverviewDashboard
            bootstrap={bootstrap}
            entries={[entry('Storefront', 'PROJECT', 'BLOCKED')]}
            sections={sections.filter(
              (section) => section.properties.kind === 'attention',
            )}
            findings={[
              {
                code: 'DEFAULT_CREDENTIAL',
                severity: 'WARNING',
                message: 'Review default credential',
                action: 'Rotate through the owning configuration.',
                owner: 'Profile',
                ownerType: 'MODULE',
                dismissible: false,
                auditRequired: true,
              },
            ]}
            review={callback}
          />
        </AxisThemeProvider>
      </MemoryRouter>
    );
    const view = render(renderAttention(review));
    const row = screen.getByRole('button', { name: 'Review setup: Storefront' });
    expect(within(row).getByText('Storefront')).toBeInTheDocument();
    expect(row.querySelector('button')).toBeNull();
    fireEvent.click(row);
    expect(review).toHaveBeenCalledExactlyOnceWith('Storefront');
    const disclosure = screen.getByText('Review default credential').closest('details');
    expect(disclosure).not.toHaveAttribute('open');
    expect(disclosure).toHaveTextContent('Rotate through the owning configuration.');
    expect(disclosure).toHaveTextContent('Profile');
    view.rerender(renderAttention(undefined));
    expect(
      screen.queryByRole('button', { name: 'Review setup: Storefront' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Storefront')).toBeInTheDocument();
  });
  it('keeps an empty publication chart distinct from a zero-percent published catalogue', () => {
    show(
      [],
      sections.filter((section) => section.properties.kind === 'readiness'),
    );
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Published: 0/);
  });
  it('uses one permanent documentation cover across packs and states without application media', () => {
    const loadArtwork = vi.spyOn(artworkClient, 'loadApplicationArtwork');
    const packs = ['NOT_IMPORTED', 'READY', 'BLOCKED'].map((state, index) => {
      const pack = entry('Documentation ' + index, 'DOCUMENTATION', state);
      const profile = {
        ...pack.profile,
        requiredFunctionalModules: [],
        visual: {
          mediaCode: 'accelerator-cover',
          alt: 'Accelerator artwork must not be used',
          runtimeRole: 'WCMS_STAGED',
          active: true,
        },
      };
      return {
        ...pack,
        profile,
        query: {
          ...pack.query!,
          data: { ...pack.query!.data!, profile },
        },
      };
    });
    show(packs, [docs]);
    const covers = screen
      .getByRole('region', { name: 'Documentation & guidance' })
      .querySelectorAll('img');
    expect(covers).toHaveLength(3);
    for (const cover of covers) {
      expect(cover).toHaveAttribute('src', '/brand/documentation-cover-v2.png');
      expect(cover).toHaveAttribute('alt', '');
    }
    expect(loadArtwork).not.toHaveBeenCalled();
    loadArtwork.mockRestore();
  });
  it('separates documentation from application totals, chart and gallery', () => {
    show([entry('Storefront'), entry('Project docs', 'DOCUMENTATION')]);
    expect(
      screen.getByText(/1 \/ 1 application statuses verified/),
    ).toBeInTheDocument();
    const gallery = screen.getAllByRole('region', { name: 'Your applications' })[0]!;
    expect(within(gallery).queryByText('Project docs')).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Documentation & guidance' }),
      ).getByText('Project docs'),
    ).toBeInTheDocument();
  });
  it('does not restore omitted CMS sections or invent operational health', () => {
    show([], [ops]);
    expect(screen.getAllByText('Evidence unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText('Documentation & guidance')).not.toBeInTheDocument();
    expect(screen.queryByText('Your applications')).not.toBeInTheDocument();
  });
  it('does not expose a workspace link unless navigation authorizes it', () => {
    const operationalReadiness = {
      contractVersion: 1,
      state: 'NEEDS_ATTENTION' as const,
      checkedAt: '2026-09-25T12:00:00Z',
      source: 'test',
      summary: {},
      sections: [
        {
          key: 'imports',
          title: 'Data imports',
          businessStatus: 'NEEDS_ATTENTION',
          ownerModule: 'nImport',
          source: 'test',
          route: '/ungranted',
          summary: { releaseCount: 8 },
          blockers: [],
          nextAction: 'Inspect evidence',
        },
      ],
    };
    show([], [ops], {
      ...bootstrap,
      operationalReadiness,
    });
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open workspace' }),
    ).not.toBeInTheDocument();
  });
  it('classifies blocked and rolled back applications as requiring attention', () => {
    for (const state of ['BLOCKED', 'REJECTED', 'ROLLED_BACK', 'RETIRED']) {
      expect(overviewState(entry('Application', 'PROJECT', state))).toBe('blocked');
    }
    expect(overviewState(entry('Application', 'PROJECT', 'NOT_IMPORTED'))).toBe(
      'available',
    );
  });
  it('shows reported zero, but never substitutes zero for missing operational evidence', () => {
    show([], [ops], {
      ...bootstrap,
      operationalReadiness: {
        contractVersion: 1,
        state: 'READY',
        checkedAt: '2026-09-25T12:00:00Z',
        source: 'test',
        summary: {},
        sections: [
          {
            key: 'imports',
            title: 'Imports',
            businessStatus: 'READY',
            source: 'test',
            ownerModule: 'nImport',
            route: '/operations/imports-exports',
            summary: { releaseCount: 0 },
            blockers: [],
            nextAction: 'Review data',
          },
        ],
      },
      navigation: [
        {
          id: 'imports',
          label: 'Imports',
          route: '/operations/imports-exports',
          order: 1,
          icon: 'import',
          moduleName: 'nImport',
          category: 'system',
          availability: 'UP',
        },
      ],
    });
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open workspace' })).toHaveAttribute(
      'href',
      '/operations/imports-exports',
    );
  });
});
