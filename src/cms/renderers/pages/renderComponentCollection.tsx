import { Stack } from '@mui/material';
import type { ReactNode } from 'react';

import type { CmsComponentContract } from '../../cmsContract';
import { CmsComponentRenderer } from '../CmsComponentRenderer';
import { CmsRenderBoundary } from '../shared/CmsRenderBoundary';
import type { CmsRendererActions } from '../shared/rendererTypes';

export function renderComponentCollection(
  components: readonly CmsComponentContract[],
  actions?: CmsRendererActions,
): ReactNode {
  return (
    <Stack spacing={2}>
      {components.map((component, index) => (
        <CmsRenderBoundary
          key={`${component.slot}:${String(component.index)}:${component.code}:${String(index)}`}
        >
          <CmsComponentRenderer actions={actions} component={component} />
        </CmsRenderBoundary>
      ))}
    </Stack>
  );
}
