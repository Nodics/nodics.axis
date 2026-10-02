/** Presentation-only deadline coverage; these fixtures do not certify live expiry. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApplicationDeadline } from '../../src/operations/enterprise/registration/ApplicationDeadline';

describe('Retained Profile application deadline', () => {
  it.each(['2099-04-05T13:30:00Z', '2020-01-01T08:00:00+04:00'])(
    'localizes %s without inferring an expired state',
    (deadlineAt) => {
      render(<ApplicationDeadline deadlineAt={deadlineAt} label="Review deadline" />);
      const time = screen.getByText(new Date(deadlineAt).toLocaleString());
      expect(time.tagName).toBe('TIME');
      expect(time).toHaveAttribute('datetime', deadlineAt);
      expect(screen.getByText(/Review deadline:/)).toBeInTheDocument();
      expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
    },
  );

  it.each([undefined, '', 'not-a-date', '2099-99-99T00:00:00Z'])(
    'omits absent or invalid timestamp %s safely',
    (deadlineAt) => {
      const { container } = render(
        <ApplicationDeadline deadlineAt={deadlineAt} label="Review deadline" />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each([undefined, '', '   '])('does not invent missing owner copy %s', (label) => {
    const { container } = render(
      <ApplicationDeadline deadlineAt="2099-04-05T13:30:00Z" label={label} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
