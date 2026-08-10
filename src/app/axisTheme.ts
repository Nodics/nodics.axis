import { alpha, createTheme, type PaletteMode } from '@mui/material/styles';

const axisFontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const gold = {
  50: '#fff9db',
  100: '#fff0a3',
  300: '#ffd94a',
  500: '#f5c400',
  600: '#d9ac00',
  700: '#9a7900',
  900: '#4a3a00',
};

const charcoal = {
  50: '#f7f7f5',
  100: '#ecece8',
  300: '#939aa2',
  500: '#61676e',
  700: '#3e4349',
  900: '#25292c',
  950: '#1b1e20',
};

export const axisTokens = {
  color: {
    gold,
    charcoal,
    signatureGold: gold[500],
    success: '#147a55',
    warning: '#a95808',
    error: '#bd3347',
    info: '#1769aa',
    surface: {
      light: {
        canvas: '#f4f6f8',
        raised: '#ffffff',
        muted: '#f8f9fa',
        sunken: '#eef1f4',
        navigation: '#ffffff',
        border: '#e1e5e9',
        borderStrong: '#cbd1d7',
      },
      dark: {
        canvas: '#171a1d',
        raised: '#202428',
        muted: '#252a2e',
        sunken: '#121416',
        navigation: '#1b1e20',
        border: '#353b40',
        borderStrong: '#4a5157',
      },
    },
  },
  spacing: {
    shellRail: 264,
    shellRailCompact: 76,
    header: 64,
    context: 48,
    grid: 8,
    pageGutter: {
      mobile: 8,
      tablet: 8,
      desktop: 8,
    },
    contentMaxWidth: 1440,
    cardPadding: 24,
  },
  radius: {
    small: 6,
    medium: 10,
    large: 14,
    pill: 999,
  },
  motion: {
    fast: '120ms',
    standard: '180ms',
    deliberate: '240ms',
  },
  typography: {
    fontFamily: axisFontFamily,
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
} as const;

export function createAxisTheme(mode: PaletteMode) {
  const surface = axisTokens.color.surface[mode];
  const primaryText = mode === 'light' ? charcoal[900] : '#f7f8f8';
  const secondaryText = mode === 'light' ? charcoal[500] : '#aeb5bc';

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: axisTokens.color.signatureGold,
        contrastText: charcoal[900],
      },
      secondary: {
        main: mode === 'light' ? charcoal[700] : charcoal[300],
      },
      background: {
        default: surface.canvas,
        paper: surface.raised,
      },
      text: {
        primary: primaryText,
        secondary: secondaryText,
      },
      divider: surface.border,
      action: {
        active: secondaryText,
        hover: alpha(primaryText, 0.06),
        selected: alpha(axisTokens.color.signatureGold, mode === 'light' ? 0.16 : 0.2),
        focus: alpha(axisTokens.color.signatureGold, 0.24),
        disabled: alpha(primaryText, 0.34),
        disabledBackground: alpha(primaryText, 0.08),
      },
      success: { main: axisTokens.color.success },
      warning: { main: axisTokens.color.warning },
      error: { main: axisTokens.color.error },
      info: { main: axisTokens.color.info },
    },
    typography: {
      fontFamily: axisFontFamily,
      fontSize: 14,
      fontWeightRegular: axisTokens.typography.weight.regular,
      fontWeightMedium: axisTokens.typography.weight.medium,
      fontWeightBold: axisTokens.typography.weight.bold,
      h1: {
        fontSize: 'clamp(2rem, 2.5vw, 2.5rem)',
        fontWeight: axisTokens.typography.weight.bold,
        letterSpacing: '-0.035em',
        lineHeight: 1.15,
      },
      h2: {
        fontSize: 'clamp(1.625rem, 2vw, 2rem)',
        fontWeight: axisTokens.typography.weight.bold,
        letterSpacing: '-0.025em',
        lineHeight: 1.2,
      },
      h3: {
        fontSize: 'clamp(1.375rem, 1.5vw, 1.625rem)',
        fontWeight: axisTokens.typography.weight.bold,
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: axisTokens.typography.weight.bold,
        letterSpacing: '-0.015em',
        lineHeight: 1.3,
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: axisTokens.typography.weight.semibold,
        letterSpacing: '-0.01em',
        lineHeight: 1.35,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: axisTokens.typography.weight.semibold,
        lineHeight: 1.4,
      },
      subtitle1: {
        fontSize: '0.9375rem',
        fontWeight: axisTokens.typography.weight.semibold,
        lineHeight: 1.45,
      },
      subtitle2: {
        fontSize: '0.8125rem',
        fontWeight: axisTokens.typography.weight.bold,
        lineHeight: 1.45,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.8125rem',
        lineHeight: 1.55,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.45,
      },
      button: {
        fontSize: '0.8125rem',
        fontWeight: axisTokens.typography.weight.bold,
        letterSpacing: '0.01em',
        lineHeight: 1.25,
        textTransform: 'none',
      },
      overline: {
        fontSize: '0.6875rem',
        fontWeight: axisTokens.typography.weight.extrabold,
        letterSpacing: '0.14em',
        lineHeight: 1.5,
      },
    },
    shape: {
      borderRadius: axisTokens.radius.medium,
    },
    spacing: axisTokens.spacing.grid,
    transitions: {
      duration: {
        shortest: 120,
        shorter: 150,
        short: 180,
        standard: 240,
        complex: 300,
        enteringScreen: 240,
        leavingScreen: 180,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: mode,
          },
          '::selection': {
            backgroundColor: mode === 'light' ? gold[100] : gold[700],
          },
          ':focus-visible': {
            outline: `3px solid ${mode === 'light' ? gold[500] : gold[300]}`,
            outlineOffset: 2,
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              scrollBehavior: 'auto !important',
              transitionDuration: '0.01ms !important',
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
            },
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
          size: 'medium',
        },
        styleOverrides: {
          root: {
            borderRadius: axisTokens.radius.small,
            minHeight: 42,
            '&.MuiButton-containedPrimary:hover': {
              backgroundColor: gold[600],
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            fontWeight: axisTokens.typography.weight.medium,
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            fontSize: '0.75rem',
            lineHeight: 1.45,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            minWidth: 44,
            '&:hover': {
              backgroundColor: alpha(primaryText, 0.06),
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: surface.raised,
            color: primaryText,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: surface.navigation,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${surface.border}`,
            boxShadow:
              mode === 'light'
                ? '0 1px 2px rgba(27, 30, 32, 0.04)'
                : '0 1px 2px rgba(0, 0, 0, 0.2)',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: surface.border,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              backgroundColor: alpha(
                axisTokens.color.signatureGold,
                mode === 'light' ? 0.16 : 0.2,
              ),
              color: primaryText,
            },
            '&.Mui-selected:hover': {
              backgroundColor: alpha(
                axisTokens.color.signatureGold,
                mode === 'light' ? 0.22 : 0.26,
              ),
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: surface.raised,
            borderRadius: axisTokens.radius.small,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: surface.borderStrong,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: secondaryText,
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${surface.border}`,
            borderRadius: axisTokens.radius.medium,
            boxShadow:
              mode === 'light'
                ? '0 12px 32px rgba(27, 30, 32, 0.12)'
                : '0 12px 32px rgba(0, 0, 0, 0.36)',
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: gold[100],
            color: charcoal[900],
            fontWeight: axisTokens.typography.weight.bold,
          },
        },
      },
      MuiChip: {
        defaultProps: {
          size: 'medium',
        },
        styleOverrides: {
          root: {
            borderRadius: axisTokens.radius.pill,
          },
          label: {
            fontSize: '0.75rem',
            fontWeight: axisTokens.typography.weight.semibold,
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontSize: '0.8125rem',
            fontWeight: axisTokens.typography.weight.semibold,
            lineHeight: 1.4,
          },
          secondary: {
            fontSize: '0.75rem',
            lineHeight: 1.4,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            lineHeight: 1.5,
          },
          head: {
            fontSize: '0.75rem',
            fontWeight: axisTokens.typography.weight.bold,
            letterSpacing: '0.025em',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.75rem',
            lineHeight: 1.4,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: axisTokens.spacing.cardPadding,
            '&:last-child': {
              paddingBottom: axisTokens.spacing.cardPadding,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${surface.border}`,
            borderRadius: axisTokens.radius.large,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: 24,
            paddingBottom: 12,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '12px 24px',
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            gap: 8,
            padding: 24,
            paddingTop: 12,
          },
        },
      },
    },
  });
}
