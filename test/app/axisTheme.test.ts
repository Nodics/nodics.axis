import { describe, expect, it } from 'vitest';

import { axisTokens, createAxisTheme } from '../../src/app/axisTheme';

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
