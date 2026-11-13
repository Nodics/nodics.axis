import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearScreenLock,
  persistScreenLock,
  restoreScreenLock,
  screenLockReturnLocation,
} from '../../src/auth/screenLockState';

describe('screen lock state', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('restores a bounded same-application return path without credentials', () => {
    persistScreenLock('/docs/framework');

    expect(restoreScreenLock()).toEqual({
      locked: true,
      returnPath: '/docs/framework',
    });
    expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).not.toContain(
      'token',
    );
  });

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    '/login',
    '/forgot-password',
    '/lock-screen',
    '/unsafe\\path',
    '/login?returnTo=/process/tasks',
    '/lock-screen#details',
    '/unsafe\npath',
  ])('replaces unsafe return path %s with the dashboard', (returnPath) => {
    persistScreenLock(returnPath);
    expect(restoreScreenLock()?.returnPath).toBe('/dashboard');
  });

  it('keeps the router detail context only in memory, without imposing the stored-marker limit on valid filters', () => {
    const search = '?instanceCode=review-100&filter=' + 'x'.repeat(600);
    expect(screenLockReturnLocation('/process/tasks', search, '#review-details')).toBe(
      '/process/tasks' + search + '#review-details',
    );
    expect(window.sessionStorage.length).toBe(0);
    persistScreenLock('/process/tasks');
    expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).not.toContain(
      'review-100',
    );
  });

  it.each([
    'https://foreign.example',
    '//foreign.example',
    '/unsafe\\path',
    '/login',
    '/forgot-password',
    '/lock-screen',
    '/login?x=1',
  ])('rejects an unsafe volatile destination %s', (path) => {
    expect(screenLockReturnLocation(path, '?instanceCode=private', '#details')).toBe(
      '/dashboard',
    );
  });

  it.each([
    ['bad-search', '#details'],
    ['?record=one', 'bad-fragment'],
    ['?record=\\foreign', '#details'],
    ['?record=one\n', '#details'],
  ])(
    'drops malformed context while retaining the safe local pathname',
    (search, hash) => {
      expect(screenLockReturnLocation('/process/tasks', search, hash)).toBe(
        '/process/tasks',
      );
    },
  );

  it('removes malformed state and clears state explicitly', () => {
    window.sessionStorage.setItem('nodics-axis-screen-lock-v1', '{bad');
    expect(restoreScreenLock()).toBeUndefined();
    expect(window.sessionStorage.getItem('nodics-axis-screen-lock-v1')).toBeNull();

    persistScreenLock('/assistant');
    clearScreenLock();
    expect(restoreScreenLock()).toBeUndefined();
  });
});
