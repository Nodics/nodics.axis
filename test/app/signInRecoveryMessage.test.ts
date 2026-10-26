import { expect, it } from 'vitest';
import { getSignInErrorMessage } from '../../src/app/recoveryState';

it.each([
  'signal is aborted without reason',
  'This operation was aborted',
  'The operation was aborted.',
  'The user aborted a request.',
  'The operation was aborted due to timeout',
  'signal timed out',
])('sanitizes known browser interruption: %s', (detail) => {
  expect(getSignInErrorMessage(detail)).toBe(
    'Sign-in took too long or was interrupted. Please try again.',
  );
});

it('preserves owner denial rather than classifying arbitrary text as a timeout', () => {
  expect(getSignInErrorMessage('Sign-in was not accepted.')).toBe(
    'Sign-in was not accepted.',
  );
  expect(getSignInErrorMessage('An administrator aborted this application.')).toBe(
    'An administrator aborted this application.',
  );
});
