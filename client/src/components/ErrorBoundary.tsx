import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-wa-chat h-full min-h-[300px]">
          <div className="w-14 h-14 rounded-full bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-wa-primary">Something went wrong</h3>
          <p className="text-sm text-wa-secondary max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred in the chat area.'}
          </p>
          <button type="button"
            onClick={this.handleRetry}
            className="flex items-center space-x-2 px-5 py-2.5 bg-wa-sidebar hover:bg-[#18181b] border border-wa-border rounded-xl text-wa-green text-sm font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
