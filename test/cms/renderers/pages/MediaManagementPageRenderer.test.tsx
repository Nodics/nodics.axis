import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CmsPageContract } from '../../../../src/cms/cmsContract';
import { MediaManagementPageRenderer } from '../../../../src/cms/renderers/pages/MediaManagementPageRenderer';

vi.mock('../../../../src/cms/renderers/CmsComponentRenderer', () => ({
  CmsComponentRenderer: () => (
    <section aria-label="Rendered media component">Media component</section>
  ),
}));

const page: CmsPageContract = {
  code: 'axisMediaManagementPage',
  name: 'Axis Media Management',
  typeCode: 'axisMediaManagementPageType',
  template: 'axisMediaManagementPageTemplate',
  renderer: 'axis.page.media-management',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  templateContract: {
    code: 'axisMediaManagementPageTemplate',
    renderer: 'axis.template.media-management',
    contractVersion: 0,
  },
  components: [
    {
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
        customizationBoundary:
          'Customize presentation without moving backend authority.',
      },
      slot: 'workspace',
      index: 10,
      components: [],
    },
  ],
};

describe('MediaManagementPageRenderer', () => {
  it('maps CMS workspace slot through the dedicated Media Management template', () => {
    render(<MediaManagementPageRenderer page={page} />);

    expect(screen.getByLabelText('Rendered media component')).toBeVisible();
  });

  it('rejects an unrelated template contract', () => {
    expect(() =>
      render(
        <MediaManagementPageRenderer
          page={{
            ...page,
            templateContract: {
              ...page.templateContract,
              renderer: 'axis.template.dashboard',
            },
          }}
        />,
      ),
    ).toThrow(/requires axis.template.media-management/);
  });
});
