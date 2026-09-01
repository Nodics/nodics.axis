import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AxisThemeProvider } from '../../src/app/AxisThemeProvider';
import { RecoveryScreen } from '../../src/app/RecoveryScreen';
import { getRecoveryContent, type RecoveryKind } from '../../src/app/recoveryState';
import { canRenderWorkbenchNavigation } from '../../src/app/workbenchNavigationPolicy';

describe('Axis Phase 2 foundation', () => {
  it.each<RecoveryKind>([
    'configuration',
    'profile',
    'backoffice',
    'cms',
    'contract',
    'module',
    'unauthorized',
    'offline',
    'unexpected',
  ])('defines safe recovery content for %s failures', (kind) => {
    const content = getRecoveryContent(kind);
    expect(content.title).not.toHaveLength(0);
    expect(content.description).not.toHaveLength(0);
  });

  it('renders retry safety and a correlation reference', () => {
    render(
      <AxisThemeProvider>
        <RecoveryScreen
          state={{
            kind: 'module',
            detail: 'Inventory is temporarily unavailable.',
            correlationId: 'axis-correlation-1',
            retryable: true,
          }}
          onRetry={() => undefined}
        />
      </AxisThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'The requested module is unavailable' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/axis-correlation-1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry module' })).toBeInTheDocument();
  });

  it('allows schema-backed Waste workbench navigation without an invented module endpoint', () => {
    const bootstrap = {
      moduleConnections: {
        backoffice: [
          {
            moduleName: 'backoffice',
            instanceId: 'kickoffLocal:platformServer:backoffice:0',
            endpoint: 'https://platform.example.com/nodics/backoffice',
            environment: 'kickoffLocal',
            server: 'platformServer',
            state: 'UP',
          },
        ],
      },
    } as never;
    const navigation = {
      id: 'waste-submissions',
      label: 'Submissions',
      route: '/waste/submissions',
      order: 1430,
      moduleName: 'wasteSubmission',
      category: 'sustainability',
      icon: 'waste',
      availability: 'UP',
      workbenchTarget: {
        moduleName: 'wasteSubmission',
        schemaName: 'wasteSubmission',
      },
    } as never;

    expect(canRenderWorkbenchNavigation(bootstrap, navigation)).toBe(true);
  });
});
