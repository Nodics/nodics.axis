import { useAxisLocalization } from '../../../localization/AxisLocalizationContext';
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
  const { format, locale } = useAxisLocalization();
  if (page.templateContract.renderer !== 'axis.template.authentication') {
    throw new Error(
      `Authentication page requires axis.template.authentication, received ${page.templateContract.renderer}`,
    );
  }
  const ordered = [...page.components]
    .sort((left, right) => left.index - right.index)
    .map((component) => {
      if (locale === 'en') return component;
      const translate = (name: string, source: string) => {
        const key = `common.authentication.${component.code.toLowerCase()}.${name.toLowerCase()}`;
        const ownerSource = format(`${key}.source`, '');
        return ownerSource === source ? format(key, source) : source;
      };
      const properties = { ...component.properties };
      for (const name of [
        'eyebrow',
        'title',
        'message',
        'tagline',
        'label',
        'enterpriseLabel',
        'usernameLabel',
        'usernamePlaceholder',
        'passwordLabel',
        'passwordPlaceholder',
        'submitLabel',
      ]) {
        const value = properties[name];
        if (typeof value === 'string') properties[name] = translate(name, value);
      }
      if (
        properties.enterpriseLabel === undefined &&
        component.renderer === 'axis.component.employee-login-form'
      ) {
        const defaultLabel = 'Enterprise code';
        properties.enterpriseLabel = translate('enterpriseLabel', defaultLabel);
      }
      if (Array.isArray(properties.highlights)) {
        properties.highlights = properties.highlights.map((value: unknown, index) =>
          typeof value === 'string' ? translate(`highlights.${index}`, value) : value,
        );
      }
      return { ...component, properties };
    });
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
