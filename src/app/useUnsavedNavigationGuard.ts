import { createContext, useContext, useEffect } from 'react';

import { useAxisLocalization } from '../localization/AxisLocalizationContext';

export interface UnsavedNavigationCopy {
  readonly title: string;
  readonly description: string;
  readonly keepEditing: string;
  readonly leavePage: string;
}

export const UnsavedNavigationContext = createContext<
  ((copy: UnsavedNavigationCopy | undefined) => void) | undefined
>(undefined);

/** Registers the mounted editor and its current language with the Axis router. */
export function useUnsavedNavigationGuard(hasChanges: boolean) {
  const setGuard = useContext(UnsavedNavigationContext);
  const { format } = useAxisLocalization();

  useEffect(() => {
    if (!hasChanges || !setGuard) return;

    setGuard({
      title: format('common.unsaved.leave-title', 'Leave this page?'),
      description: format(
        'common.unsaved.description',
        'Changes you have not saved will be lost.',
      ),
      keepEditing: format('common.unsaved.keep-editing', 'Keep editing'),
      leavePage: format('common.unsaved.leave-page', 'Leave page'),
    });

    return () => setGuard(undefined);
  }, [format, hasChanges, setGuard]);
}
