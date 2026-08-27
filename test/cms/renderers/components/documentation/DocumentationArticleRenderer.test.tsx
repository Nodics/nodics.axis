import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createAxisTheme } from '../../../../../src/app/axisTheme';
import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';
import { DocumentationArticleRenderer } from '../../../../../src/cms/renderers/components/documentation/DocumentationArticleRenderer';

const article: CmsComponentContract = {
  code: 'docsComponent',
  typeCode: 'documentationArticle',
  renderer: 'documentation.component.article',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  properties: {
    title: 'Build your first capability',
    category: 'Getting started',
    audience: ['developer'],
    maturityState: 'operational',
    accessMode: 'PUBLIC',
    lifecycleState: 'ONLINE',
    visualRequirements: ['screen-flow', 'command-example'],
    headings: [{ level: 2, text: 'Configure safely', anchor: 'configure-safely' }],
    previous: { title: 'Introduction', route: '/docs/introduction' },
    next: { title: 'Deployment', route: '/docs/deployment' },
    blocks: [
      {
        kind: 'heading',
        level: 2,
        text: 'Configure safely',
        anchor: 'configure-safely',
      },
      {
        kind: 'paragraph',
        text: 'Continue with the **configuration guide**, *official reference*, `properties.js`, [guide](/docs/configuration), or [support](mailto:support@example.com).',
      },
      {
        kind: 'image',
        alt: 'Nodics request flow',
        source: 'data:image/png;base64,iVBORw0KGgo=',
      },
      { kind: 'unordered-list', items: ['First step', 'Second step'] },
      { kind: 'code', text: 'npm run test:basic' },
      {
        kind: 'paragraph',
        text: '[Unsafe](javascript:alert(document.domain))',
      },
    ],
  },
  slot: 'article',
  index: 10,
  components: [],
};

describe('DocumentationArticleRenderer', () => {
  it('renders bounded declarative documentation and safe internal links', () => {
    render(
      <ThemeProvider theme={createAxisTheme('light')}>
        <MemoryRouter>
          <DocumentationArticleRenderer component={article} />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Build your first capability' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nodics documentation')).not.toBeInTheDocument();
    const guide = screen.getByRole('link', { name: 'guide' });
    expect(guide).toHaveAttribute('href', '/docs/configuration');
    expect(guide).toHaveStyle({ color: 'var(--mui-palette-secondary-main)' });
    expect(guide).toHaveClass('MuiLink-underlineAlways');
    expect(screen.getByRole('link', { name: 'Configure safely' })).toHaveAttribute(
      'href',
      '#configure-safely',
    );
    expect(screen.getByRole('link', { name: 'support' })).toHaveAttribute(
      'href',
      'mailto:support@example.com',
    );
    expect(screen.getByText('configuration guide').tagName).toBe('STRONG');
    expect(screen.getByText('official reference').tagName).toBe('EM');
    expect(screen.getByText('properties.js').tagName).toBe('CODE');
    expect(screen.getByText('operational')).toBeInTheDocument();
    expect(screen.getByText('PUBLIC')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    expect(screen.getByText('Visual contract')).toBeInTheDocument();
    expect(screen.getByText('screen-flow')).toBeInTheDocument();
    expect(screen.getByText('command-example')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Nodics request flow' })).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(screen.getByRole('link', { name: '← Introduction' })).toHaveAttribute(
      'href',
      '/docs/introduction',
    );
    expect(screen.getByRole('link', { name: 'Deployment →' })).toHaveAttribute(
      'href',
      '/docs/deployment',
    );
    expect(screen.getByText('First step')).toBeInTheDocument();
    const code = screen.getByText('npm run test:basic');
    expect(code).toBeInTheDocument();
    expect(code.closest('pre')).toHaveStyle({
      backgroundColor: 'var(--mui-palette-grey-900)',
      color: 'var(--mui-palette-grey-100)',
    });
    expect(screen.getByText(/Unsafe/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
  });

  it('rejects executable component property shapes without rendering markup', () => {
    const executable = {
      ...article,
      properties: {
        ...article.properties,
        blocks: [{ kind: 'html', text: '<script>window.bad = true</script>' }],
      },
    };
    const { container } = render(
      <MemoryRouter>
        <DocumentationArticleRenderer component={executable} />
      </MemoryRouter>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByText('window.bad = true')).not.toBeInTheDocument();
  });

  it('scrolls to the requested documentation fragment after async content renders', async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <MemoryRouter initialEntries={['/docs/example#configure-safely']}>
        <DocumentationArticleRenderer component={article} />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Configure safely' }),
    ).toHaveAttribute('id', 'configure-safely');
    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });
});
