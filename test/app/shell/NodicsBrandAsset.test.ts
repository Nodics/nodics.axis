import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '../../..');

describe('final Nodics application brand asset', () => {
  it('keeps the approved favicon geometry, colors, and Times New Roman glyph', () => {
    const favicon = fs.readFileSync(
      path.join(projectRoot, 'public/brand/favicon.svg'),
      'utf8',
    );

    expect(favicon).toContain('stroke="#F5C400"');
    expect(favicon).toContain('fill="#242629"');
    expect(favicon).toContain('fill="#FFFFFF"');
    expect(favicon).toContain('font-family="Times New Roman, Times, serif"');
    expect(favicon).toContain('font-weight="400"');
    expect(favicon).toContain('>N</text>');
  });

  it('keeps the application favicon connected to the approved asset', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

    expect(html).toContain('/brand/favicon.svg?v=4');
  });
});
