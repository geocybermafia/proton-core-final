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
      req.url === '/api/index.js'
    ) {
      const matchedPath = 
        req.headers['x-matched-path'] || 
        req.headers['x-forwarded-url'] || 
        req.headers['x-original-url'] ||
        req.headers['x-vercel-matched-path'];

      if (
        typeof matchedPath === 'string' && 
        (matchedPath.startsWith('/api') || matchedPath.startsWith('/')) &&
        matchedPath !== '/api' &&
        matchedPath !== '/api/' &&
        matchedPath !== '/api/index' &&
        matchedPath !== '/api/index.js'
      ) {
        req.url = matchedPath;
      } else {
        // Safe default: if route was stripped by rewrite or hit root /api, serve health check
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
