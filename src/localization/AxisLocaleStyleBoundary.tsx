import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { prefixer } from 'stylis';
import { useMemo, type PropsWithChildren } from 'react';

const caches = {
  ltr: createCache({ key: 'axis-ltr', stylisPlugins: [prefixer] }),
  rtl: createCache({ key: 'axis-rtl', stylisPlugins: [prefixer, rtlPlugin] }),
};
/** Direction changes presentation only; the authoring tree and its private state stay mounted. */
export function AxisLocaleStyleBoundary({
  direction,
  children,
}: PropsWithChildren<{ readonly direction: 'ltr' | 'rtl' }>) {
  const parent = useTheme();
  const theme = useMemo(() => ({ ...parent, direction }), [parent, direction]);
  return (
    <CacheProvider value={caches[direction]}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </CacheProvider>
  );
}
