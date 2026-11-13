import { Alert } from '@mui/material';
import { Component, type ReactNode } from 'react';

interface CmsRenderBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface CmsRenderBoundaryState {
  readonly failed: boolean;
}

export class CmsRenderBoundary extends Component<
  CmsRenderBoundaryProps,
  CmsRenderBoundaryState
> {
  public state: CmsRenderBoundaryState = { failed: false };

  public static getDerivedStateFromError(): CmsRenderBoundaryState {
    return { failed: true };
  }

  public componentDidCatch() {
    // A later telemetry slice may report a correlation-safe renderer failure.
  }

  public render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <Alert role="alert" severity="error">
            This page component could not be displayed safely.
          </Alert>
        )
      );
    }
    return this.props.children;
  }
}
