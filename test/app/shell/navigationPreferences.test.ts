import { describe, expect, it } from 'vitest';

import {
  loadNavigationPreferences,
  navigationItemKey,
  navigationPreferenceStorageKey,
  recordRecentNavigation,
  saveNavigationPreferences,
  toggleNavigationFavourite,
} from '../../../src/app/shell/navigationPreferences';

const scope = {
  employeeId: 'alex@example.test',
  tenantCode: 'business',
  enterpriseCode: 'business',
  environments: ['local'],
};

describe('Axis navigation preferences', () => {
  it('stores only bounded stable module and item identifiers', () => {
    let saved = '';
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };
    let preferences = loadNavigationPreferences(scope, storage);
    const key = navigationItemKey('cms', 'content');
    preferences = toggleNavigationFavourite(preferences, key);
    preferences = recordRecentNavigation(preferences, key);
    saveNavigationPreferences(preferences, scope, storage);

    expect(loadNavigationPreferences(scope, storage)).toEqual({
      favourites: ['cms:content'],
      recents: ['cms:content'],
    });
    expect(saved).not.toContain('/content');
  });

  it('fails closed for malformed or sensitive-looking persisted values', () => {
    const preferences = loadNavigationPreferences(scope, {
      getItem: () =>
        JSON.stringify({
          favourites: ['cms:content', 'token=secret', '/content'],
          recents: {},
        }),
    });
    expect(preferences).toEqual({
      favourites: ['cms:content'],
      recents: [],
    });
  });

  it('applies the configured recent item limit', () => {
    let preferences = loadNavigationPreferences(
      scope,
      {
        getItem: () =>
          JSON.stringify({
            favourites: [],
            recents: ['cms:content', 'media:media', 'profile:tenant'],
          }),
      },
      { recentItems: 2 },
    );

    expect(preferences.recents).toEqual(['cms:content', 'media:media']);

    preferences = recordRecentNavigation(preferences, 'export:history', {
      recentItems: 2,
    });

    expect(preferences.recents).toEqual(['export:history', 'cms:content']);
  });

  it.each([
    { employeeId: 'another@example.test' },
    { tenantCode: 'another' },
    { enterpriseCode: 'another' },
    { environments: ['another'] },
  ])('isolates the exact presentation owner: %j', (change) => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const own = { favourites: ['cms:content'], recents: ['media:media'] };
    saveNavigationPreferences(own, scope, storage);
    expect(loadNavigationPreferences({ ...scope, ...change }, storage)).toEqual({
      favourites: [],
      recents: [],
    });
    saveNavigationPreferences(
      { favourites: [], recents: ['profile:enterprise'] },
      { ...scope, ...change },
      storage,
    );
    expect(loadNavigationPreferences(scope, storage)).toEqual(own);
    expect(values.size).toBe(2);
  });

  it('uses canonical environment sets and unambiguous owner tuples', () => {
    expect(
      navigationPreferenceStorageKey({ ...scope, environments: ['two', 'one', 'one'] }),
    ).toBe(navigationPreferenceStorageKey({ ...scope, environments: ['one', 'two'] }));
    expect(
      navigationPreferenceStorageKey({ ...scope, employeeId: 'a:b', tenantCode: 'c' }),
    ).not.toBe(
      navigationPreferenceStorageKey({ ...scope, employeeId: 'a', tenantCode: 'b.c' }),
    );
  });

  it('never reads or writes without complete ownership or adopts legacy browser-wide history', () => {
    const reads: string[] = [],
      writes: string[] = [];
    const storage = {
      getItem: (key: string) => {
        reads.push(key);
        return key.endsWith('-v1')
          ? JSON.stringify({ recents: ['cms:content'] })
          : null;
      },
      setItem: (key: string) => {
        writes.push(key);
      },
    };
    for (const missing of [
      undefined,
      { ...scope, employeeId: '' },
      { ...scope, tenantCode: '' },
      { ...scope, enterpriseCode: '' },
      { ...scope, environments: [] },
    ]) {
      expect(loadNavigationPreferences(missing, storage).recents).toEqual([]);
      saveNavigationPreferences(
        { favourites: [], recents: ['cms:content'] },
        missing,
        storage,
      );
    }
    expect(reads).toEqual([]);
    expect(writes).toEqual([]);
    expect(loadNavigationPreferences(scope, storage).recents).toEqual([]);
    expect(reads).not.toContain('nodics-axis-navigation-preferences-v1');
  });

  it('keeps navigation usable when preference storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadNavigationPreferences(scope, storage).recents).toEqual([]);
    expect(() =>
      saveNavigationPreferences(
        { favourites: [], recents: ['cms:content'] },
        scope,
        storage,
      ),
    ).not.toThrow();
  });
});
