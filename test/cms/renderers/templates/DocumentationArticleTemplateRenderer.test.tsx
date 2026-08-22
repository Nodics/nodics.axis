import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router';

import type { CmsPageContract } from '../../../../src/cms/cmsContract';
import { DocumentationArticleTemplateRenderer } from '../../../../src/cms/renderers/templates/DocumentationArticleTemplateRenderer';

const page: CmsPageContract = {
  code: 'frameworkDocsPage',
  name: 'Framework documentation',
  typeCode: 'documentationArticlePage',
  template: 'documentationArticleTemplate',
  renderer: 'documentation.page.article',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  templateContract: {
    code: 'documentationArticleTemplate',
    renderer: 'documentation.template.article',
    contractVersion: 0,
  },
  components: [],
};

describe('DocumentationArticleTemplateRenderer', () => {
  it('keeps documentation navigation on the left and lets readers hide it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationArticleTemplateRenderer
          page={page}
          slots={{
            navigation: <nav aria-label="Documentation">Documentation navigation</nav>,
            article: <h1>Framework article</h1>,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Documentation navigation')).toBeVisible();
    expect(
      screen.getByRole('article', { name: 'Framework documentation' }),
    ).toBeVisible();
    expect(screen.getByTestId('documentation-navigation-scroll-region')).toHaveStyle({
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    });
    expect(screen.getByTestId('documentation-article-scroll-region')).toHaveStyle({
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    });
    expect(
      screen.getByRole('button', { name: 'Hide documentation navigation' })
        .parentElement,
    ).toHaveStyle({ position: 'absolute', right: 0, top: 0 });

    await user.click(
      screen.getByRole('button', { name: 'Hide documentation navigation' }),
    );

    expect(screen.queryByText('Documentation navigation')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show documentation navigation' }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Show documentation navigation' }),
    );

    expect(screen.getByText('Documentation navigation')).toBeVisible();
  });

  it('returns the article panel to the top when the selected topic changes', async () => {
    const user = userEvent.setup();

    function TopicNavigation() {
      const navigate = useNavigate();
      return (
        <button
          onClick={() => {
            void navigate('/docs/framework/next');
          }}
        >
          Next topic
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={['/docs/framework/current']}>
        <DocumentationArticleTemplateRenderer
          page={page}
          slots={{
            navigation: <TopicNavigation />,
            article: <h1>Framework article</h1>,
          }}
        />
      </MemoryRouter>,
    );

    const article = screen.getByTestId('documentation-article-scroll-region');
    article.scrollTop = 480;

    await user.click(screen.getByRole('button', { name: 'Next topic' }));

    expect(article.scrollTop).toBe(0);
  });
});
