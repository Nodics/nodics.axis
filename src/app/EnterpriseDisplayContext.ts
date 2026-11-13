import { createContext } from 'react';
import type { CurrentEnterpriseDisplay } from '../bootstrap/currentEnterpriseDisplay';

/** Current Profile-projected label only; request scope always remains the original authenticated runtime context. */
export const EnterpriseDisplayContext = createContext<
  CurrentEnterpriseDisplay | undefined
>(undefined);
