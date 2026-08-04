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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#010409', color: '#ff4444', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <h1 style={{ fontSize: '18px', borderBottom: '1px solid #ff4444', paddingBottom: '10px', marginBottom: '10px' }}>Application Error</h1>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', opacity: 0.8 }}>{this.state.error?.toString()}</pre>
            <p style={{ marginTop: '20px', fontSize: '10px', color: '#888' }}>Check browser console for more details.</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Reload App</button>
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
