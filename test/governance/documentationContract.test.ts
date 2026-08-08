/*
    Nodics - Enterprice Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is the confidential and proprietary information of Nodics ("Confidential Information").
    You shall not disclose such Confidential Information and shall use it only in accordance with the
    terms of the license agreement you entered into with Nodics.

 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Axis documentation and backend-data boundary', () => {
  it('does not ship backend-importable CMS or documentation content-pack data', () => {
    expect(fs.existsSync(path.join(root, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'content', 'documentation'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'manifest', 'docs-content-pack.json'))).toBe(
      false,
    );
  });

  it('keeps package verification frontend-only', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      readonly scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['docs:generate']).toBeUndefined();
    expect(packageJson.scripts?.['docs:check']).toBeUndefined();
    expect(packageJson.scripts?.verify ?? '').not.toContain('docs:check');
  });

  it('documents that backend-importable CMS content belongs to backend modules', () => {
    const agents = read('AGENTS.md');

    expect(agents).toContain('Axis must not own backend-importable CMS');
    expect(agents).toContain('`nodics.platform/modules/axis`');
    expect(agents).toContain('customer documentation');
    expect(agents).toContain('Axis owns the executable React renderers');
  });
});
