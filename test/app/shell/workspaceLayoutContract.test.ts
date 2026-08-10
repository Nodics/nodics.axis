import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');

function routePageFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return routePageFiles(path);
    return entry.endsWith('RoutePage.tsx') ? [path] : [];
  });
}

describe('Axis workspace layout contract', () => {
  it('keeps route-level spacing under the shared workspace boundary', () => {
    const violations = routePageFiles(sourceRoot)
      .filter((path) => !path.endsWith('/CmsRoutePage.tsx'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return !['<WorkspaceContainer', '<WorkbenchRoutePage', '<CmsRoutePage'].some(
          (boundary) => source.includes(boundary),
        );
      })
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });

  it('does not allow route pages to customize the workspace boundary', () => {
    const violations = routePageFiles(sourceRoot)
      .filter((path) =>
        /<WorkspaceContainer\s+(?:sx|style|className)=/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });
});
