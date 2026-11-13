import type { ReactNode } from 'react';

import type { CmsPagePresentationProps } from '../shared/rendererTypes';
import {
  DocumentationArticleTemplateRenderer,
  type DocumentationArticleTemplateSlots,
} from '../templates/DocumentationArticleTemplateRenderer';
import { renderComponentCollection } from './renderComponentCollection';

export function DocumentationArticlePageRenderer({
  page,
  actions,
}: CmsPagePresentationProps) {
  if (page.templateContract.renderer !== 'documentation.template.article') {
    throw new Error(
      `Documentation article requires documentation.template.article, received ${page.templateContract.renderer}`,
    );
  }
  const ordered = [...page.components].sort((left, right) => left.index - right.index);
  const slot = (name: string): ReactNode =>
    renderComponentCollection(
      ordered.filter((component) => component.slot === name),
      actions,
    );
  const slots: DocumentationArticleTemplateSlots = {
    navigation: slot('navigation'),
    article: slot('article'),
  };
  return (
    <DocumentationArticleTemplateRenderer readerLayout page={page} slots={slots} />
  );
}
