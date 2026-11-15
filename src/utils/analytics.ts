declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export const initGA = () => {
  try {
    if (typeof window === 'undefined') return;
    // Silent fallback if inside an iframe (AI Studio preview / sandbox)
    if (window.self !== window.top) {
      return;
    }
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!measurementId || typeof measurementId !== 'string' || !measurementId.startsWith('G-')) {
      return;
    }

    if (document.getElementById('ga-gtag-script')) return;

    const script = document.createElement('script');
    script.id = 'ga-gtag-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function(...args: any[]) {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId);
  } catch (err) {
    console.warn('[Analytics] Initialization failed safely:', err);
  }
};

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    if (typeof window === 'undefined') return;
    if (window.self !== window.top) return; // silent fallback in iframe
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params || {});
    }
  } catch (err) {
    console.warn('[Analytics] Track event failed safely:', err);
  }
};
