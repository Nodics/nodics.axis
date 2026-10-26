import type { ReactNode } from 'react';

import type { CmsPagePresentationProps } from '../shared/rendererTypes';
import {
  SchemaWorkbenchTemplateRenderer,
  type SchemaWorkbenchTemplateSlots,
} from '../templates/SchemaWorkbenchTemplateRenderer';
import { renderComponentCollection } from './renderComponentCollection';

export function SchemaWorkbenchPageRenderer({
  page,
  actions,
}: CmsPagePresentationProps) {
  if (page.templateContract.renderer !== 'axis.template.schema-workbench') {
    throw new Error(
      `Schema Workbench requires axis.template.schema-workbench, received ${page.templateContract.renderer}`,
    );
  }
  const ordered = [...page.components].sort((left, right) => left.index - right.index);
  const slot = (name: string): ReactNode =>
    renderComponentCollection(
      ordered.filter((component) => component.slot === name),
      actions,
    );
  const slots: SchemaWorkbenchTemplateSlots = {
    header: (
      <>
        {actions?.workbench?.ownerHeader}
        {slot('header')}
      </>
    ),
    content: slot('content'),
  };
  return <SchemaWorkbenchTemplateRenderer page={page} slots={slots} />;
}
