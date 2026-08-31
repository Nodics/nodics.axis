import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => {
    const emptyRects: DOMRect[] = [];
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: () => emptyRects[Symbol.iterator](),
    };
  };
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top: 0,
    width: 0,
    x: 0,
    y: 0,
  });
}

afterEach(() => {
  cleanup();
});
