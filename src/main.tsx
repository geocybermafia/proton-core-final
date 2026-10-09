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

import { createConfig, WagmiProvider, http } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();
const config = createConfig({
  chains: [mainnet, polygon, optimism, arbitrum, base],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});

import { isChunkLoadError, clearAllChunkRetryFlags } from './lib/lazyWithRetry';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    const errMsg = error?.message || String(error);
    if (
      errMsg.includes("reading 'emit'") ||
      errMsg.includes("reading 'addListener'") ||
      errMsg.includes("reading 'runtime'") ||
      errMsg.includes("Extension context invalidated")
    ) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
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
                A new version of the Proton platform has been deployed. Please reload the application to fetch the latest assets and continue seamlessly.
              </p>
              <button 
                onClick={this.handleReload} 
                style={{ width: '100%', padding: '12px 24px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px 0 rgba(2, 132, 199, 0.39)' }}
              >
                Reload & Update Application
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{ padding: '20px', backgroundColor: '#010409', color: '#ff4444', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <h1 style={{ fontSize: '18px', borderBottom: '1px solid #ff4444', paddingBottom: '10px', marginBottom: '10px' }}>Application Error</h1>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', opacity: 0.8 }}>{this.state.error?.toString()}</pre>
            <p style={{ marginTop: '20px', fontSize: '10px', color: '#888' }}>Check browser console for more details.</p>
            <button onClick={this.handleReload} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Reload App</button>
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
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
