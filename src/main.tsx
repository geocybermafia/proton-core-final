import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { 
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme as rainbowDarkTheme
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();
const config = getDefaultConfig({
  appName: 'Secure Hub 7',
  projectId: 'a5c0b933d69b32c63c1a3b1373510e1a', // Recommended: use your own project ID from https://cloud.walletconnect.com
  chains: [mainnet, polygon, optimism, arbitrum, base],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});

function Root() {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    // Small delay to ensure browser is ready and to avoid hydration flicker
    const timer = setTimeout(() => {
      setMounted(true);
      console.log("App mounted successfully");
    }, 10);
    
    return () => clearTimeout(timer);
  }, []);

  // Show a base layer while mounting to prevent "Black Screen" if something is slow
  if (!mounted) {
    return (
      <div id="loading-overlay" style={{ 
        backgroundColor: '#010409', 
        height: '100vh', 
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00f2ff',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '2px solid #00f2ff', 
            borderTopColor: 'transparent', 
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Initializing Proton-Core
          </div>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowDarkTheme({
          accentColor: '#00f2ff',
          borderRadius: 'large',
        })}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
