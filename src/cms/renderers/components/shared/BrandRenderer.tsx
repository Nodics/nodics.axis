import { Stack, Typography } from '@mui/material';

import { AxisMark } from '../../../../app/shell/AxisMark';
import { assetPathProperty, stringProperty } from '../../shared/rendererProperties';
import type { CmsComponentRendererProps } from '../../shared/rendererTypes';

const BRAND_ASSET_ALIASES = Object.freeze({
  'axis-brand-mark': '/brand/favicon.svg',
});

function BrandLogo({
  alt,
  displayMode,
  logoAsset,
}: {
  readonly alt: string;
  readonly displayMode: string;
  readonly logoAsset: string;
}) {
  if (!logoAsset || logoAsset === BRAND_ASSET_ALIASES['axis-brand-mark']) {
    return <AxisMark />;
  }
  return (
    <img
      alt={alt}
      src={logoAsset}
      style={{
        display: 'block',
        maxHeight: displayMode === 'workspace' ? 36 : 52,
        maxWidth: displayMode === 'workspace' ? 220 : 260,
        objectFit: 'contain',
      }}
    />
  );
}

export function BrandRenderer({ component, actions }: CmsComponentRendererProps) {
  const displayMode = stringProperty(component, 'displayMode', 'workspace');
  const productName = stringProperty(component, 'productName');
  const tagline = stringProperty(component, 'tagline');
  const logoAsset = assetPathProperty(
    component,
    'logoAsset',
    BRAND_ASSET_ALIASES,
    'axis-brand-mark',
  );
  // A scoped business workspace owns its heading; keep the generic discovery brand for global Workbench.
  if (
    displayMode === 'workspace' &&
    actions?.workbench?.scope?.kind === 'navigation' &&
    actions.workbench.scope.label
  )
    return null;
  if (displayMode === 'workspace') {
    return (
      <Stack spacing={0.25} sx={{ alignItems: 'flex-start' }}>
        <Typography
          component={
            actions?.workbench && !actions.workbench.ownerHeader ? 'h1' : 'div'
          }
          color={
            actions?.workbench && !actions.workbench.ownerHeader
              ? 'text.primary'
              : 'text.secondary'
          }
          variant={
            actions?.workbench && !actions.workbench.ownerHeader ? 'h5' : 'overline'
          }
        >
          {productName}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {tagline}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.25}>
      <BrandLogo
        alt={productName || 'Nodics Axis'}
        displayMode={displayMode}
        logoAsset={logoAsset}
      />
      <Typography color="text.secondary" sx={{ fontSize: 13 }}>
        {tagline}
      </Typography>
    </Stack>
  );
}
