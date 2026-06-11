import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 12, padding: 24,
            color: 'var(--muted)', textAlign: 'center',
          }}>
            <p style={{ margin: 0 }}>Excalidraw failed to render.</p>
            <button onClick={this.handleReset} style={{
              padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--panel)',
              color: 'var(--text)',
            }}>
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
