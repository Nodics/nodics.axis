import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DocumentationSourceNavigation } from '../../src/documentation/DocumentationSourceNavigation';

describe('published guide topic discovery', () => {
  it('filters delivered labels and sections, preserves exact routes, and recovers from no results', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentationSourceNavigation
          activePath="/docs"
          guide={{
            guide: 'project',
            label: 'Project',
            route: '/docs?guide=project&project=local',
            topics: [
              {
                id: 'one',
                label: 'Approval tasks',
                channelId: 'operations',
                channelLabel: 'Operations',
                route: '/docs/tasks',
                site: 'site',
                locale: 'en',
                channel: 'web',
                accessMode: 'AUTHENTICATED',
              },
              {
                id: 'two',
                label: 'First steps',
                channelId: 'start',
                channelLabel: 'Getting started',
                route: '/docs/start',
                site: 'site',
                locale: 'en',
                channel: 'web',
                accessMode: 'AUTHENTICATED',
              },
            ],
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2 topics');
    await user.type(
      screen.getByRole('searchbox', { name: 'Find a topic' }),
      'OPERATIONS approval',
    );
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 topics');
    expect(screen.getByRole('link', { name: 'Approval tasks' })).toHaveAttribute(
      'href',
      '/docs/tasks?guide=project&project=local',
    );
    expect(screen.queryByRole('link', { name: 'First steps' })).toBeNull();
    await user.type(screen.getByRole('searchbox'), ' absent');
    expect(screen.getByText('No topics match your search.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('link', { name: 'First steps' })).toBeVisible();
  });
});
