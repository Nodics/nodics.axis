import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';
import { DocumentationNavigationRenderer } from '../../../../../src/cms/renderers/components/documentation/DocumentationNavigationRenderer';

const navigation: CmsComponentContract = {
  code: 'nodicsDocumentationNavigation',
  typeCode: 'nodicsDocumentationNavigationComponentType',
  renderer: 'documentation.component.navigation',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  properties: {
    title: 'Documentation',
    searchLabel: 'Search documentation',
    searchPlaceholder: 'Search pages, categories, and audiences',
    emptyMessage: 'No documentation matches your search.',
    items: [
      {
        title: 'What Nodics Is',
        route: '/docs/overview/what-is-nodics',
        sectionTitle: 'Documentation Roadmap',
        sectionOrder: 10,
        groupTitle: 'Framework Orientation',
        groupOrder: 10,
        subgroupTitle: 'Start Safely',
        order: 10,
        audience: ['business', 'developer'],
      },
      {
        title: 'Why Nodics Exists',
        route: '/docs/overview/why-nodics-exists',
        sectionTitle: 'Documentation Roadmap',
        sectionOrder: 10,
        groupTitle: 'Framework Orientation',
        groupOrder: 10,
        order: 20,
        audience: ['business', 'developer'],
      },
      {
        title: 'Configure Security',
        route: '/docs/security/configure-security',
        sectionTitle: 'Administration',
        sectionOrder: 20,
        groupTitle: 'Security Controls',
        groupOrder: 10,
        order: 20,
        audience: ['operator'],
        searchText: 'security access role permission',
      },
      {
        title: 'Unsafe route',
        route: 'javascript:alert(1)',
        category: 'security',
        audience: ['operator'],
      },
    ],
  },
  slot: 'navigation',
  index: 5,
  components: [],
};

describe('DocumentationNavigationRenderer', () => {
  it('searches bounded CMS navigation metadata and rejects unsafe routes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/docs/overview/what-is-nodics']}>
        <DocumentationNavigationRenderer component={navigation} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /What Nodics Is/ })).toHaveAttribute(
      'href',
      '/docs/overview/what-is-nodics',
    );
    expect(screen.queryByText('Unsafe route')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Search documentation'), 'security');

    expect(screen.getByRole('link', { name: 'Configure Security' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /What Nodics Is/ }),
    ).not.toBeInTheDocument();
  });

  it('finds later frozen article content without widening published route admission', async () => {
    const lateContent = `${'Opening context. '.repeat(2000)}MongoDB default database names`;
    render(
      <MemoryRouter>
        <DocumentationNavigationRenderer
          component={{
            ...navigation,
            properties: {
              ...navigation.properties,
              items: [
                {
                  title: 'Configuration reference',
                  route: '/docs/configuration',
                  searchText: lateContent,
                },
                {
                  title: 'Unpublished configuration',
                  route: '/docs/unpublished',
                  searchText: lateContent,
                },
              ],
            },
          }}
          actions={{ documentationTopicRoutes: new Set(['/docs/configuration']) }}
        />
      </MemoryRouter>,
    );
    await userEvent
      .setup()
      .type(screen.getByLabelText('Search documentation'), 'mongodb default database');
    expect(screen.getByRole('link', { name: 'Configuration reference' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Unpublished configuration' }),
    ).toBeNull();
    expect(screen.queryByText(lateContent)).toBeNull();
  });

  it('does not coerce malformed search metadata into matching content', async () => {
    render(
      <MemoryRouter>
        <DocumentationNavigationRenderer
          component={{
            ...navigation,
            properties: {
              ...navigation.properties,
              items: [
                {
                  title: 'Configuration reference',
                  route: '/docs/configuration',
                  searchText: { secret: 'MongoDB default database' },
                },
              ],
            },
          }}
        />
      </MemoryRouter>,
    );
    await userEvent
      .setup()
      .type(screen.getByLabelText('Search documentation'), 'mongodb default database');
    expect(screen.queryByRole('link', { name: 'Configuration reference' })).toBeNull();
    expect(screen.getByText('No documentation matches your search.')).toBeVisible();
  });

  it('omits unpublished items from the delivered navigation component in the reader', () => {
    render(
      <MemoryRouter>
        <DocumentationNavigationRenderer
          component={navigation}
          actions={{
            documentationTopicRoutes: new Set(['/docs/security/configure-security']),
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Configure Security' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /What Nodics Is/ }),
    ).not.toBeInTheDocument();
  });

  it('shows a CMS-owned empty state when no article matches', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationNavigationRenderer component={navigation} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Search documentation'), 'no-match');
    expect(
      screen.getByText('No documentation matches your search.'),
    ).toBeInTheDocument();
  });

  it('clears the search and restores the complete authorized page list', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationNavigationRenderer component={navigation} />
      </MemoryRouter>,
    );

    const search = screen.getByLabelText('Search documentation');
    expect(screen.queryByText('⌕')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear documentation search' }),
    ).not.toBeInTheDocument();

    await user.type(search, 'security');
    expect(
      screen.queryByRole('link', { name: 'What Nodics Is' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Clear documentation search' }),
    );

    expect(search).toHaveValue('');
    expect(screen.getByRole('link', { name: /What Nodics Is/ })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Configure Security' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Clear documentation search' }),
    ).not.toBeInTheDocument();
  });

  it('renders backend hierarchy as expandable sections with direct page links', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationNavigationRenderer component={navigation} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: 'Collapse Documentation Roadmap' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Collapse Framework Orientation' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Start Safely')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'What Nodics Is' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Why Nodics Exists' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Collapse Security Controls' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configure Security' })).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Collapse Documentation Roadmap' }),
    );

    expect(
      screen.queryByRole('link', { name: 'What Nodics Is' }),
    ).not.toBeInTheDocument();
  });
});
