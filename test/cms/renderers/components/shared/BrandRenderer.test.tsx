import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WorkbenchRendererController } from '../../../../../src/cms/renderers/shared/rendererTypes';
import type { CmsComponentContract } from '../../../../../src/cms/cmsContract';
import { BrandRenderer } from '../../../../../src/cms/renderers/components/shared/BrandRenderer';

const brand: CmsComponentContract = {
  code: 'axisBrandComponent',
  typeCode: 'axisBrandComponentType',
  renderer: 'axis.component.brand',
  rendererContractVersion: 1,
  rendererChannels: ['web'],
  rendererDeprecated: false,
  properties: {
    productName: 'Nodics Axis',
    tagline: 'Business operations, connected.',
    logoAsset: 'axis-brand-mark',
    displayMode: 'authentication',
  },
  slot: 'brand',
  index: 10,
  components: [],
};

describe('BrandRenderer', () => {
  it('uses the backend logo asset property for custom brand images', () => {
    render(
      <BrandRenderer
        component={{
          ...brand,
          properties: {
            ...brand.properties,
            logoAsset: '/brand/customer-axis-logo.svg',
          },
        }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Nodics Axis' })).toHaveAttribute(
      'src',
      '/brand/customer-axis-logo.svg',
    );
    expect(screen.getByText('Business operations, connected.')).toBeVisible();
  });

  it('keeps the bundled Nodics mark as the default logical asset', () => {
    render(<BrandRenderer component={brand} />);

    expect(screen.getByRole('img', { name: 'Nodics Axis' })).toBeVisible();
    expect(screen.queryByRole('img', { name: 'Nodics Axis' })?.tagName).not.toBe('IMG');
  });

  it('rejects unsafe logo asset paths from CMS data', () => {
    expect(() =>
      render(
        <BrandRenderer
          component={{
            ...brand,
            properties: {
              ...brand.properties,
              logoAsset: 'javascript:alert(1)',
            },
          }}
        />,
      ),
    ).toThrow('axisBrandComponent.logoAsset');
  });
});

it('leaves the scoped business heading to Workbench and preserves global discovery branding', () => {
  const component = {
    ...brand,
    properties: {
      ...brand.properties,
      displayMode: 'workspace',
      productName: 'Schema Workbench',
    },
  };
  const workbench = {
    scope: { kind: 'navigation', label: 'Blogs' },
  } as WorkbenchRendererController;
  const rendered = render(
    <BrandRenderer component={component} actions={{ workbench }} />,
  );
  expect(screen.queryByText('Schema Workbench')).not.toBeInTheDocument();
  rendered.rerender(
    <BrandRenderer
      component={component}
      actions={{ workbench: { ...workbench, scope: undefined } }}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'Schema Workbench', level: 1 }),
  ).toBeVisible();
});
