/** Axis application providers; shared command admission remains browser-owned. */
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import type { PropsWithChildren } from 'react';
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createBrowserRouter, NavigationType, useBlocker } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { RuntimeConfigContext } from '../runtime/RuntimeConfigContext';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { AxisThemeProvider } from './AxisThemeProvider';
import { createAxisQueryClient } from './axisQueryClient';
import {
  UnsavedNavigationContext,
  type UnsavedNavigationCopy,
} from './useUnsavedNavigationGuard';

interface AppProvidersProps extends PropsWithChildren {
  readonly runtimeConfig: AxisRuntimeConfig;
}

const AxisRouteContent = createContext<PropsWithChildren['children']>(null);

/** Holds user navigation while an editor has pending work. */
function AxisNavigationRoot() {
  const content = useContext(AxisRouteContent);
  const [guard, setGuard] = useState<UnsavedNavigationCopy>();
  const keepEditing = useRef<HTMLButtonElement>(null);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation, historyAction }) =>
      Boolean(guard) &&
      historyAction !== NavigationType.Replace &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  return (
    <UnsavedNavigationContext value={setGuard}>
      {content}
      {blocker.state === 'blocked' && guard ? (
        <Dialog
          open
          onClose={blocker.reset}
          slotProps={{ transition: { onEntered: () => keepEditing.current?.focus() } }}
          aria-labelledby="axis-unsaved-navigation-title"
          aria-describedby="axis-unsaved-navigation-description"
        >
          <DialogTitle id="axis-unsaved-navigation-title">{guard.title}</DialogTitle>
          <DialogContent id="axis-unsaved-navigation-description">
            {guard.description}
          </DialogContent>
          <DialogActions>
            <Button ref={keepEditing} onClick={blocker.reset}>
              {guard.keepEditing}
            </Button>
            <Button color="error" onClick={blocker.proceed}>
              {guard.leavePage}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </UnsavedNavigationContext>
  );
}

/** Shares one query client, deployment configuration, theme and browser router. */
export function AppProviders({ children, runtimeConfig }: AppProvidersProps) {
  const [queryClient] = useState(createAxisQueryClient);
  const [router, setRouter] = useState<ReturnType<typeof createBrowserRouter>>();
  useEffect(() => {
    const browserRouter = createBrowserRouter([
      { path: '*', element: <AxisNavigationRoot /> },
    ]);
    startTransition(() => setRouter(browserRouter));
    return () => browserRouter.dispose();
  }, []);

  return (
    <RuntimeConfigContext value={runtimeConfig}>
      <QueryClientProvider client={queryClient}>
        <AxisThemeProvider>
          <AxisRouteContent value={children}>
            {router ? <RouterProvider router={router} /> : null}
          </AxisRouteContent>
        </AxisThemeProvider>
      </QueryClientProvider>
    </RuntimeConfigContext>
  );
}
