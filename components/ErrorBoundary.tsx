'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      let errorMessage = "An unexpected error occurred.";
      let details = "";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = `Firestore ${parsed.operationType.toUpperCase()} Error`;
            details = parsed.error;
          }
        }
      } catch {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-8 rounded-[32px] bg-red-50 border-2 border-red-100 shadow-xl shadow-red-500/5">
            <div className="w-16 h-16 rounded-2xl bg-red-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2 tracking-tight">Something went wrong</h2>
            <p className="text-sm font-bold text-red-600 mb-6 uppercase tracking-widest">{errorMessage}</p>
            {details && (
              <div className="mb-6 p-4 rounded-2xl bg-white border border-red-100 text-xs font-mono text-gray-500 break-all">
                {details}
              </div>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#0E0C0B] text-white font-black text-sm tracking-widest hover:bg-black transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              TRY AGAIN
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
