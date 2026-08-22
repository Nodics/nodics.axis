import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';

import { AxisThemeProvider } from '../../../../src/app/AxisThemeProvider';
import { DashboardPageRenderer } from '../../../../src/cms/renderers/pages/DashboardPageRenderer';
import type { CmsPageContract } from '../../../../src/cms/cmsContract';

const baseComponent = {
  typeCode: 'axisMessageComponentType',
  renderer: 'axis.component.message',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  components: [],
};

const page: CmsPageContract = {
  code: 'axisDashboardPage',
  name: 'Axis dashboard',
  typeCode: 'axisDashboardPageType',
  template: 'axisDashboardPageTemplate',
  renderer: 'axis.page.dashboard',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  templateContract: {
    code: 'axisDashboardPageTemplate',
    renderer: 'axis.template.dashboard',
    contractVersion: 0,
  },
  components: [
    {
      ...baseComponent,
      code: 'axisDashboardWelcomeComponent',
      slot: 'welcome',
      index: 10,
      properties: {
        title: 'Welcome to Nodics Axis',
        message: 'Your authorized business workspace is ready.',
      },
    },
    {
      ...baseComponent,
      code: 'staleDashboardHeaderComponent',
      slot: 'header',
      index: 20,
      properties: {
        title: 'NODICS AXIS',
        message: 'Employee BackOffice',
      },
    },
  ],
};

describe('DashboardPageRenderer', () => {
  it('ignores obsolete dashboard header slot content from stale CMS records', async () => {
    render(
      <AxisThemeProvider>
        <Suspense fallback={<div>Loading dashboard</div>}>
          <DashboardPageRenderer page={page} />
        </Suspense>
      </AxisThemeProvider>,
    );

    expect(await screen.findByText('Welcome to Nodics Axis')).toBeVisible();
    expect(screen.queryByText('NODICS AXIS')).not.toBeInTheDocument();
    expect(screen.queryByText('Employee BackOffice')).not.toBeInTheDocument();
  });
});
