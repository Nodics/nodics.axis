import { describe, expect, it, vi } from 'vitest';

import {
  observeEmployeeSessionResponse,
  subscribeEmployeeSessionExpired,
} from '../../src/auth/employeeSessionEvents';

describe('private employee session expiry signal', () => {
  it('requires an issued token and positive admission generation; 403 stays local', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEmployeeSessionExpired(listener);
    try {
      expect(observeEmployeeSessionResponse({ status: 403 }, 'issued', 1)).toBe(false);
      expect(observeEmployeeSessionResponse({ status: 401 })).toBe(false);
      for (const generation of [undefined, 0, -1, NaN, 1.5])
        expect(
          observeEmployeeSessionResponse({ status: 401 }, 'issued', generation),
        ).toBe(true);
      expect(listener).not.toHaveBeenCalled();
      expect(observeEmployeeSessionResponse({ status: 401 }, 'issued', 2)).toBe(true);
      expect(listener).toHaveBeenCalledExactlyOnceWith({
        accessToken: 'issued',
        generation: 2,
      });
      expect(Object.isFrozen(listener.mock.calls[0]?.[0])).toBe(true);
    } finally {
      unsubscribe();
    }
    observeEmployeeSessionResponse({ status: 401 }, 'issued', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
