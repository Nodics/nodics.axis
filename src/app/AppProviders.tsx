/** Axis application providers; shared command admission remains browser-owned. */
import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';

import { RuntimeConfigContext } from '../runtime/RuntimeConfigContext';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { AxisThemeProvider } from './AxisThemeProvider';
import { createAxisQueryClient } from './axisQueryClient';

interface AppProvidersProps extends PropsWithChildren {
  readonly runtimeConfig: AxisRuntimeConfig;
}

/** Shares one query client, deployment configuration, theme and browser router. */
export function AppProviders({ children, runtimeConfig }: AppProvidersProps) {
  const [queryClient] = useState(createAxisQueryClient);

  return (
    <RuntimeConfigContext value={runtimeConfig}>
      <QueryClientProvider client={queryClient}>
        <AxisThemeProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </AxisThemeProvider>
      </QueryClientProvider>
    </RuntimeConfigContext>
  );
}
