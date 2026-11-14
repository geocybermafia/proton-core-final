import React from 'react'
import ReactDOM from 'react-dom/client'

// Suppress Lit development mode warnings
(globalThis as any).litDisableBundleAnalyzer = true;
(globalThis as any).litDevMode = false;

import App from './App'
import './index.css'
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { LanguageProvider } from './contexts/LanguageContext';
import { SellerProvider } from './contexts/SellerContext';
import { MarketHubProvider } from './contexts/MarketHubContext';
import { BrowserRouter } from 'react-router-dom';

import { isChunkLoadError, clearAllChunkRetryFlags } from './lib/lazyWithRetry';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Proton caught an uncaught render error:", error, errorInfo);
  }

  handleReload = () => {
    clearAllChunkRetryFlags();
    window.location.reload();
  };

  handleResetAndReload = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('proton_last_route');
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
    clearAllChunkRetryFlags();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);

      if (isChunk) {
        return (
          <div style={{ padding: '24px', backgroundColor: '#07090e', color: '#f0f6fc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            <div style={{ maxWidth: '480px', width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>
                ↻
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', color: '#f8fafc', fontFamily: 'monospace' }}>
                Proton Update Detected
              </h1>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
                აპლიკაციის ახალი ვერსია ხელმისაწვდომია. გთხოვთ გადატვირთოთ გვერდი განახლებული რესურსების ჩასატვირთად.
              </p>
              <button 
                onClick={this.handleReload} 
                style={{ width: '100%', padding: '12px 24px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px 0 rgba(2, 132, 199, 0.39)' }}
              >
                აპლიკაციის განახლება / Reload
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{ padding: '24px', backgroundColor: '#0b0f17', color: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: '#111827', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                !
              </div>
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f9fafb' }}>აპლიკაციის ჩატვირთვის შეფერხება</h1>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>Application load interruption</p>
              </div>
            </div>
            
            <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.6', marginBottom: '20px' }}>
              დაფიქსირდა მოულოდნელი შეფერხება. შეგიძლიათ გადატვირთოთ გვერდი ან გაასუფთავოთ დროებითი ქეში.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={this.handleReload} 
                style={{ width: '100%', padding: '12px', backgroundColor: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                ხელახლა ჩატვირთვა / Reload App
              </button>
              <button 
                onClick={this.handleResetAndReload} 
                style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', fontSize: '12px', cursor: 'pointer' }}
              >
                ქეშის გასუფთავება და ჩატვირთვა / Reset Session Cache
              </button>
            </div>

            {this.state.error && (
              <details style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
                <summary style={{ fontSize: '11px', color: '#6b7280', cursor: 'pointer', fontFamily: 'monospace' }}>დეტალური ინფორმაცია / Error Details</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#ef4444', background: '#0b0f17', padding: '10px', borderRadius: '8px', marginTop: '8px', overflowX: 'auto', maxHeight: '140px' }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <LanguageProvider>
            <SellerProvider>
              <MarketHubProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </MarketHubProvider>
            </SellerProvider>
          </LanguageProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
