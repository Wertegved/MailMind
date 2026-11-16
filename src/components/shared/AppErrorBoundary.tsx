import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';
import { clearState } from '../../services/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MailMind render error', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <h1 data-page-title="Something went wrong" className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-ink-muted">MailMind couldn&apos;t display this page. You can reload or reset the demo.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" variant="primary" onClick={() => window.location.reload()}>Reload</Button>
          <Button
            type="button"
            onClick={() => {
              clearState();
              window.location.assign('/onboarding');
            }}
          >
            Reset demo
          </Button>
        </div>
      </main>
    );
  }
}
