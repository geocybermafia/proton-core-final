import app from "./serverApp.js";

export default function handler(req: any, res: any) {
  try {
    // If Vercel rewrites /api/(.*) to /api or /api/index, restore the original URL path
    if (
      req.url === '/api' || 
      req.url === '/api/' || 
      req.url === '/' || 
      req.url === '' ||
      req.url === '/api/index' ||
      req.url === '/api/index.js' ||
      req.url?.startsWith('/api?') ||
      req.url?.startsWith('/api/?')
    ) {
      let resolvedPath: string | null = null;

      // 1. Check known Vercel/proxy headers
      const headerCandidate = 
        req.headers['x-forwarded-uri'] ||
        req.headers['x-invoke-path'] ||
        req.headers['x-matched-path'] || 
        req.headers['x-forwarded-url'] || 
        req.headers['x-original-url'] ||
        req.headers['x-vercel-matched-path'];

      if (
        typeof headerCandidate === 'string' && 
        (headerCandidate.startsWith('/api/') || headerCandidate.startsWith('/')) &&
        headerCandidate !== '/api' &&
        headerCandidate !== '/api/' &&
        headerCandidate !== '/api/index' &&
        headerCandidate !== '/api/index.js'
      ) {
        resolvedPath = headerCandidate.startsWith('/api') ? headerCandidate : `/api${headerCandidate}`;
      }

      // 2. Check x-now-route-matches header (format: "1=storage%2Fupload-listing-image")
      if (!resolvedPath && typeof req.headers['x-now-route-matches'] === 'string') {
        const match = req.headers['x-now-route-matches'].match(/(?:^|&)1=([^&]+)/);
        if (match && match[1]) {
          const subPath = decodeURIComponent(match[1]);
          resolvedPath = `/api/${subPath.replace(/^\/+/, '')}`;
        }
      }

      // 3. Check URL query parameters (e.g. rewrite ?1=$1 or ?path=...)
      if (!resolvedPath && typeof req.url === 'string' && req.url.includes('?')) {
        try {
          const urlObj = new URL(req.url, 'http://localhost');
          const pathParam = urlObj.searchParams.get('path') || urlObj.searchParams.get('1');
          if (pathParam) {
            resolvedPath = `/api/${pathParam.replace(/^\/+/, '')}`;
          }
        } catch {}
      }

      if (resolvedPath) {
        req.url = resolvedPath;
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        req.url = '/api/health';
      }
    }
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Invocation Caught Error]:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error in Serverless Handler",
        message: err?.message || String(err)
      });
    }
  }
}

export { app, handler };
