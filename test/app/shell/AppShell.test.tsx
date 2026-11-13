import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../../../src/app/shell/AppShell';
import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import {
  loadNavigationPreferences,
  saveNavigationPreferences,
} from '../../../src/app/shell/navigationPreferences';

const preferenceScope = {
  employeeId: 'alex@example.test',
  tenantCode: 'business',
  enterpriseCode: 'business',
  environments: ['local'],
};

let scrollTo = vi.fn();
let mainScrollTo = vi.fn();
let scrollIntoView = vi.fn();

beforeEach(() => {
  scrollTo = vi.fn();
  mainScrollTo = vi.fn();
  scrollIntoView = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: mainScrollTo,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Axis application shell navigation', () => {
  it('retires history on employee and scope replacement without copying it to the next owner', async () => {
    const user = userEvent.setup();
    const navigation = [
      {
        id: 'content',
        label: 'Content',
        route: '/content',
        order: 10,
        moduleName: 'cms',
        category: 'content',
        icon: 'cms',
        availability: 'UP',
        group: { id: 'content', label: 'Content & Experience', order: 100 },
      },
      {
        id: 'media',
        label: 'Media',
        route: '/media/items',
        order: 20,
        moduleName: 'media',
        category: 'content',
        icon: 'media',
        availability: 'UP',
        group: { id: 'content', label: 'Content & Experience', order: 100 },
      },
    ] as const;
    const other = { ...preferenceScope, employeeId: 'other@example.test' };
    const shell = (scope: typeof preferenceScope) => (
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell {...scope} navigation={navigation}>
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>
    );
    saveNavigationPreferences(
      { favourites: [], recents: ['cms:content'] },
      preferenceScope,
    );
    const view = render(shell(preferenceScope));
    await user.click(screen.getByRole('button', { name: /Recent pages/ }));
    expect(screen.getByRole('menuitem', { name: 'Content' })).toBeVisible();
    await user.keyboard('{Escape}');

    view.rerender(shell(other));
    expect(screen.getByRole('button', { name: /Recent pages/ })).toBeDisabled();
    expect(loadNavigationPreferences(other).recents).toEqual([]);
    saveNavigationPreferences({ favourites: [], recents: ['media:media'] }, other);
    view.rerender(shell({ ...other, tenantCode: 'another' }));
    expect(screen.getByRole('button', { name: /Recent pages/ })).toBeDisabled();
    expect(
      loadNavigationPreferences({ ...other, tenantCode: 'another' }).recents,
    ).toEqual([]);
    view.rerender(shell(other));
    await user.click(screen.getByRole('button', { name: /Recent pages/ }));
    expect(screen.getByRole('menuitem', { name: 'Media' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Content' })).not.toBeInTheDocument();

    view.rerender(shell(preferenceScope));
    expect(screen.getByRole('menuitem', { name: 'Content' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Media' })).not.toBeInTheDocument();
    expect(loadNavigationPreferences(other).recents).toEqual(['media:media']);
    expect(loadNavigationPreferences(preferenceScope).recents).toEqual(['cms:content']);
  });

  it('does not attribute legacy browser-wide recent pages to a new employee', () => {
    window.localStorage.setItem(
      'nodics-axis-navigation-preferences-v1',
      JSON.stringify({ favourites: [], recents: ['cms:content'] }),
    );
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            employeeId="invited@example.test"
            enterpriseCode="business"
            tenantCode="business"
            environments={['local']}
            navigation={[
              {
                id: 'content',
                label: 'Content',
                route: '/content',
                order: 10,
                moduleName: 'cms',
                category: 'content',
                icon: 'cms',
                availability: 'UP',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );
    expect(screen.getByRole('button', { name: /Recent pages/ })).toBeDisabled();
  });

  it('owns one shared workspace viewport around every authenticated page', () => {
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell>
            <section aria-label="Route content">Workspace</section>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    const viewport = screen.getByTestId('axis-workspace-viewport');
    expect(viewport).toContainElement(
      screen.getByRole('region', { name: 'Route content' }),
    );
    expect(viewport.closest('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getAllByTestId('axis-workspace-viewport')).toHaveLength(1);
  });

  it('offers working appearance and session actions without placeholder utilities or invented counts', async () => {
    const user = userEvent.setup();
    const onLock = vi.fn();
    const onLogout = vi.fn();
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell employeeId="admin" onLock={onLock} onLogout={onLogout}>
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    expect(screen.queryByRole('button', { name: 'My Work' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Notifications' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open employee menu/ }));
    expect(screen.queryByRole('menuitem', { name: 'Profile' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Preferences' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Switch to dark mode' }));
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Open employee menu/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Lock screen' }));
    expect(onLock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /Open employee menu/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('starts each newly selected page at the top of the content pane without moving the navigation rail', async () => {
    const user = userEvent.setup();
    render(
      <AxisThemeProvider>
        <MemoryRouter initialEntries={['/docs/first']}>
          <AppShell>
            <Link to="/docs/second">Open second page</Link>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );
    mainScrollTo.mockClear();
    await user.click(screen.getByRole('link', { name: 'Open second page' }));

    expect(scrollTo).not.toHaveBeenCalled();
    expect(mainScrollTo).toHaveBeenCalledWith({
      behavior: 'auto',
      left: 0,
      top: 0,
    });
  });

  it('labels a missing owner name as the exact Enterprise code', () => {
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            catalog="axisContentCatalog"
            enterpriseCode="default"
            environments={['kickoffLocal']}
            site="axisCmsSite"
            tenantCode="default"
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    expect(
      screen.getByRole('button', {
        name: 'Kickoff Local · Enterprise code: default · Current context',
      }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('collapses the desktop sidebar to an accessible icon rail', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('min-width:900px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const user = userEvent.setup();

    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            navigation={[
              {
                id: 'cms',
                label: 'Content',
                route: '/content',
                order: 200,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
              {
                id: 'sites',
                parentId: 'cms',
                label: 'Websites',
                route: '/content/sites',
                order: 20,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    expect(screen.getByText('NODICS')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Collapse navigation' }));

    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
    expect(screen.queryByText('NODICS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Content' })).toBeVisible();
    expect(screen.queryByText('Content & Experience')).not.toBeInTheDocument();
  });

  it('lets desktop employees resize the navigation rail within safe bounds', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('min-width:900px'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const user = userEvent.setup();

    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            navigation={[
              {
                id: 'cms',
                label: 'Content',
                route: '/content',
                order: 200,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    const resizeHandle = screen.getByRole('separator', {
      name: 'Resize navigation',
    });
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '264');

    resizeHandle.focus();
    await user.keyboard('{ArrowRight}');
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '280');
    expect(window.localStorage.getItem('nodics-axis-navigation-rail-width-v1')).toBe(
      '280',
    );

    fireEvent.pointerDown(resizeHandle, { clientX: 900, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 900 });
    fireEvent.pointerUp(window);

    expect(resizeHandle).toHaveAttribute('aria-valuenow', '420');
    expect(window.localStorage.getItem('nodics-axis-navigation-rail-width-v1')).toBe(
      '420',
    );
  });

  it('uses the authorized BackOffice contribution for the Assistant shortcut', async () => {
    const user = userEvent.setup();

    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            navigation={[
              {
                id: 'assistant',
                label: 'Ask Axis',
                route: '/assistant',
                order: 50,
                moduleName: 'aiAssistant',
                category: 'platform',
                icon: 'assistant',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    const shortcut = screen.getByRole('button', { name: 'Ask Axis' });
    expect(shortcut).toBeEnabled();
    expect(shortcut.querySelector('svg')).toHaveClass('MuiSvgIcon-colorPrimary');
    expect(shortcut.querySelector('svg')).toHaveStyle({ fontSize: '32px' });
    expect(shortcut.querySelectorAll('svg path')[1]).toHaveAttribute('fill', '#1b1e20');
    await user.click(shortcut);
    expect(screen.getAllByRole('button', { name: 'Ask Axis' })).not.toHaveLength(0);
  });

  it('disables the Assistant shortcut when BackOffice reports it unavailable', () => {
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            navigation={[
              {
                id: 'assistant',
                label: 'Axis Assistant',
                route: '/assistant',
                order: 50,
                moduleName: 'aiAssistant',
                category: 'platform',
                icon: 'assistant',
                availability: 'UNAVAILABLE',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    const shortcut = screen.getByRole('button', { name: 'Axis Assistant' });
    expect(shortcut).toBeDisabled();
    expect(shortcut.querySelector('svg')).toHaveClass('MuiSvgIcon-colorDisabled');
  });

  it('searches matching left-panel navigation and preserves inactive features', async () => {
    const user = userEvent.setup();
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            navigation={[
              {
                id: 'cms',
                label: 'Content',
                route: '/content',
                order: 10,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
                perspectives: ['content'],
              },
              {
                id: 'pricing',
                label: 'Pricing',
                route: '/pricing',
                order: 20,
                moduleName: 'pricing',
                category: 'commerce',
                icon: 'pricing',
                availability: 'UNAVAILABLE',
                perspectives: ['commerce'],
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const menuSearch = screen.getByRole('textbox', { name: 'Search menu' });
    await user.type(menuSearch, 'content');
    expect(screen.getByRole('button', { name: 'Content' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Pricing' })).not.toBeInTheDocument();

    await user.clear(menuSearch);
    await user.type(menuSearch, 'pricing');
    expect(screen.getByRole('button', { name: 'Pricing Unavailable' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.clear(menuSearch);
    await user.type(menuSearch, 'not available');
    expect(screen.getByText('No matching menu items')).toBeVisible();
  });

  it('expands and collapses navigation groups while exposing search matches', async () => {
    const user = userEvent.setup();
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            navigation={[
              {
                id: 'cms',
                label: 'Content',
                route: '/content',
                order: 10,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
              {
                id: 'sites',
                parentId: 'cms',
                label: 'Websites',
                route: '/content/sites',
                order: 20,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(
      screen.getByRole('button', { name: 'Expand Content & Experience' }),
    );
    const collapse = screen.getByRole('button', {
      name: 'Collapse Content & Experience',
    });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Websites' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Collapse Content submenu' }));
    expect(
      screen.getByRole('button', { name: 'Expand Content submenu' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Websites' })).not.toBeInTheDocument();

    await user.click(collapse);
    expect(
      screen.getByRole('button', { name: 'Expand Content & Experience' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Content' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search menu' }), 'content');
    expect(screen.getByRole('button', { name: 'Content' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Collapse Content & Experience' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the active nested navigation item selected and in view', async () => {
    const user = userEvent.setup();
    render(
      <AxisThemeProvider>
        <MemoryRouter initialEntries={['/media/items']}>
          <AppShell
            navigation={[
              {
                id: 'cms',
                label: 'Content',
                route: '/content',
                order: 10,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
              {
                id: 'media-management',
                parentId: 'cms',
                parentModuleName: 'cms',
                label: 'Media Management',
                route: '/media',
                order: 20,
                moduleName: 'media',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'media',
                availability: 'UP',
              },
              {
                id: 'media-items',
                parentId: 'media-management',
                parentModuleName: 'media',
                label: 'Media Items',
                route: '/media/items',
                order: 30,
                moduleName: 'media',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'media',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    const activeItem = screen.getByRole('button', { name: 'Media Items' });
    expect(activeItem).toHaveClass('Mui-selected');
    expect(scrollIntoView).toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Collapse Media Management submenu' }),
    );
    expect(screen.getByRole('button', { name: 'Media Items' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Collapse Media Management submenu' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps favourites hidden while preserving recent destinations', async () => {
    const user = userEvent.setup();
    saveNavigationPreferences(
      { favourites: [], recents: ['cms:cms'] },
      preferenceScope,
    );
    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            {...preferenceScope}
            navigation={[
              {
                id: 'cms',
                label: 'Content',
                route: '/content',
                order: 10,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Recent pages/ }));
    expect(screen.getByRole('menuitem', { name: /Content/ })).toBeVisible();
    expect(screen.queryByText('/content')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(
      screen.queryByRole('button', { name: 'Add Content to favourites' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Favourite: Content')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Expand Content & Experience' }),
    );
    await user.click(screen.getByRole('button', { name: 'Content' }));
    expect(screen.queryByText('Recent: Content')).not.toBeInTheDocument();
    expect(loadNavigationPreferences(preferenceScope).recents).toContain('cms:cms');
  });

  it('limits rendered recent destinations from shell configuration', async () => {
    const user = userEvent.setup();
    saveNavigationPreferences(
      {
        favourites: [],
        recents: ['cms:content', 'media:media'],
      },
      preferenceScope,
    );

    render(
      <AxisThemeProvider>
        <MemoryRouter>
          <AppShell
            {...preferenceScope}
            recentNavigationLimit={1}
            navigation={[
              {
                id: 'content',
                label: 'Content',
                route: '/content',
                order: 10,
                moduleName: 'cms',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'cms',
                availability: 'UP',
              },
              {
                id: 'media',
                label: 'Media',
                route: '/media/items',
                order: 20,
                moduleName: 'media',
                category: 'content',
                group: { id: 'content', label: 'Content & Experience', order: 100 },
                icon: 'media',
                availability: 'UP',
              },
            ]}
          >
            <div>Workspace</div>
          </AppShell>
        </MemoryRouter>
      </AxisThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /Recent pages/ }));

    expect(screen.getByRole('menuitem', { name: /Content/ })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: /Media/ })).not.toBeInTheDocument();
  });
});

it('uses the canonical Enterprise name and separates composition from current business context', async () => {
  const user = userEvent.setup();
  render(
    <AxisThemeProvider>
      <MemoryRouter>
        <AppShell
          {...preferenceScope}
          enterpriseDisplayName="GreenPerks Retail"
          site="axisCmsSite"
          catalog="axisContentCatalog"
        >
          <div>Workspace</div>
        </AppShell>
      </MemoryRouter>
    </AxisThemeProvider>,
  );
  const context = screen.getByRole('button', {
    name: 'Local · GreenPerks Retail · Current context',
  });
  expect(context).toBeVisible();
  expect(context).toHaveTextContent('Local · GreenPerks Retail');
  expect(context).not.toHaveTextContent('axisCmsSite');
  expect(context).not.toHaveTextContent('axisContentCatalog');
  await user.hover(context);
  expect(await screen.findByText('Application & technical details')).toBeVisible();
  expect(screen.getByText('axisCmsSite')).toBeVisible();
  expect(screen.getByText('axisContentCatalog')).toBeVisible();
});
