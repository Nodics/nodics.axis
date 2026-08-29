import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import { NavigationRail } from '../../../src/app/shell/NavigationRail';
import type { ShellNavigationGroup } from '../../../src/app/shell/shellNavigation';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Axis navigation rail', () => {
  it('keeps disabled expandable items compatible with MUI tooltips', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const groups: readonly ShellNavigationGroup[] = [
      {
        id: 'system-integrations',
        label: 'System & Integrations',
        order: 150,
        items: [
          {
            id: 'disabled-parent',
            label: 'Disabled Parent',
            route: '/disabled-parent',
            order: 10,
            moduleName: 'backoffice',
            category: 'platform',
            icon: 'registry',
            availability: 'UP',
            perspectives: ['operations'],
            contexts: [],
            featureState: 'DISABLED',
            depth: 0,
            hasChildren: true,
            local: false,
          },
          {
            id: 'disabled-child',
            parentId: 'disabled-parent',
            label: 'Disabled Child',
            route: '/disabled-parent/child',
            order: 20,
            moduleName: 'backoffice',
            category: 'platform',
            icon: 'registry',
            availability: 'UP',
            perspectives: ['operations'],
            contexts: [],
            featureState: 'DISABLED',
            depth: 1,
            hasChildren: false,
            local: false,
          },
        ],
      },
    ];

    render(
      <AxisThemeProvider>
        <NavigationRail
          activePath="/disabled-parent"
          compact={false}
          favourites={new Set()}
          groups={groups}
          query=""
          onNavigate={vi.fn()}
          onQueryChange={vi.fn()}
          onToggleFavourite={vi.fn()}
        />
      </AxisThemeProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Collapse Disabled Parent submenu' }),
    ).toBeDisabled();
    expect(
      screen
        .getByRole('button', { name: 'Collapse System & Integrations' })
        .querySelector('[data-navigation-expander="group"]'),
    ).toHaveStyle({ width: '40px' });
    expect(
      screen.getByRole('button', { name: 'Collapse Disabled Parent submenu' }),
    ).toHaveStyle({ width: '40px' });
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('disabled `button` child'),
    );
    expect(consoleWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('disabled `button` child'),
    );
  });

  it('starts non-active navigation groups collapsed', () => {
    const groups: readonly ShellNavigationGroup[] = [
      {
        id: 'system-integrations',
        label: 'System & Integrations',
        order: 150,
        items: [
          {
            id: 'registry',
            label: 'Module Registry',
            route: '/registry',
            order: 10,
            moduleName: 'backoffice',
            category: 'platform',
            icon: 'registry',
            availability: 'UP',
            perspectives: ['operations'],
            contexts: [],
            featureState: 'ACTIVE',
            depth: 0,
            hasChildren: false,
            local: false,
          },
        ],
      },
    ];

    render(
      <AxisThemeProvider>
        <NavigationRail
          activePath="/dashboard"
          compact={false}
          favourites={new Set()}
          groups={groups}
          query=""
          onNavigate={vi.fn()}
          onQueryChange={vi.fn()}
          onToggleFavourite={vi.fn()}
        />
      </AxisThemeProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Expand System & Integrations' }),
    ).toBeVisible();
    expect(screen.queryByText('Module Registry')).not.toBeInTheDocument();
  });

  it('selects Documentation Designer on the designer route even with stale navigation metadata', () => {
    const groups: readonly ShellNavigationGroup[] = [
      {
        id: 'documentation',
        label: 'Documentation',
        order: 1600,
        items: [
          {
            id: 'documentation-dashboard',
            label: 'Dashboard',
            route: '/docs',
            order: 105,
            moduleName: 'backoffice',
            category: 'platform',
            icon: 'content',
            availability: 'UP',
            perspectives: ['operations'],
            contexts: [],
            featureState: 'ACTIVE',
            depth: 0,
            hasChildren: false,
            local: false,
          },
          {
            id: 'documentation-management',
            label: 'Documentation Designer',
            route: '/content/designer/documentation',
            order: 107,
            moduleName: 'backoffice',
            category: 'platform',
            icon: 'cms',
            availability: 'UP',
            perspectives: ['operations'],
            contexts: [],
            featureState: 'ACTIVE',
            depth: 0,
            hasChildren: false,
            local: false,
          },
        ],
      },
    ];

    render(
      <AxisThemeProvider>
        <NavigationRail
          activePath="/docs/designer"
          compact={false}
          favourites={new Set()}
          groups={groups}
          query=""
          onNavigate={vi.fn()}
          onQueryChange={vi.fn()}
          onToggleFavourite={vi.fn()}
        />
      </AxisThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveClass(
      'Mui-selected',
    );
    expect(screen.getByRole('button', { name: 'Documentation Designer' })).toHaveClass(
      'Mui-selected',
    );
  });
});
