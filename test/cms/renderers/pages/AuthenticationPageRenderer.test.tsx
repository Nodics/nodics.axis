import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';

import type { CmsPageContract } from '../../../../src/cms/cmsContract';
import { AuthenticationPageRenderer } from '../../../../src/cms/renderers/pages/AuthenticationPageRenderer';

const page: CmsPageContract = {
  code: 'axisLoginPage',
  name: 'Axis login',
  typeCode: 'axisAuthenticationPageType',
  template: 'axisAuthenticationPageTemplate',
  renderer: 'axis.page.authentication',
  rendererContractVersion: 1,
  rendererChannels: ['web', 'mobile-webview'],
  rendererDeprecated: false,
  templateContract: {
    code: 'axisAuthenticationPageTemplate',
    renderer: 'axis.template.authentication',
    contractVersion: 1,
  },
  components: [
    {
      code: 'axisAuthenticationShowcaseComponent',
      typeCode: 'axisAuthenticationShowcaseComponentType',
      renderer: 'axis.component.authentication-showcase',
      rendererContractVersion: 1,
      rendererChannels: ['web', 'mobile-webview'],
      rendererDeprecated: false,
      properties: {
        eyebrow: 'Nodics enterprise operations',
        title: 'One governed workspace',
        message: 'Use active modules only.',
        highlights: ['Employee-only access'],
        logoAsset: 'axis-brand-mark',
        backgroundAsset: '/brand/custom-login-background.jpg',
      },
      slot: 'showcase',
      index: 5,
      components: [],
    },
    {
      code: 'axisBrandComponent',
      typeCode: 'axisBrandComponentType',
      renderer: 'axis.component.brand',
      rendererContractVersion: 1,
      rendererChannels: ['web', 'mobile-webview'],
      rendererDeprecated: false,
      properties: {
        productName: 'Nodics Axis',
        tagline: 'Business operations, connected.',
        logoAsset: '/brand/custom-logo.svg',
        displayMode: 'authentication',
      },
      slot: 'brand',
      index: 10,
      components: [],
    },
  ],
};

describe('AuthenticationPageRenderer', () => {
  it('accepts backend-owned authentication brand and background asset properties', async () => {
    render(
      <Suspense fallback={<div>Loading login</div>}>
        <AuthenticationPageRenderer page={page} />
      </Suspense>,
    );

    expect(await screen.findByText('One governed workspace')).toBeVisible();
    const customBrandLogo = screen
      .getAllByRole('img', { name: 'Nodics Axis' })
      .find((element) => element.getAttribute('src') === '/brand/custom-logo.svg');
    expect(customBrandLogo).toBeDefined();
  });

  it('rejects executable or remote authentication background assets from CMS data', () => {
    expect(() =>
      render(
        <Suspense fallback={<div>Loading login</div>}>
          <AuthenticationPageRenderer
            page={{
              ...page,
              components: page.components.map((component) =>
                component.slot === 'showcase'
                  ? {
                      ...component,
                      properties: {
                        ...component.properties,
                        backgroundAsset: 'https://evil.example/login.jpg',
                      },
                    }
                  : component,
              ),
            }}
          />
        </Suspense>,
      ),
    ).toThrow('axisAuthenticationShowcaseComponent.backgroundAsset');
  });
});
