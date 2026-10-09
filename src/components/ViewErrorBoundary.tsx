import React from 'react';
import { isChunkLoadError, clearAllChunkRetryFlags } from '../lib/lazyWithRetry';
import { RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

interface ViewErrorBoundaryProps {
  viewName: string;
  children: React.ReactNode;
  onBack?: () => void;
  language?: 'ka' | 'en';
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ViewErrorBoundary extends React.Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ViewErrorBoundary:${this.props.viewName}] Caught error:`, error, errorInfo);
  }

  handleReload = () => {
    clearAllChunkRetryFlags();
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);
      const isKa = this.props.language === 'ka';
      const viewTitle = this.props.viewName;

      return (
        <div className="min-h-[400px] h-full w-full flex flex-col items-center justify-center p-6 bg-proton-bg text-proton-text">
          <div className="max-w-md w-full bg-proton-card/80 border border-proton-border/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
            {/* Background glowing indicator */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-proton-accent/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-proton-accent/5 rounded-full blur-2xl pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 text-proton-accent flex items-center justify-center mx-auto mb-5 shadow-inner">
              {isChunk ? <RefreshCw className="animate-spin-slow" size={26} /> : <AlertTriangle size={26} />}
            </div>

            <h2 className="text-lg font-bold tracking-tight mb-2 text-proton-text font-mono uppercase">
              {isChunk
                ? (isKa ? 'მოდულის განახლება ხელმისაწვდომია' : 'Module Update Available')
                : (isKa ? 'შეფერხება მოდულში' : `${viewTitle} Encountered an Issue`)}
            </h2>

            <p className="text-xs text-proton-muted leading-relaxed mb-6 font-sans">
              {isChunk
                ? (isKa
                    ? `სისტემაში განახლდა ${viewTitle}-ის ვერსია. გთხოვთ დააჭიროთ განახლებას უახლესი ვერსიის ჩასატვირთად.`
                    : `A new version of ${viewTitle} was deployed. Please refresh to load the latest release seamlessly.`)
                : (isKa
                    ? `დროებით ვერ მოხერხდა ${viewTitle}-ის ჩატვირთვა. სცადეთ თავიდან ან დაბრუნდით მთავარ პანელზე.`
                    : `Unable to initialize ${viewTitle}. You can retry loading or return to the main dashboard.`)}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-proton-accent hover:bg-proton-accent/90 text-proton-bg font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-proton-accent/20 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>{isKa ? 'განახლება' : 'Reload & Update'}</span>
              </button>

              {this.props.onBack ? (
                <button
                  type="button"
                  onClick={this.props.onBack}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-proton-border hover:bg-proton-muted/10 text-proton-text font-mono text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>{isKa ? 'დაბრუნება' : 'Go Back'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-proton-border hover:bg-proton-muted/10 text-proton-text font-mono text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isKa ? 'თავიდან ცდა' : 'Try Again'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
