import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('opens with a fitted overview, then zooms to readable native size within a scrollable viewport', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationArticleRenderer component={article} />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Enlarge Nodics request flow' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Nodics request flow' });
    const image = within(dialog).getByRole('img');
    expect(image).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgo=');
    Object.defineProperty(image, 'naturalWidth', { value: 2467 });
    fireEvent.load(image);
    expect(image).toHaveStyle({ maxWidth: '100%', maxHeight: '100%' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Fit');
    expect(within(dialog).getByRole('region', { name: 'Enlarged image' })).toHaveStyle({
      overflow: 'auto',
      width: '100%',
      height: '100%',
    });
    const slider = within(dialog).getByRole('slider', { name: 'Image zoom' });
    expect(slider).toHaveAttribute('min', '25');
    expect(slider).toHaveAttribute('max', '200');
    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(image).toHaveStyle({ width: '1850.25px', maxWidth: 'none' });
    await user.keyboard('{ArrowRight}');
    expect(image).toHaveStyle({ width: '2467px' });
    await user.keyboard('{ArrowRight}');
    expect(image).toHaveStyle({ width: '3083.75px' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('125%');
    await user.click(within(dialog).getByRole('button', { name: 'Fit image' }));
    expect(image).toHaveStyle({ maxWidth: '100%', maxHeight: '100%' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Fit');
    await user.click(within(dialog).getByRole('button', { name: 'Close image' }));
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Enlarge Nodics request flow' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Fit');
  });

  it('keeps a wrapping full title and Close in the first row, with zoom controls in a separate bounded row', async () => {
    const user = userEvent.setup();
    const title = 'Circa architecture and domain ownership';
    render(
      <MemoryRouter>
        <DocumentationArticleRenderer
          component={{
            ...article,
            properties: {
              ...article.properties,
              blocks: [{ kind: 'image', alt: title, source: '/docs-assets/circa.png' }],
            },
          }}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: `Enlarge ${title}` }));
    const dialog = screen.getByRole('dialog', { name: title });
    const heading = within(dialog).getByRole('heading', { name: title });
    expect(heading).toHaveStyle({ overflowWrap: 'anywhere' });
    expect(heading).not.toHaveClass('MuiTypography-noWrap');
    const titleRow = heading.parentElement;
    expect(titleRow).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 40px',
      alignItems: 'start',
    });
    expect(
      within(dialog).getByRole('button', { name: 'Close image' }).parentElement,
    ).toBe(titleRow);
    const controlRow = within(dialog).getByRole('button', {
      name: 'Fit image',
    }).parentElement;
    expect(controlRow).not.toBe(titleRow);
    expect(controlRow).toHaveStyle({
      gridTemplateColumns: '40px minmax(0, 1fr) 48px',
      width: '100%',
      maxWidth: '360px',
    });
    expect(controlRow).toContainElement(
      within(dialog).getByRole('slider', { name: 'Image zoom' }),
    );
    expect(controlRow).toContainElement(within(dialog).getByRole('status'));
  });

  it('supports keyboard opening, Escape dismissal and focus restoration', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationArticleRenderer component={article} />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Enlarge Nodics request flow' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Close image' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it.each([
    'https://example.com/image.png',
    'javascript:alert(1)',
    '//example.com/image.png',
  ])('rejects unsafe image source %s without an enlargement command', (source) => {
    render(
      <MemoryRouter>
        <DocumentationArticleRenderer
          component={{
            ...article,
            properties: {
              ...article.properties,
              blocks: [{ kind: 'image', source, alt: 'Unsafe image' }],
            },
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enlarge/ })).not.toBeInTheDocument();
  });

  it('closes a stale viewer when the article or validated image changes', async () => {
    const user = userEvent.setup();
    const view = (component: CmsComponentContract) => (
      <MemoryRouter>
        <DocumentationArticleRenderer component={component} />
      </MemoryRouter>
    );
    const { rerender } = render(view(article));
    await user.click(
      screen.getByRole('button', { name: 'Enlarge Nodics request flow' }),
    );
    rerender(view({ ...article, code: 'nextArticle' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Enlarge Nodics request flow' }),
    );
    rerender(
      view({
        ...article,
        code: 'nextArticle',
        properties: {
          ...article.properties,
          blocks: [
            {
              kind: 'image',
              source: '/docs-assets/architecture.png',
              alt: 'Next architecture',
            },
          ],
        },
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enlarge Next architecture' }));
    expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
      'src',
      '/docs-assets/architecture.png',
    );
  });

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
