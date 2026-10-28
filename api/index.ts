import app from "../src/serverApp.js";

export default function handler(req: any, res: any) {
  // If Vercel rewrites /api/(.*) to /api, restore the original URL path from Vercel's headers
  if (req.url === '/api' || req.url === '/api/' || req.url === '/' || req.url === '') {
    const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || req.headers['x-original-url'];
    if (typeof matchedPath === 'string' && (matchedPath.startsWith('/api') || matchedPath.startsWith('/'))) {
      req.url = matchedPath;
    }
  }
  return app(req, res);
}
