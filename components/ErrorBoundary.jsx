'use client';

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    // TODO: send to Sentry or your error reporting service
    // Sentry.captureException(error, { extra: info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '2rem',
            background: 'var(--clr-bg, #0f0f13)',
            color: 'var(--clr-text, #e8eaf0)',
            fontFamily: 'Inter, sans-serif',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: 'var(--clr-text-secondary, #9ca3af)', maxWidth: '420px' }}>
            An unexpected error occurred. Refreshing the page usually fixes this.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre
              style={{
                background: '#1e1e2e',
                border: '1px solid #2a2a3e',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.75rem',
                color: '#f87171',
                maxWidth: '600px',
                overflow: 'auto',
                textAlign: 'left',
              }}
            >
              {this.state.error.toString()}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.6rem 1.5rem',
                background: 'var(--clr-primary, #6c63ff)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              style={{
                padding: '0.6rem 1.5rem',
                background: 'transparent',
                color: 'var(--clr-text-secondary, #9ca3af)',
                border: '1px solid var(--clr-border, #2a2a3e)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Go home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
