import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SchemaWorkbenchPageRenderer } from '../../src/cms/renderers/pages/SchemaWorkbenchPageRenderer';
import type { CmsPagePresentationProps } from '../../src/cms/renderers/shared/rendererTypes';

vi.mock('../../src/cms/renderers/pages/renderComponentCollection', () => ({
  renderComponentCollection: () => null,
}));

describe('Product controls share the Workbench viewport', () => {
  it('places local owner controls in the nonshrinking template header, not before its viewport', () => {
    const props = {
      page: {
        name: 'Product Workspace',
        components: [],
        templateContract: { renderer: 'axis.template.schema-workbench' },
      },
      actions: { workbench: { ownerHeader: <div>Product owner Enterprise</div> } },
    } as unknown as CmsPagePresentationProps;
    render(<SchemaWorkbenchPageRenderer {...props} />);
    const viewport = screen.getByRole('region', { name: 'Product Workspace' });
    const owner = screen.getByText('Product owner Enterprise');
    expect(viewport).toContainElement(owner);
    expect(owner.parentElement?.parentElement).toBe(viewport);
    expect(owner.parentElement).toHaveStyle({ flexShrink: '0' });
    expect(viewport.lastElementChild).toHaveStyle({
      flex: '1',
      minHeight: '0',
      minWidth: '0',
    });
  });
});
