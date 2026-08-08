import { AuthenticationTemplateRenderer } from '../templates/AuthenticationTemplateRenderer';
import type { CmsPagePresentationProps } from '../shared/rendererTypes';
import { renderComponentCollection } from './renderComponentCollection';
import { assetPathProperty } from '../shared/rendererProperties';

const AUTHENTICATION_ASSET_ALIASES = Object.freeze({
  'axis-auth-microservices': '/brand/axis-auth-microservices.jpg',
  'axis-brand-mark': '/brand/favicon.svg',
});

export function AuthenticationPageRenderer({
  page,
  actions,
}: CmsPagePresentationProps) {
  if (page.templateContract.renderer !== 'axis.template.authentication') {
    throw new Error(
      `Authentication page requires axis.template.authentication, received ${page.templateContract.renderer}`,
    );
  }
  const ordered = [...page.components].sort((left, right) => left.index - right.index);
  const showcaseComponent = ordered.find((component) => component.slot === 'showcase');
  const slot = (name: string) =>
    renderComponentCollection(
      ordered.filter((component) => component.slot === name),
      actions,
    );
  return (
    <AuthenticationTemplateRenderer
      showcaseBackgroundAsset={
        showcaseComponent
          ? assetPathProperty(
              showcaseComponent,
              'backgroundAsset',
              AUTHENTICATION_ASSET_ALIASES,
              'axis-auth-microservices',
            )
          : AUTHENTICATION_ASSET_ALIASES['axis-auth-microservices']
      }
      showcaseLogoAsset={
        showcaseComponent
          ? assetPathProperty(
              showcaseComponent,
              'logoAsset',
              AUTHENTICATION_ASSET_ALIASES,
              'axis-brand-mark',
            )
          : AUTHENTICATION_ASSET_ALIASES['axis-brand-mark']
      }
      slots={{
        showcase: slot('showcase'),
        brand: slot('brand'),
        introduction: slot('introduction'),
        authentication: slot('authentication'),
        assistance: slot('assistance'),
        legal: slot('legal'),
      }}
    />
  );
}
