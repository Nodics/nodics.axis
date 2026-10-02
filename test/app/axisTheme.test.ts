import { describe, expect, it } from 'vitest';
import {
  alpha,
  createTheme,
  decomposeColor,
  getContrastRatio,
  type Theme,
} from '@mui/material/styles';
import type { CSSObject } from '@mui/system';
import { Button, InputLabel, Tab, Tabs, ThemeProvider } from '@mui/material';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { axisTokens, createAxisTheme } from '../../src/app/axisTheme';

const unfilledPrimarySelector =
  '&.MuiButton-text.MuiButton-colorPrimary:not(.Mui-disabled), &.MuiButton-outlined.MuiButton-colorPrimary:not(.Mui-disabled)';
const outlinedPrimarySelector =
  '&.MuiButton-outlined.MuiButton-colorPrimary:not(.Mui-disabled)';
const selectedTabSelector = '&.MuiTab-textColorPrimary.Mui-selected:not(.Mui-disabled)';
const focusedLabelSelector =
  '&.MuiFormLabel-colorPrimary.Mui-focused:not(.Mui-disabled):not(.Mui-error)';

/** Evaluates state-label overrides using the same composed theme as MUI. */
function stateLabelStyles(
  theme: Theme,
  component: 'MuiTab' | 'MuiInputLabel',
): CSSObject {
  const override = theme.components?.[component]?.styleOverrides?.root;
  if (typeof override !== 'function')
    throw new Error('Expected state-label theme override');
  return override({ theme, ownerState: {} }) as CSSObject;
}

/** Evaluates the production override with the resolved default or project-composed theme. */
function buttonStyles(theme: Theme): CSSObject {
  const override = theme.components?.MuiButton?.styleOverrides?.root;
  if (typeof override !== 'function')
    throw new Error('Expected resolved button theme override');
  return override({ theme, ownerState: {} }) as CSSObject;
}

/** Composites the real hover/border alpha onto a surface before checking contrast. */
function composite(foreground: string, background: string): string {
  const front = decomposeColor(foreground).values;
  const back = decomposeColor(background).values;
  const opacity = front[3] ?? 1;
  return `rgb(${front
    .slice(0, 3)
    .map((value, index) => {
      const backgroundChannel = back[index];
      if (backgroundChannel === undefined) throw new Error('Expected RGB surface');
      return Math.round(value * opacity + backgroundChannel * (1 - opacity));
    })
    .join(', ')})`;
}

describe('Axis typography theme', () => {
  it('uses one shared font stack and accessible body sizing', () => {
    const theme = createAxisTheme('light');

    expect(theme.typography.fontFamily).toBe(axisTokens.typography.fontFamily);
    expect(theme.typography.body1.fontSize).toBe('0.9375rem');
    expect(theme.typography.body1.lineHeight).toBe(1.6);
    expect(theme.typography.body2.fontSize).toBe('0.8125rem');
  });

  it('keeps heading hierarchy compact enough for an enterprise workspace', () => {
    const theme = createAxisTheme('light');

    expect(theme.typography.h1.fontSize).toBe('clamp(2rem, 2.5vw, 2.5rem)');
    expect(theme.typography.h3.fontSize).toBe('clamp(1.375rem, 1.5vw, 1.625rem)');
    expect(theme.typography.h6.fontSize).toBe('1rem');
  });

  it('keeps readable type sizes stable in the fixed comfortable workspace', () => {
    const theme = createAxisTheme('dark');

    expect(theme.typography.body1.fontSize).toBe('0.9375rem');
    expect(theme.typography.button.fontSize).toBe('0.8125rem');
  });
});

describe('Axis color theme', () => {
  it('uses the approved signature gold in both color modes', () => {
    const light = createAxisTheme('light');
    const dark = createAxisTheme('dark');

    expect(light.palette.primary.main).toBe('#f5c400');
    expect(dark.palette.primary.main).toBe('#f5c400');
    expect(light.palette.primary.contrastText).toBe('#25292c');
  });

  it('gives light and dark workspaces distinct governed surfaces', () => {
    const light = createAxisTheme('light');
    const dark = createAxisTheme('dark');

    expect(light.palette.background.default).toBe('#f4f6f8');
    expect(light.palette.background.paper).toBe('#ffffff');
    expect(dark.palette.background.default).toBe('#171a1d');
    expect(dark.palette.background.paper).toBe('#202428');
    expect(light.palette.divider).not.toBe(dark.palette.divider);
  });
});

describe('Axis primary button contrast', () => {
  it('matches the enabled-only contrast selectors to actual MUI button markup', () => {
    const theme = createAxisTheme('light');
    const markup = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        { theme },
        createElement(Button, { variant: 'outlined', color: 'primary' }, 'Review'),
        createElement(Button, { variant: 'text', color: 'primary' }, 'Refresh'),
        createElement(
          Button,
          { variant: 'outlined', color: 'primary', disabled: true },
          'Disabled',
        ),
        createElement(Button, { variant: 'contained', color: 'primary' }, 'Save'),
        createElement(Button, { variant: 'outlined', color: 'secondary' }, 'Secondary'),
      ),
    );
    const document = new DOMParser().parseFromString(markup, 'text/html');
    const buttons = Array.from(document.querySelectorAll('button'));
    const selectors = unfilledPrimarySelector.replaceAll('&', '');
    expect(buttons.map((button) => button.matches(selectors))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(buttonStyles(theme)[unfilledPrimarySelector]).toBeDefined();
  });
  it('gives light unfilled labels and outlined borders readable default and hover contrast', () => {
    const theme = createAxisTheme('light');
    const styles = buttonStyles(theme);
    const label = styles[unfilledPrimarySelector] as CSSObject;
    const border = styles[outlinedPrimarySelector] as CSSObject;
    expect(label.color).toBe(theme.palette.text.primary);
    expect(border.borderColor).toBe(alpha(theme.palette.text.primary, 0.6));
    const hover = (label['@media (hover: hover)'] as CSSObject)['&:hover'] as CSSObject;
    for (const surface of [
      theme.palette.background.paper,
      theme.palette.background.default,
    ]) {
      expect(getContrastRatio(String(label.color), surface)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        getContrastRatio(
          String(label.color),
          composite(String(hover.backgroundColor), surface),
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(composite(String(border.borderColor), surface), surface),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not apply unfilled contrast overrides to dark mode or disabled/other-color buttons', () => {
    const dark = buttonStyles(createAxisTheme('dark'));
    expect(dark[unfilledPrimarySelector]).toBeUndefined();
    expect(dark[outlinedPrimarySelector]).toBeUndefined();
    const light = buttonStyles(createAxisTheme('light'));
    expect(
      Object.keys(light).filter((key) => key.includes('not(.Mui-disabled)')),
    ).toEqual([unfilledPrimarySelector, outlinedPrimarySelector]);
    expect(unfilledPrimarySelector).not.toContain('contained');
    expect(unfilledPrimarySelector).not.toContain('Secondary');
  });

  it('preserves contained brand colors and the existing hover in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const theme = createAxisTheme(mode);
      expect(theme.palette.primary.main).toBe(axisTokens.color.signatureGold);
      expect(theme.palette.primary.contrastText).toBe(axisTokens.color.charcoal[900]);
      expect(buttonStyles(theme)['&.MuiButton-containedPrimary:hover']).toEqual({
        backgroundColor: axisTokens.color.gold[600],
      });
    }
  });

  it('uses project-composed text and hover tokens rather than capturing default colors', () => {
    const theme = createTheme({
      palette: {
        mode: 'light',
        text: { primary: '#164c66' },
        action: { hoverOpacity: 0.08 },
      },
      components: createAxisTheme('light').components,
    });
    const label = buttonStyles(theme)[unfilledPrimarySelector] as CSSObject;
    expect(label.color).toBe('#164c66');
    const hover = (label['@media (hover: hover)'] as CSSObject)['&:hover'] as CSSObject;
    expect(hover.backgroundColor).toBe(alpha('#164c66', 0.08));
  });
});

describe('Axis selected tab and focused label contrast', () => {
  it('matches only enabled selected primary tabs and nonerror focused primary labels in actual MUI markup', () => {
    const markup = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        { theme: createAxisTheme('light') },
        createElement(
          Tabs,
          { value: 0, textColor: 'primary' },
          createElement(Tab, { label: 'Selected' }),
          createElement(Tab, { label: 'Unselected' }),
        ),
        createElement(
          Tabs,
          { value: 0, textColor: 'primary' },
          createElement(Tab, { label: 'Disabled', disabled: true }),
        ),
        createElement(
          Tabs,
          { value: 0, textColor: 'secondary' },
          createElement(Tab, { label: 'Secondary' }),
        ),
        createElement(InputLabel, { focused: true }, 'Focused'),
        createElement(InputLabel, {}, 'Unfocused'),
        createElement(InputLabel, { focused: true, disabled: true }, 'Disabled'),
        createElement(InputLabel, { focused: true, error: true }, 'Error'),
        createElement(InputLabel, { focused: true, color: 'secondary' }, 'Secondary'),
      ),
    );
    const document = new DOMParser().parseFromString(markup, 'text/html');
    expect(
      Array.from(document.querySelectorAll('[role="tab"]')).map((tab) =>
        tab.matches(selectedTabSelector.slice(1)),
      ),
    ).toEqual([true, false, false, false]);
    expect(
      Array.from(document.querySelectorAll('label')).map((label) =>
        label.matches(focusedLabelSelector.slice(1)),
      ),
    ).toEqual([true, false, false, false, false]);
  });

  it('uses readable composed text for both light state labels without overriding gold indicator or outline', () => {
    const theme = createAxisTheme('light');
    for (const [component, selector] of [
      ['MuiTab', selectedTabSelector],
      ['MuiInputLabel', focusedLabelSelector],
    ] as const) {
      const state = stateLabelStyles(theme, component)[selector] as CSSObject;
      expect(state).toEqual({ color: theme.palette.text.primary });
      for (const surface of [
        theme.palette.background.paper,
        theme.palette.background.default,
      ]) {
        expect(getContrastRatio(String(state.color), surface)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
    expect(theme.palette.primary.main).toBe(axisTokens.color.signatureGold);
    expect(theme.components?.MuiTabs).toBeUndefined();
    expect(theme.components?.MuiOutlinedInput?.styleOverrides).not.toHaveProperty(
      'focused',
    );
  });

  it('leaves dark state colors untouched and follows custom composed text colors', () => {
    const dark = createAxisTheme('dark');
    expect(stateLabelStyles(dark, 'MuiTab')[selectedTabSelector]).toBeUndefined();
    expect(
      stateLabelStyles(dark, 'MuiInputLabel')[focusedLabelSelector],
    ).toBeUndefined();
    const custom = createTheme({
      palette: { mode: 'light', text: { primary: '#164c66' } },
      components: createAxisTheme('light').components,
    });
    expect(stateLabelStyles(custom, 'MuiTab')[selectedTabSelector]).toEqual({
      color: '#164c66',
    });
    expect(stateLabelStyles(custom, 'MuiInputLabel')[focusedLabelSelector]).toEqual({
      color: '#164c66',
    });
  });
});

describe('Axis spacing and surface theme', () => {
  it('uses a stable eight pixel layout grid', () => {
    const theme = createAxisTheme('light');

    expect(theme.spacing(1)).toContain('8px');
    expect(axisTokens.spacing.contentMaxWidth).toBe(1440);
    expect(axisTokens.spacing.pageGutter).toEqual({
      mobile: 8,
      tablet: 8,
      desktop: 8,
    });
  });

  it('uses the governed comfortable component padding', () => {
    expect(axisTokens.spacing.cardPadding).toBe(24);
    expect(axisTokens.radius.large).toBe(14);
  });
});
