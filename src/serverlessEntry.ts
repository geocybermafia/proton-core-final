import app from "./serverApp.js";

const ROOT_REWRITE_PATHS = new Set([
  '/api',
  '/api/',
  '/',
  '',
  '/api/index',
  '/api/index.js',
]);

function stripRewriteParams(searchParams: URLSearchParams): URLSearchParams {
  const cleaned = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== '1' && key !== 'path') {
      cleaned.append(key, value);
    }
  });
  return cleaned;
}

export default function handler(req: any, res: any) {
  try {
    const rawUrl = typeof req.url === 'string' ? req.url : '/';
    let parsedIncoming: URL;
    try {
      parsedIncoming = new URL(rawUrl, 'http://localhost');
    } catch {
      parsedIncoming = new URL('/', 'http://localhost');
    }

    const originalParams = stripRewriteParams(parsedIncoming.searchParams);

    const prePopulatedQuery = req.query;
    if (prePopulatedQuery && typeof prePopulatedQuery === 'object') {
      for (const [k, v] of Object.entries(prePopulatedQuery)) {
        if (k === '1' || k === 'path' || originalParams.has(k)) continue;
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item !== undefined && item !== null) {
              originalParams.append(k, String(item));
            }
          }
        } else if (v !== undefined && v !== null) {
          originalParams.append(k, String(v));
        }
      }
    }

    // If Vercel rewrites /api/(.*) to /api or /api/index, restore the original URL path and query string
    if (ROOT_REWRITE_PATHS.has(parsedIncoming.pathname)) {
      let resolvedPath: string | null = null;
      let headerParams: URLSearchParams | null = null;

      // 1. Check known Vercel/proxy headers
      const headerCandidate =
        req.headers['x-forwarded-uri'] ||
        req.headers['x-invoke-path'] ||
        req.headers['x-matched-path'] ||
        req.headers['x-forwarded-url'] ||
        req.headers['x-original-url'] ||
        req.headers['x-vercel-matched-path'];

      if (typeof headerCandidate === 'string' && headerCandidate.trim()) {
        try {
          const parsedHeader = new URL(headerCandidate.trim(), 'http://localhost');
          const candidatePath = parsedHeader.pathname;
          if (
            (candidatePath.startsWith('/api/') || candidatePath.startsWith('/')) &&
            !ROOT_REWRITE_PATHS.has(candidatePath)
          ) {
            resolvedPath = candidatePath.startsWith('/api') ? candidatePath : `/api${candidatePath}`;
            headerParams = stripRewriteParams(parsedHeader.searchParams);
          }
        } catch {
          // ignore malformed proxy header
        }
      }

      // 2. Check x-now-route-matches header (format: "1=storage%2Fupload-listing-image")
      if (!resolvedPath && typeof req.headers['x-now-route-matches'] === 'string') {
        const match = req.headers['x-now-route-matches'].match(/(?:^|&)1=([^&]+)/);
        if (match && match[1]) {
          const subPath = decodeURIComponent(match[1]);
          const cleanSub = subPath.split('?')[0].replace(/^\/+/, '');
          if (cleanSub) {
            resolvedPath = `/api/${cleanSub}`;
          }
        }
      }

      // 3. Check URL query parameters (e.g. rewrite ?1=$1 or ?path=...)
      if (!resolvedPath) {
        const pathParam =
          parsedIncoming.searchParams.get('path') ||
          parsedIncoming.searchParams.get('1') ||
          (typeof prePopulatedQuery?.path === 'string' ? prePopulatedQuery.path : undefined) ||
          (typeof prePopulatedQuery?.['1'] === 'string' ? prePopulatedQuery['1'] : undefined);
        if (pathParam) {
          const cleanSub = pathParam.split('?')[0].replace(/^\/+/, '');
          if (cleanSub) {
            resolvedPath = `/api/${cleanSub}`;
          }
        }
      }

      const finalParams = new URLSearchParams(originalParams);
      if (headerParams) {
        headerParams.forEach((value, key) => {
          if (!finalParams.has(key)) {
            finalParams.append(key, value);
          }
        });
      }
      const qs = finalParams.toString();

      if (resolvedPath) {
        req.url = qs ? `${resolvedPath}?${qs}` : resolvedPath;
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        req.url = qs ? `/api/health?${qs}` : '/api/health';
      }
    } else if (parsedIncoming.searchParams.has('1') || parsedIncoming.searchParams.has('path')) {
      const qs = originalParams.toString();
      req.url = qs ? `${parsedIncoming.pathname}?${qs}` : parsedIncoming.pathname;
    }

    // Force Express to parse req.query cleanly from the restored req.url
    if ('_parsedUrl' in req) {
      try {
        delete req._parsedUrl;
      } catch {}
    }
    if ('query' in req) {
      try {
        delete req.query;
      } catch {
        if (req.query && typeof req.query === 'object') {
          try { delete req.query['1']; } catch {}
          try { delete req.query['path']; } catch {}
        }
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
