import React from "react";
import { AlertCircle, RotateCcw, Trash2, Copy, Check } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught runtime error captured by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleClearStorageAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  private handleCopyError = () => {
    if (!this.state.error) return;
    const errorDetails = `
Error: ${this.state.error.message}
Stack: ${this.state.error.stack}
Component Stack: ${this.state.errorInfo?.componentStack || "N/A"}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(err => {
      console.error("Failed to copy", err);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#05020c] flex items-center justify-center p-4 sm:p-6 font-sans text-zinc-100 select-none antialiased relative overflow-hidden">
          {/* Ambient background glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-2xl bg-zinc-950/80 border border-rose-500/20 rounded-[32px] p-6 sm:p-8 md:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative z-10 flex flex-col gap-6">
            
            {/* Header */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-lg animate-pulse">
                <AlertCircle className="w-9 h-9" />
              </div>
              <div>
                <h1 className="font-display font-black text-xl sm:text-2xl tracking-wider uppercase text-zinc-100">
                  Обнаружена ошибка <span className="text-rose-500">фронтенда</span>
                </h1>
                <p className="text-xs text-zinc-400 mt-1.5 max-w-lg leading-relaxed">
                  Произошел критический сбой JavaScript в процессе отрисовки интерфейса. Ошибка была перехвачена для предотвращения «черного экрана».
                </p>
              </div>
            </div>

            {/* Error Message Panel */}
            <div className="bg-zinc-900/90 border border-zinc-850 rounded-2xl p-4.5 font-mono text-xs overflow-auto max-h-64 select-text">
              <p className="text-rose-450 font-bold mb-2">
                {this.state.error && this.state.error.toString()}
              </p>
              {this.state.error && this.state.error.stack && (
                <pre className="text-zinc-500 text-[10px] leading-relaxed whitespace-pre-wrap break-all mt-1">
                  {this.state.error.stack}
                </pre>
              )}
              {this.state.errorInfo && this.state.errorInfo.componentStack && (
                <pre className="text-zinc-600 text-[10px] leading-relaxed whitespace-pre-wrap break-all mt-3 border-t border-zinc-800/60 pt-3">
                  Компонентный стек:
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-zinc-400" />
                Обновить страницу
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                className="py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    Скопировано!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-indigo-400" />
                    Скопировать лог
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleClearStorageAndReset}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-450 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Сбросить кэш и войти заново
              </button>
            </div>

            <div className="text-center">
              <p className="text-[10px] text-zinc-650 font-mono">
                Sferium Sync Error Interceptor • {window.location.hostname}
              </p>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
