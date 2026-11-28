import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";
import { 
  chatWithPersona, 
  generateNewPersona, 
  summarizeConversation, 
  analyzeWorkflow, 
  generatePersonaAvatar, 
  generateOrEditImage, 
  generateSpeech, 
  architectTask,
  translateText,
  generateTechSpec,
  breakdownTask,
  generateStrategicObjective,
  expandObjectiveAnalysis,
  detectClipIssues
} from "./lib/gemini-server.js";
import {
  AnalyticsConfigError,
  MarketAnalyticsService,
  isAdminCredentialsError,
  getAdminFirestoreInstance
} from "./lib/analyticsServer.js";
import {
  fetchListingPreviewData,
  loadBaseHtml,
  injectListingMetaToHtml
} from "./lib/marketListingMeta.js";
import { inferListingType, normalizeExplicitListingType } from "./lib/listingClassification.js";
import { MAX_LISTING_PHOTOS, resolveListingPrimaryAndGalleryImages } from "./lib/listingPhotos.js";
import { validateAndNormalizeListingPrice } from "./lib/listingPricing.js";
import { resolveCanonicalOrigin, resolveLegacyPublicRedirect } from "./lib/seo.js";

// Lazy dynamic initialization of Firebase Admin for server-side token authentication
const _adminAuthMap = new Map<string, any>();

let _googlePublicCerts: Record<string, string> | null = null;
let _googlePublicCertsExpiresAt = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_googlePublicCerts && now < _googlePublicCertsExpiresAt) {
    return _googlePublicCerts;
  }
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    const cc = res.headers.get('cache-control') || '';
    const match = cc.match(/max-age=(\d+)/);
    const maxAge = match ? parseInt(match[1], 10) : 3600;
    _googlePublicCertsExpiresAt = now + (maxAge * 1000);
    _googlePublicCerts = await res.json();
    return _googlePublicCerts || {};
  } catch (e) {
    console.warn('[StorageServer] Failed to fetch Google public certs:', e);
    return _googlePublicCerts || {};
  }
}

const PRIMARY_FIREBASE_PROJECT_ID = "proton-core-ai";
const KNOWN_FIRESTORE_DATABASE_ID = "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51";
const ALLOWED_SERVER_FIREBASE_PROJECT_IDS = new Set<string>([PRIMARY_FIREBASE_PROJECT_ID]);

export function getTrustedFirebaseProjectIds(): string[] {
  const configuredEnvProjectId =
    typeof process.env.FIREBASE_PROJECT_ID === "string"
      ? process.env.FIREBASE_PROJECT_ID.trim()
      : "";

  if (
    configuredEnvProjectId &&
    configuredEnvProjectId !== KNOWN_FIRESTORE_DATABASE_ID &&
    ALLOWED_SERVER_FIREBASE_PROJECT_IDS.has(configuredEnvProjectId)
  ) {
    return [configuredEnvProjectId];
  }

  return [PRIMARY_FIREBASE_PROJECT_ID];
}

export async function verifyFirebaseTokenDirectly(
  idToken: string,
  trustedProjects: string[] = getTrustedFirebaseProjectIds(),
  certProvider?: () => Promise<Record<string, string>>
): Promise<{ uid: string; email?: string; aud: string } | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  const allowedProjects = Array.from(
    new Set(
      (Array.isArray(trustedProjects) ? trustedProjects : [])
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => Boolean(p) && p !== KNOWN_FIRESTORE_DATABASE_ID)
    )
  );
  if (allowedProjects.length === 0) return null;

  try {
    const unpaddedHeader = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const headerB64 = unpaddedHeader + '='.repeat((4 - (unpaddedHeader.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));

    const unpaddedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadB64 = unpaddedPayload + '='.repeat((4 - (unpaddedPayload.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));

    if (!header || typeof header !== 'object' || Array.isArray(header)) return null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) return null;

    const certs = certProvider ? await certProvider() : await getGooglePublicCerts();
    const cert = certs?.[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const unpaddedSig = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const sigB64 = unpaddedSig + '='.repeat((4 - (unpaddedSig.length % 4)) % 4);
    const sig = Buffer.from(sigB64, 'base64');
    if (!verifier.verify(cert, sig)) return null;

    // Strictly enforce server-configured trusted Firebase Project IDs
    if (typeof payload.aud !== 'string' || !allowedProjects.includes(payload.aud)) return null;
    if (payload.aud === KNOWN_FIRESTORE_DATABASE_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${payload.aud}`) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > nowSec + 300) return null;
    if (
      payload.auth_time !== undefined &&
      (typeof payload.auth_time !== 'number' || !Number.isFinite(payload.auth_time) || payload.auth_time > nowSec + 300)
    ) {
      return null;
    }
    if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) return null;

    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      aud: payload.aud
    };
  } catch {
    return null;
  }
}

/**
 * Detects real image MIME type from binary magic bytes (JPEG, PNG, WebP).
 * Prevents MIME-spoofing attacks where non-image files are labelled as images.
 */
export function detectImageMimeType(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buffer || buffer.length < 12) return null;
  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return 'image/png';
  }
  // WebP magic bytes: RIFF (bytes 0-3: 52 49 46 46) and WEBP (bytes 8-11: 57 45 42 50)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

async function getVerifiedAdminAuth(targetProjectId?: string) {
  const trustedProjects = getTrustedFirebaseProjectIds();
  const projectId = targetProjectId || trustedProjects[0] || PRIMARY_FIREBASE_PROJECT_ID;
  if (!trustedProjects.includes(projectId) || projectId === KNOWN_FIRESTORE_DATABASE_ID) {
    throw new Error(`Untrusted Firebase project ID rejected: ${projectId}`);
  }

  const { initializeApp: initAdminApp, getApps: getAdminApps } = await import("firebase-admin/app");
  const { getAuth: getAdminAuth } = await import("firebase-admin/auth");

  if (!_adminAuthMap.has(projectId)) {
    const existing = getAdminApps().find((a: any) => a.name === projectId || (a.name === '[DEFAULT]' && a.options?.projectId === projectId));
    const adminApp = existing || initAdminApp({ projectId }, projectId);
    _adminAuthMap.set(projectId, getAdminAuth(adminApp));
  }
  return _adminAuthMap.get(projectId);
}

async function verifyBearerTokenFromRequest(
  req: express.Request,
  customVerifier?: (token: string) => Promise<{ uid: string } | null>,
  customCertProvider?: () => Promise<Record<string, string>>
): Promise<{ uid?: string; email?: string; aud?: string; error?: string; status?: number; code?: string; reason?: string }> {
  const authHeader = req.headers.authorization || (req.headers as any)['Authorization'];
  const bearerMatch = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  if (!bearerMatch) {
    return { error: "Unauthorized: Missing or invalid Authorization header", status: 401 };
  }
  const idToken = bearerMatch[1].trim().replace(/^["']|["']$/g, '');
  if (!idToken) {
    return { error: "Unauthorized: Empty authentication token", status: 401 };
  }

  if (customVerifier) {
    try {
      const customResult = await customVerifier(idToken);
      if (customResult?.uid) return { uid: customResult.uid };
      return { error: "Unauthorized: Invalid or expired Firebase authentication token", status: 401, code: "auth/invalid-id-token" };
    } catch (e: any) {
      return { error: e?.message || "Unauthorized", status: 401, code: e?.code || "auth/invalid-id-token" };
    }
  }

  const tokenParts = idToken.split(".");
  if (tokenParts.length !== 3) {
    return {
      error: "Unauthorized: Invalid or expired Firebase authentication token",
      status: 401,
      code: "auth/invalid-id-token",
      reason: "Malformed JWT structure. Expected 3 segments."
    };
  }

  // Strictly use server-configured trusted Firebase Project IDs (never trust unverified JWT aud)
  const trustedProjects = getTrustedFirebaseProjectIds();

  if (customCertProvider) {
    const directResult = await verifyFirebaseTokenDirectly(idToken, trustedProjects, customCertProvider);
    if (directResult?.uid) {
      return { uid: directResult.uid, email: directResult.email, aud: directResult.aud };
    }
    return {
      error: "Unauthorized: Invalid or expired Firebase authentication token",
      status: 401,
      code: "auth/invalid-id-token",
      reason: "Token verification rejected"
    };
  }

  // 1. Prefer Firebase Admin SDK verifyIdToken strictly against trusted server-configured projects
  let lastAuthError: any = null;
  for (const projId of trustedProjects) {
    try {
      const authInstance = await getVerifiedAdminAuth(projId);
      const decoded = await authInstance.verifyIdToken(idToken);
      if (
        decoded?.uid &&
        typeof decoded.aud === 'string' &&
        trustedProjects.includes(decoded.aud) &&
        decoded.aud === projId &&
        decoded.aud !== KNOWN_FIRESTORE_DATABASE_ID
      ) {
        return { uid: decoded.uid, email: decoded.email, aud: decoded.aud };
      }
    } catch (authErr: any) {
      lastAuthError = authErr;
    }
  }

  // 2. Cryptographic public-cert fallback strictly enforcing the same trusted server allowlist
  try {
    const directResult = await verifyFirebaseTokenDirectly(idToken, trustedProjects);
    if (directResult?.uid) {
      return { uid: directResult.uid, email: directResult.email, aud: directResult.aud };
    }
  } catch {
    // Reject below
  }

  return {
    error: "Unauthorized: Invalid or expired Firebase authentication token",
    status: 401,
    code: lastAuthError?.code || "auth/invalid-id-token",
    reason: lastAuthError?.message || "Token verification rejected"
  };
}

export interface CreateApiAppOptions {
  analyticsService?: MarketAnalyticsService;
  verifyIdToken?: (token: string) => Promise<{ uid: string; email?: string } | null>;
  getPublicCerts?: () => Promise<Record<string, string>>;
  getAdminFirestore?: () => Promise<any>;
}

export function createApiApp(options?: CreateApiAppOptions): express.Express {
  const app = express();
  const analyticsService = options?.analyticsService || new MarketAnalyticsService();

  // Set trust proxy to trust the proxy headers in front of Cloud Run and Vercel Edge
  app.set("trust proxy", 1);

  // 1. Industry-standard Security Headers via Helmet
  // Note: xFrameOptions and originAgentCluster are disabled to permit embedding in Google AI Studio iframes & mobile webviews
  app.use(helmet({
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    xFrameOptions: false,
    originAgentCluster: false,
  }));

  // 2. DDoS protection & API Key resource shield (Rate Limiting)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // limit each IP to 150 API calls per window
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (req, res) => {
      res.status(429).json({
        isQuotaError: true,
        messageEn: "Too many automated API requests from this IP. Please try again in 15 minutes.",
        messageKa: "Too many automated API requests from this IP. Please try again in 15 minutes."
      });
    }
  });

  // Accept up to 10 MB payload for base64 image uploads (max 5 MB binary file)
  app.use(express.json({ limit: '10mb' }));

  // 3. Server-side 301 Permanent Redirects for legacy public routes (/market -> /market-hub, /reels -> /clips)
  // Registered directly on `app` before `apiRouter` so `/api/market/*` endpoints are never intercepted.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const target = resolveLegacyPublicRedirect(req.originalUrl || req.url || req.path);
    if (target) {
      return res.redirect(301, target);
    }
    return next();
  });

  // Middleware to disable caching for all API routes & ensure dynamic rendering
  const cacheControlMiddleware: express.RequestHandler = (req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };

  // Create API router that defines the API endpoints
  const apiRouter = express.Router();
  apiRouter.use(cacheControlMiddleware);
  apiRouter.use("/gemini", apiLimiter);

  // Health route - reports status and runtime platform without exposing secret configuration indicators
  const healthHandler: express.RequestHandler = (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: {
        platform: process.env.VERCEL ? "vercel" : "server"
      }
    });
  };

  apiRouter.get("/health", healthHandler);

  // Secure Server-side Market Hub Listing Image Upload
  const uploadHandler: express.RequestHandler = async (req, res) => {
    // 1. Authenticate user via centralized PROTON Firebase ID Token verifier
    const authResult = await authenticateFirebaseUser(req);
    if ('error' in authResult) {
      return res.status(authResult.statusCode).json({
        error: authResult.error,
        reason: authResult.reason,
        code: authResult.code
      });
    }

    const verifiedUid = authResult.uid;
    if (!verifiedUid) {
      return res.status(401).json({ error: "Unauthorized: User UID not found in verified token" });
    }

    // 2. Validate payload and image format
    const { image, productId } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: "Bad Request: Image data is required" });
    }

    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Bad Request: Invalid image format. Must be a valid Base64 data URI." });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];

    const ALLOWED_MIME_TYPES: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return res.status(400).json({ 
        error: `Bad Request: Unsupported image format (${mimeType}). Allowed formats are JPEG, PNG, and WebP.` 
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // 5 MB max file size limit
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `Bad Request: Image exceeds 5 MB limit. Received size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.` 
      });
    }

    // Binary magic-bytes validation to prevent MIME-spoofing
    const detectedMimeType = detectImageMimeType(buffer);
    if (!detectedMimeType) {
      return res.status(400).json({ 
        error: "Bad Request: Invalid image content. Magic bytes do not match an allowed image type (JPEG, PNG, WebP).",
        code: "storage/invalid-magic-bytes"
      });
    }

    const ext = detectedMimeType === 'image/jpeg' ? 'jpg' : detectedMimeType === 'image/png' ? 'png' : 'webp';

    // 3. Supabase client with server-only service role key
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    // 4. Generate safe unique path strictly under verified user's folder
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 10);
    const cleanProdId = typeof productId === 'string'
      ? productId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32)
      : 'prod';
    const storagePath = `${verifiedUid}/${cleanProdId}_${timestamp}_${randomSuffix}.${ext}`;

    if (!serviceRoleKey) {
      console.error("[StorageServer] Upload aborted: SUPABASE_SERVICE_ROLE_KEY is not configured in server environment.");
      return res.status(503).json({ 
        error: "Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server.",
        code: "storage/configuration-missing"
      });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
      const { data, error: uploadErr } = await supabaseAdmin.storage
        .from('listings')
        .upload(storagePath, buffer, {
          contentType: detectedMimeType,
          upsert: true,
        });

      if (uploadErr) {
        console.error("[StorageServer] Supabase storage upload failed:", uploadErr.message);
        return res.status(502).json({ 
          error: `Storage service error: ${uploadErr.message}`,
          code: "storage/upload-failed"
        });
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from('listings')
        .getPublicUrl(storagePath);

      return res.status(200).json({
        success: true,
        publicUrl: publicUrlData.publicUrl,
        path: storagePath,
      });
    } catch (err: any) {
      console.error("[StorageServer] Unexpected error during upload:", err);
      return res.status(500).json({ error: "Internal server error during image storage" });
    }
  };

  // Proxy / file retrieval endpoint from Supabase Storage with directory traversal protection
  apiRouter.get("/storage/file/:uid/:filename", async (req, res) => {
    const { uid, filename } = req.params;
    const uidRegex = /^[a-zA-Z0-9_-]{1,128}$/;
    const filenameRegex = /^[a-zA-Z0-9_.-]{1,128}$/;

    if (!uid || !filename || !uidRegex.test(uid) || !filenameRegex.test(filename) || uid.includes('..') || filename.includes('..')) {
      return res.status(400).json({ error: "Bad Request: Invalid path parameters", code: "storage/invalid-path" });
    }

    const storagePath = `${uid}/${filename}`;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    try {
      if (serviceRoleKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await supabaseAdmin.storage.from('listings').download(storagePath);
        if (error || !data) {
          return res.status(404).json({ error: "Not Found: Image not found in storage", code: "storage/object-not-found" });
        }
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = detectImageMimeType(buffer) || (data.type || 'application/octet-stream');
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buffer);
      } else {
        // Direct public fetch from Supabase Storage
        const publicFetchUrl = `${supabaseUrl}/storage/v1/object/public/listings/${storagePath}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        let supRes: Response;
        try {
          supRes = await fetch(publicFetchUrl, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!supRes.ok) {
          let isNotFound = supRes.status === 404;
          try {
            const errJson = await supRes.json();
            if (
              errJson.statusCode === "404" ||
              errJson.statusCode === 404 ||
              errJson.error === "not_found" ||
              errJson.code === "NoSuchKey" ||
              (typeof errJson.message === 'string' && errJson.message.toLowerCase().includes("not found"))
            ) {
              isNotFound = true;
            }
          } catch {}

          return res.status(isNotFound ? 404 : 503).json({
            error: isNotFound ? "Not Found: Image not found in storage" : "Storage service unavailable",
            code: isNotFound ? "storage/object-not-found" : "storage/service-unavailable"
          });
        }

        const arrayBuffer = await supRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = detectImageMimeType(buffer) || (supRes.headers.get("content-type") || 'application/octet-stream');
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buffer);
      }
    } catch (err: any) {
      console.warn(`[StorageServer] File retrieval notice for ${storagePath}:`, err?.message);
      return res.status(404).json({ error: "Not Found: Image not found in storage", code: "storage/object-not-found" });
    }
  });

  // Secure server-side listing image deletion endpoint enforcing token authentication and strict user ownership
  const deleteHandler: express.RequestHandler = async (req, res) => {
    const authResult = await authenticateFirebaseUser(req);
    if ('error' in authResult) {
      return res.status(authResult.statusCode).json({
        error: authResult.error,
        reason: authResult.reason,
        code: authResult.code
      });
    }

    const verifiedUid = authResult.uid;
    const { path, url } = req.body || {};
    const target = path || url;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: "Bad Request: 'path' or 'url' is required" });
    }

    // Normalize target path
    let normalizedPath = target.trim();
    if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
      try {
        const parsed = new URL(normalizedPath);
        const match = parsed.pathname.match(/\/storage\/(?:v1\/object\/(?:public\/)?)?listings\/(.+)$/);
        if (match) {
          normalizedPath = decodeURIComponent(match[1]);
        } else {
          const fileMatch = parsed.pathname.match(/\/api\/storage\/file\/(.+)$/);
          if (fileMatch) {
            normalizedPath = decodeURIComponent(fileMatch[1]);
          }
        }
      } catch {
        return res.status(400).json({ error: "Bad Request: Malformed URL" });
      }
    }

    normalizedPath = normalizedPath.replace(/^\/+/, '');
    if (normalizedPath.startsWith("listings/")) {
      normalizedPath = normalizedPath.substring("listings/".length);
    }
    normalizedPath = normalizedPath.split('?')[0].split('#')[0];

    const segments = normalizedPath.split('/');
    if (segments.some(s => s === '..' || s === '.' || s === '')) {
      return res.status(400).json({ error: "Bad Request: Path traversal or invalid path segments" });
    }

    // Strict ownership isolation: users can ONLY delete images within their own verifiedUid folder
    if (!normalizedPath.startsWith(`${verifiedUid}/`)) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to delete images belonging to other users",
        code: "storage/ownership-mismatch"
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!serviceRoleKey) {
      return res.status(503).json({
        error: "Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server.",
        code: "storage/configuration-missing"
      });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error: delErr } = await supabaseAdmin.storage
        .from('listings')
        .remove([normalizedPath]);

      if (delErr) {
        console.warn(`[StorageServer] Supabase deletion notice for ${normalizedPath}:`, delErr.message);
        return res.status(502).json({
          error: `Storage service error: ${delErr.message}`,
          code: "storage/deletion-failed"
        });
      }

      return res.status(200).json({
        success: true,
        deletedPath: normalizedPath,
      });
    } catch (err: any) {
      console.error("[StorageServer] Unexpected error during deletion:", err);
      return res.status(500).json({ error: "Internal server error during image deletion" });
    }
  };

  apiRouter.post("/storage/upload-listing-image", uploadHandler);
  apiRouter.post("/storage/delete-listing-image", deleteHandler);
  apiRouter.delete("/storage/file/:uid/:filename", (req, res, next) => {
    req.body = { path: `${req.params.uid}/${req.params.filename}` };
    return deleteHandler(req, res, next);
  });

  // Reusable centralized Firebase Authentication helper for Storage endpoints
  const authenticateFirebaseUser = async (req: express.Request): Promise<{ uid: string; email?: string } | { error: string; statusCode: number; code?: string; reason?: string }> => {
    const authRes = await verifyBearerTokenFromRequest(
      req,
      options?.verifyIdToken,
      options?.getPublicCerts
    );
    if (!authRes.uid) {
      return {
        error: authRes.error || "Unauthorized: Invalid or expired Firebase authentication token",
        statusCode: authRes.status || 401,
        code: authRes.code,
        reason: authRes.reason,
      };
    }
    return { uid: authRes.uid, email: authRes.email };
  };

  // Secure Server-side Clips Video Signed Upload URL Generator
  const createClipUploadUrlHandler: express.RequestHandler = async (req, res) => {
    // 1. Authenticate user strictly via Firebase ID Token
    const authResult = await authenticateFirebaseUser(req);
    if ('error' in authResult) {
      return res.status(authResult.statusCode).json({
        error: authResult.error,
        reason: authResult.reason,
        code: authResult.code
      });
    }

    const verifiedUid = authResult.uid;
    if (!verifiedUid) {
      return res.status(401).json({ error: "Unauthorized: User UID not found in verified token" });
    }

    // 2. Validate requested file extension (mp4, mov, webm)
    const { fileExt, extension, mimeType, filename } = req.body || {};
    let ext = 'mp4';
    const candidateExt = (fileExt || extension || (filename ? String(filename).split('.').pop() : ''))?.toLowerCase().replace(/^\./, '').trim();

    if (candidateExt === 'mov' || candidateExt === 'quicktime') {
      ext = 'mov';
    } else if (candidateExt === 'webm') {
      ext = 'webm';
    } else if (candidateExt === 'mp4') {
      ext = 'mp4';
    } else if (typeof mimeType === 'string') {
      const mt = mimeType.toLowerCase();
      if (mt.includes('webm')) ext = 'webm';
      else if (mt.includes('quicktime') || mt.includes('mov')) ext = 'mov';
      else if (mt.includes('mp4')) ext = 'mp4';
      else {
        return res.status(400).json({
          error: "Bad Request: Unsupported video format. Allowed formats are mp4, mov, webm.",
          code: "storage/unsupported-video-format"
        });
      }
    } else if (candidateExt && !['mp4', 'mov', 'webm'].includes(candidateExt)) {
      return res.status(400).json({
        error: `Bad Request: Unsupported video extension (.${candidateExt}). Allowed formats are mp4, mov, webm.`,
        code: "storage/unsupported-video-format"
      });
    }

    // 3. Generate safe unique Storage path strictly on server under verified user's UID folder
    const timestamp = Date.now();
    const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    const storagePath = `${verifiedUid}/clip_${timestamp}_${uniqueSuffix}.${ext}`;

    // 4. Verify Supabase Service Role Key configuration
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!serviceRoleKey) {
      console.error("[StorageServer] Signed upload URL aborted: SUPABASE_SERVICE_ROLE_KEY is not configured in server environment.");
      return res.status(503).json({
        error: "Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server.",
        code: "storage/configuration-missing"
      });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // 5. Generate signed upload URL on 'clips' bucket using official Supabase Storage SDK
      const { data, error: signError } = await supabaseAdmin.storage
        .from('clips')
        .createSignedUploadUrl(storagePath);

      if (signError || !data?.signedUrl) {
        console.error("[StorageServer] Failed to create signed upload URL:", signError?.message);
        return res.status(502).json({
          error: "Storage service error: Failed to create signed upload URL",
          code: "storage/signed-url-failed"
        });
      }

      // 6. Generate public URL for playback
      const { data: publicData } = supabaseAdmin.storage
        .from('clips')
        .getPublicUrl(storagePath);

      return res.status(200).json({
        success: true,
        signedUrl: data.signedUrl,
        token: data.token,
        path: storagePath,
        publicUrl: publicData.publicUrl
      });
    } catch (err: any) {
      console.error("[StorageServer] Unexpected error generating signed upload URL:", err);
      return res.status(500).json({ error: "Internal server error during upload URL generation" });
    }
  };

  // Secure Server-side Clips Video Deletion Endpoint
  const deleteClipVideoHandler: express.RequestHandler = async (req, res) => {
    // 1. Authenticate user strictly via Firebase ID Token
    const authResult = await authenticateFirebaseUser(req);
    if ('error' in authResult) {
      return res.status(authResult.statusCode).json({
        error: authResult.error,
        reason: authResult.reason,
        code: authResult.code
      });
    }

    const verifiedUid = authResult.uid;
    if (!verifiedUid) {
      return res.status(401).json({ error: "Unauthorized: User UID not found in verified token" });
    }

    // 2. Validate target path or URL
    const { path, url } = req.body || {};
    const target = path || url;

    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: "Bad Request: 'path' or 'url' is required" });
    }

    // Normalize path (handle full URL or relative path)
    let normalizedPath = target.trim();
    if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
      try {
        const parsed = new URL(normalizedPath);
        const match = parsed.pathname.match(/\/storage\/(?:v1\/object\/(?:public\/)?)?clips\/(.+)$/);
        if (match) {
          normalizedPath = decodeURIComponent(match[1]);
        }
      } catch {
        return res.status(400).json({ error: "Bad Request: Malformed URL" });
      }
    }

    normalizedPath = normalizedPath.replace(/^\/+/, '');
    if (normalizedPath.startsWith("clips/")) {
      normalizedPath = normalizedPath.substring("clips/".length);
    }
    normalizedPath = normalizedPath.split('?')[0].split('#')[0];

    // 3. Strict path structure: exactly {folder}/{filename} (no subfolders, no traversal)
    const segments = normalizedPath.split('/');
    if (segments.length !== 2 || segments.some(s => s === '..' || s === '.' || !s.trim())) {
      return res.status(400).json({
        error: "Bad Request: Path traversal or invalid path format. Expected format: '{userId}/{filename}'",
        code: "storage/invalid-path"
      });
    }

    const [folderUid, filename] = segments;

    // 4. Strict user ownership check: folder must match verified UID
    if (folderUid !== verifiedUid) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to delete clips belonging to other users",
        code: "storage/ownership-mismatch"
      });
    }

    if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(filename)) {
      return res.status(400).json({
        error: "Bad Request: Invalid filename in path",
        code: "storage/invalid-filename"
      });
    }

    // 5. Verify Supabase Service Role Key configuration
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!serviceRoleKey) {
      return res.status(503).json({
        error: "Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server.",
        code: "storage/configuration-missing"
      });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // 6. Delete file strictly from 'clips' bucket
      const { data, error: delErr } = await supabaseAdmin.storage
        .from('clips')
        .remove([normalizedPath]);

      if (delErr) {
        console.warn(`[StorageServer] Supabase clip deletion notice for ${normalizedPath}:`, delErr.message);
        return res.status(502).json({
          error: "Storage service error: Failed to delete clip",
          code: "storage/deletion-failed"
        });
      }

      return res.status(200).json({
        success: true,
        deletedPath: normalizedPath
      });
    } catch (err: any) {
      console.error("[StorageServer] Unexpected error during clip deletion:", err);
      return res.status(500).json({ error: "Internal server error during clip deletion" });
    }
  };

  // Clips Video Storage Endpoints (Server-side signed URL & ownership-verified deletion)
  apiRouter.post("/storage/create-clip-upload-url", createClipUploadUrlHandler);
  apiRouter.post("/storage/delete-clip-video", deleteClipVideoHandler);

  // Gemini API Proxy
  const geminiHandler: express.RequestHandler = async (req, res) => {
    const { action, args } = req.body || {};
    const customApiKey = req.headers['x-custom-api-key'] as string | undefined;
    
    try {
      let result;
      switch (action) {
        case "chatWithPersona":
          result = await chatWithPersona(
            args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], customApiKey
          );
          break;
        case "generateNewPersona":
          result = await generateNewPersona(args[0], args[1], customApiKey);
          break;
        case "summarizeConversation":
          result = await summarizeConversation(args[0], customApiKey);
          break;
        case "analyzeWorkflow":
          result = await analyzeWorkflow(args[0], customApiKey);
          break;
        case "generatePersonaAvatar":
          result = await generatePersonaAvatar(args[0], customApiKey);
          break;
        case "generateOrEditImage":
          result = await generateOrEditImage(args[0], args[1], customApiKey);
          break;
        case "generateSpeech":
          result = await generateSpeech(args[0], args[1], customApiKey);
          break;
        case "architectTask":
          result = await architectTask(args[0], args[1], customApiKey);
          break;
        case "translateText":
          result = await translateText(args[0], args[1], args[2], args[3], customApiKey);
          break;
        case "generateTechSpec":
          result = await generateTechSpec(args[0], args[1], customApiKey);
          break;
        case "breakdownTask":
          result = await breakdownTask(args[0], args[1], customApiKey);
          break;
        case "generateStrategicObjective":
          result = await generateStrategicObjective(args[0], customApiKey);
          break;
        case "expandObjectiveAnalysis":
          result = await expandObjectiveAnalysis(args[0], args[1], args[2], customApiKey);
          break;
        case "detectClipIssues":
          result = await detectClipIssues(args[0], args[1], args[2], args[3], customApiKey);
          break;
        default:
          return res.status(400).send(`Unknown action: ${action}`);
      }
      res.json(result);
    } catch (error: any) {
      console.warn(`Gemini Request [action: ${action}] was handled via fallback/user configuration message:`, error);
      const errStr = error.message || String(error);
      
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("limit") || errStr.includes("RESOURCE_EXHAUSTED")) {
        const errorMsg = JSON.stringify({
          isQuotaError: true,
          messageEn: `Quota Exceeded (Error 429). The shared environment API key has reached its direct rate limit. Please navigate to the "System Settings" panel in the top-right ⚙️ and configure your own custom Gemini API Key to bypass this shared limit immediately. Thanks for your understanding!`,
          messageKa: `Quota Exceeded (Error 429). The shared environment API key has reached its direct rate limit. Please navigate to the "System Settings" panel in the top-right ⚙️ and configure your own custom Gemini API Key to bypass this shared limit immediately. Thanks for your understanding!`
        });
        res.status(429).send(errorMsg);
      } else if (errStr.includes("404") || errStr.toLowerCase().includes("not found")) {
        const errorMsg = JSON.stringify({
          isModelError: true,
          messageEn: `Model request failed. A legacy model may have been defined. Returning default setup fallback. Please configure a modern Gemini model.`,
          messageKa: `Model request failed. A legacy model may have been defined. Returning default setup fallback. Please configure a modern Gemini model.`
        });
        res.status(404).send(errorMsg);
      } else {
        res.status(500).send(errStr);
      }
    }
  };

  apiRouter.post("/gemini", geminiHandler);

  // Market Hub Analytics & Healthy Competition Rate Limiters
  const analyticsEventLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (_req, res) => {
      res.status(429).json({
        recorded: false,
        reason: "rate_limited",
        error: "Too many analytics events from this IP"
      });
    }
  });

  const analyticsReadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 90,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: "Too many analytics requests from this IP",
        code: "analytics/rate-limited"
      });
    }
  });

  // 1. Record Impression or View event (server-only writes, salted hash, bot & cooldown guards)
  apiRouter.post("/market/listing-event", analyticsEventLimiter, async (req, res) => {
    try {
      const hasAuthHeader = Boolean(req.headers.authorization || (req.headers as any)['Authorization']);
      let verifiedUid: string | null = null;
      if (hasAuthHeader) {
        const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken, options?.getPublicCerts);
        if (!authRes.uid) {
          return res.status(authRes.status || 401).json({
            error: authRes.error || "Unauthorized",
            code: authRes.code || "auth/invalid-id-token"
          });
        }
        verifiedUid = authRes.uid;
      }

      const { listingId, eventType, visitorToken } = req.body || {};
      const result = await analyticsService.recordListingEvent({
        listingId,
        eventType,
        visitorToken,
        verifiedUid,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
        clientIp: req.ip
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      if (isAdminCredentialsError(err)) {
        const isConfigErr = err instanceof AnalyticsConfigError;
        return res.status(503).json({
          recorded: false,
          code: isConfigErr ? err.code : "analytics/admin-credentials-missing",
          error: isConfigErr ? err.message : "Analytics persistence requires server Firebase Admin credentials for proton-core-ai."
        });
      }
      console.error("[MarketAnalytics] listing-event error:", err);
      return res.status(500).json({ error: "Failed to record listing analytics event" });
    }
  });

  // PHASE 2C: Record Seller Funnel Event (seller_profile_view, listing_to_seller, contact_click, contact_confirmed, order_intent, order_confirmed)
  apiRouter.post("/market/seller-funnel-event", analyticsEventLimiter, async (req, res) => {
    try {
      const hasAuthHeader = Boolean(req.headers.authorization || (req.headers as any)['Authorization']);
      let verifiedUid: string | null = null;
      if (hasAuthHeader) {
        const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken, options?.getPublicCerts);
        if (!authRes.uid) {
          return res.status(authRes.status || 401).json({
            error: authRes.error || "Unauthorized",
            code: authRes.code || "auth/invalid-id-token"
          });
        }
        verifiedUid = authRes.uid;
      }

      const { sellerId, eventType, visitorToken, sourceId, listingId } = req.body || {};
      if ((eventType === "contact_confirmed" || eventType === "order_confirmed") && !verifiedUid) {
        return res.status(401).json({
          recorded: false,
          error: "Unauthorized: Authentication required for confirmed funnel events",
          code: "analytics/auth-required"
        });
      }

      const result = await analyticsService.recordSellerFunnelEvent({
        sellerId,
        eventType,
        visitorToken,
        verifiedUid,
        sourceId,
        listingId,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
        clientIp: req.ip
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      if (isAdminCredentialsError(err)) {
        const isConfigErr = err instanceof AnalyticsConfigError;
        return res.status(503).json({
          recorded: false,
          code: isConfigErr ? err.code : "analytics/admin-credentials-missing",
          error: isConfigErr ? err.message : "Seller analytics requires server Firebase Admin credentials for proton-core-ai."
        });
      }
      console.error("[MarketAnalytics] seller-funnel-event error:", err);
      return res.status(500).json({ error: "Failed to record seller funnel event" });
    }
  });

  // 2. Owner-only Private Listing & Seller Statistics (24h, 7d, 30d, all + period comparisons)
  apiRouter.get("/market/listing-stats", analyticsReadLimiter, async (req, res) => {
    try {
      const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken, options?.getPublicCerts);
      if (!authRes.uid) {
        return res.status(authRes.status || 401).json({
          error: authRes.error || "Unauthorized",
          code: authRes.code || "auth/invalid-id-token"
        });
      }

      const listingId = typeof req.query.listingId === 'string' && req.query.listingId.trim()
        ? req.query.listingId.trim()
        : undefined;

      const result = await analyticsService.getSellerStats({
        verifiedUid: authRes.uid,
        listingId
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      if (isAdminCredentialsError(err)) {
        const isConfigErr = err instanceof AnalyticsConfigError;
        return res.status(503).json({
          code: isConfigErr ? err.code : "analytics/admin-credentials-missing",
          error: isConfigErr ? err.message : "Analytics storage requires server Firebase Admin credentials for proton-core-ai."
        });
      }
      console.error("[MarketAnalytics] listing-stats error:", err);
      return res.status(500).json({ error: "Failed to fetch listing statistics" });
    }
  });

  // 3. Public Aggregated Healthy Competition Rankings (no PII, no raw viewerHash/UID/IP)
  apiRouter.get("/market/rankings", analyticsReadLimiter, async (req, res) => {
    try {
      const result = await analyticsService.getRankings({
        scope: typeof req.query.scope === 'string' ? req.query.scope : 'global',
        period: typeof req.query.period === 'string' ? req.query.period : '7d',
        listingType: typeof req.query.listingType === 'string' ? req.query.listingType : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        country: typeof req.query.country === 'string' ? req.query.country : undefined,
        region: typeof req.query.region === 'string' ? req.query.region : undefined
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      if (isAdminCredentialsError(err)) {
        const isConfigErr = err instanceof AnalyticsConfigError;
        return res.status(503).json({
          rankings: [],
          availableCountries: [],
          availableRegions: [],
          code: isConfigErr ? err.code : "analytics/admin-credentials-missing",
          error: isConfigErr ? err.message : "Public rankings storage requires server Firebase Admin credentials for proton-core-ai."
        });
      }
      console.error("[MarketAnalytics] rankings error:", err);
      return res.status(500).json({ error: "Failed to load market rankings" });
    }
  });

  // 4. Seller Opt-Out Control for Public Competition Rankings
  apiRouter.post("/market/competition-preference", analyticsReadLimiter, async (req, res) => {
    try {
      const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken, options?.getPublicCerts);
      if (!authRes.uid) {
        return res.status(authRes.status || 401).json({
          error: authRes.error || "Unauthorized",
          code: authRes.code || "auth/invalid-id-token"
        });
      }
      const { optedOut } = req.body || {};
      if (typeof optedOut !== 'boolean') {
        return res.status(400).json({ error: "Bad Request: 'optedOut' boolean is required" });
      }
      const result = await analyticsService.updateCompetitionOptOut({
        verifiedUid: authRes.uid,
        optedOut
      });
      return res.status(result.status).json(result.body);
    } catch (err: any) {
      if (isAdminCredentialsError(err)) {
        const isConfigErr = err instanceof AnalyticsConfigError;
        return res.status(503).json({
          code: isConfigErr ? err.code : "analytics/admin-credentials-missing",
          error: isConfigErr ? err.message : "Updating competition preferences requires server Firebase Admin credentials for proton-core-ai."
        });
      }
      console.error("[MarketAnalytics] competition-preference error:", err);
      return res.status(500).json({ error: "Failed to update competition preference" });
    }
  });

  // 5. Secure Server-Side Listing Creation with Controlled Freshness Eligibility
  const SUPPORTED_LISTING_CURRENCIES = new Set(['USD', 'EUR', 'GEL', 'GBP', 'JPY', 'CNY']);
  const VALID_LISTING_CONDITIONS = new Set(['new', 'used', 'refurbished']);
  const VALID_LISTING_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

  const validateServerListingImageUrl = (
    rawUrl: string,
    ownerUid: string
  ): { ok: boolean; status?: number; error?: string; code?: string } => {
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.length > 2048) {
      return { ok: false, status: 400, error: "Bad Request: Invalid image URL length", code: "listings/invalid-image-url" };
    }

    const lower = trimmed.toLowerCase();
    if (lower.startsWith('data:') || lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
      return {
        ok: false,
        status: 400,
        error: "Bad Request: Raw data URIs and unsafe image protocols are not permitted",
        code: "listings/unsafe-image-url"
      };
    }

    let rawPath = '';
    let isInternalStorageTarget = false;

    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        return { ok: false, status: 400, error: "Bad Request: Malformed image URL", code: "listings/invalid-image-url" };
      }

      const host = parsed.hostname.toLowerCase();
      const supMatch = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)?\/?([^/]+)\/(.+)$/);
      if (supMatch) {
        isInternalStorageTarget = true;
        const bucket = decodeURIComponent(supMatch[1]).toLowerCase();
        const objectPath = decodeURIComponent(supMatch[2]);
        rawPath = `${bucket}/${objectPath}`;
      } else if (parsed.pathname.startsWith('/api/storage/file/') || parsed.pathname.startsWith('/storage/file/')) {
        isInternalStorageTarget = true;
        const clean = decodeURIComponent(parsed.pathname.replace(/^\/?(?:api\/)?storage\/file\//, ''));
        rawPath = `listings/${clean}`;
      } else if (host === 'firebasestorage.googleapis.com') {
        const fbMatch = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (!fbMatch) {
          return { ok: false, status: 400, error: "Bad Request: Invalid Firebase Storage image URL", code: "listings/invalid-image-url" };
        }
        isInternalStorageTarget = true;
        rawPath = decodeURIComponent(fbMatch[2]);
      } else if (host === 'storage.googleapis.com') {
        const gcsMatch = parsed.pathname.match(/^\/([^/]+)\/(.+)$/);
        if (!gcsMatch) {
          return { ok: false, status: 400, error: "Bad Request: Invalid GCS image URL", code: "listings/invalid-image-url" };
        }
        isInternalStorageTarget = true;
        rawPath = decodeURIComponent(gcsMatch[2]);
      } else {
        // External HTTPS/HTTP CDN image URL
        return { ok: true };
      }
    } else if (
      trimmed.startsWith('/api/storage/file/') ||
      trimmed.startsWith('api/storage/file/') ||
      trimmed.startsWith('/storage/file/') ||
      trimmed.startsWith('storage/file/')
    ) {
      isInternalStorageTarget = true;
      let clean = trimmed.replace(/^\/?(?:api\/)?storage\/file\//, '');
      try {
        clean = decodeURIComponent(clean);
      } catch {
        return { ok: false, status: 400, error: "Bad Request: Malformed percent-encoding in image path", code: "listings/invalid-image-path" };
      }
      rawPath = `listings/${clean}`;
    } else {
      return { ok: false, status: 400, error: "Bad Request: Image URL must use HTTP(S) or verified storage path", code: "listings/invalid-image-url" };
    }

    if (isInternalStorageTarget) {
      const cleanedPath = rawPath.split('?')[0].split('#')[0].replace(/^\/+/, '');
      const segments = cleanedPath.split('/');
      if (segments.some((s) => s === '..' || s === '.' || s === '')) {
        return { ok: false, status: 400, error: "Bad Request: Invalid storage path in image URL", code: "listings/invalid-image-path" };
      }

      const requiredPrefix = `listings/${ownerUid}/`;
      if (!cleanedPath.startsWith(requiredPrefix)) {
        if (cleanedPath.startsWith('listings/')) {
          return {
            ok: false,
            status: 403,
            error: "Forbidden: Using listing images belonging to another user is not permitted",
            code: "listings/image-ownership-mismatch"
          };
        }
        return {
          ok: false,
          status: 400,
          error: "Bad Request: Image path must point to listings storage",
          code: "listings/invalid-image-path"
        };
      }
    }

    return { ok: true };
  };

  apiRouter.post("/market/listings", analyticsReadLimiter, async (req, res) => {
    try {
      const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken, options?.getPublicCerts);
      if (!authRes.uid) {
        return res.status(authRes.status || 401).json({
          error: authRes.error || "Unauthorized",
          code: authRes.code || "auth/invalid-id-token"
        });
      }

      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: "Bad Request: JSON object body is required", code: "listings/invalid-body" });
      }

      // Enforce strict seller identity — reject spoofing attempts if caller sends a mismatched sellerId
      if (body.sellerId !== undefined && body.sellerId !== null && body.sellerId !== '') {
        if (typeof body.sellerId !== 'string' || body.sellerId.trim() !== authRes.uid) {
          return res.status(403).json({
            error: "Forbidden: Cannot create a listing on behalf of another seller",
            code: "listings/seller-mismatch"
          });
        }
      }

      // Validate optional custom listing ID
      let listingId = `list-${crypto.randomUUID()}`;
      if (body.id !== undefined && body.id !== null && body.id !== '') {
        if (typeof body.id !== 'string' || !VALID_LISTING_ID_REGEX.test(body.id.trim())) {
          return res.status(400).json({
            error: "Bad Request: Invalid listing id format",
            code: "listings/invalid-id"
          });
        }
        listingId = body.id.trim();
      }

      // Validate multilingual titles & primaryLanguage
      for (const field of ['title', 'titleGe', 'titleEn', 'description', 'descriptionGe', 'sellerName', 'category', 'location', 'country', 'city', 'serviceDuration', 'serviceTerms', 'currency', 'condition', 'listingType', 'primaryLanguage'] as const) {
        if (body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') {
          return res.status(400).json({
            error: `Bad Request: '${field}' must be a string`,
            code: "listings/invalid-field-type"
          });
        }
      }

      const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
      const rawTitleGe = typeof body.titleGe === 'string' ? body.titleGe.trim() : '';
      const rawTitleEn = typeof body.titleEn === 'string' ? body.titleEn.trim() : '';

      if (!rawTitle && !rawTitleGe && !rawTitleEn) {
        return res.status(400).json({
          error: "Bad Request: A valid listing title (title, titleGe, or titleEn) is required",
          code: "listings/missing-title"
        });
      }
      if (rawTitle.length > 200 || rawTitleGe.length > 200 || rawTitleEn.length > 200) {
        return res.status(400).json({
          error: "Bad Request: Title fields must not exceed 200 characters",
          code: "listings/title-too-long"
        });
      }

      let primaryLanguage: 'ka' | 'en';
      if (typeof body.primaryLanguage === 'string' && body.primaryLanguage.trim()) {
        const normalizedLang = body.primaryLanguage.trim().toLowerCase();
        if (normalizedLang !== 'ka' && normalizedLang !== 'en') {
          return res.status(400).json({
            error: "Bad Request: primaryLanguage must be 'ka' or 'en'",
            code: "listings/invalid-primary-language"
          });
        }
        primaryLanguage = normalizedLang;
      } else {
        const hasGeorgianChars = (val: string) => /[\u10A0-\u10FF]/.test(val);
        if (rawTitleGe && !rawTitleEn && (!rawTitle || hasGeorgianChars(rawTitle))) {
          primaryLanguage = 'ka';
        } else if (hasGeorgianChars(rawTitle)) {
          primaryLanguage = 'ka';
        } else {
          primaryLanguage = 'en';
        }
      }

      const titleGe = rawTitleGe || (primaryLanguage === 'ka' && !rawTitleEn ? rawTitle : '');
      const titleEn = rawTitleEn;
      const title =
        rawTitle ||
        (primaryLanguage === 'ka' ? (titleGe || titleEn) : (titleEn || titleGe));

      if (!title || title.length > 200) {
        return res.status(400).json({
          error: "Bad Request: Valid title (1-200 characters) is required",
          code: "listings/invalid-title"
        });
      }

      // Validate descriptions
      const rawDesc = typeof body.description === 'string' ? body.description.trim() : '';
      const rawDescGe = typeof body.descriptionGe === 'string' ? body.descriptionGe.trim() : '';
      if (rawDesc.length > 5000 || rawDescGe.length > 5000) {
        return res.status(400).json({
          error: "Bad Request: Description fields must not exceed 5000 characters",
          code: "listings/description-too-long"
        });
      }
      const description = rawDesc || rawDescGe;
      const descriptionGe = rawDescGe || (primaryLanguage === 'ka' && rawDesc ? rawDesc : '');

      // Validate currency, isNegotiable, category & listingType before price rules
      const rawCurrency = typeof body.currency === 'string' && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : 'USD';
      if (!SUPPORTED_LISTING_CURRENCIES.has(rawCurrency)) {
        return res.status(400).json({
          error: `Bad Request: Unsupported currency '${rawCurrency}'`,
          code: "listings/invalid-currency"
        });
      }

      if (body.isNegotiable !== undefined && body.isNegotiable !== null && typeof body.isNegotiable !== 'boolean') {
        return res.status(400).json({
          error: "Bad Request: 'isNegotiable' must be a boolean",
          code: "listings/invalid-negotiable"
        });
      }
      const isNegotiable = Boolean(body.isNegotiable);

      if (
        body.priceUnspecified !== undefined &&
        body.priceUnspecified !== null &&
        typeof body.priceUnspecified !== 'boolean'
      ) {
        return res.status(400).json({
          error: "Bad Request: 'priceUnspecified' must be a boolean",
          code: "listings/invalid-price-unspecified"
        });
      }

      // Validate category & listingType
      const category = body.category === undefined || body.category === null
        ? 'other'
        : String(body.category).trim();
      if (!category || category.length > 50) {
        return res.status(400).json({
          error: "Bad Request: Valid category (1-50 characters) is required",
          code: "listings/invalid-category"
        });
      }

      if (typeof body.listingType === 'string' && body.listingType.trim()) {
        const explicitType = normalizeExplicitListingType(body.listingType);
        if (!explicitType) {
          return res.status(400).json({
            error: "Bad Request: listingType must be 'product', 'service', or 'project'",
            code: "listings/invalid-listing-type"
          });
        }
      }
      const listingType = inferListingType(category, body.listingType);

      // Validate and normalize price (allows 0/empty ONLY for project-jobs, collaboration, or isNegotiable=true)
      const priceValidation = validateAndNormalizeListingPrice({
        rawPrice: body.price,
        category,
        isNegotiable,
      });
      if (!priceValidation.valid) {
        const errMsg =
          priceValidation.reason === 'negative'
            ? "Bad Request: Price cannot be negative"
            : priceValidation.reason === 'invalid_format'
            ? "Bad Request: Valid numeric price is required"
            : "Bad Request: Price must be greater than 0 unless Negotiable or in Jobs / Collaboration";
        return res.status(400).json({
          error: errMsg,
          code: "listings/invalid-price"
        });
      }
      const price = priceValidation.price;
      const priceUnspecified =
        price > 0
          ? false
          : typeof body.priceUnspecified === 'boolean'
          ? body.priceUnspecified
          : priceValidation.priceUnspecified;

      // Validate condition
      let condition = '';
      if (typeof body.condition === 'string' && body.condition.trim()) {
        const normalizedCond = body.condition.trim().toLowerCase();
        if (!VALID_LISTING_CONDITIONS.has(normalizedCond)) {
          return res.status(400).json({
            error: "Bad Request: condition must be 'new', 'used', or 'refurbished'",
            code: "listings/invalid-condition"
          });
        }
        condition = normalizedCond;
      }

      // Validate remote mode & location (never fabricate Zürich / Switzerland)
      if (body.isRemote !== undefined && body.isRemote !== null && typeof body.isRemote !== 'boolean') {
        return res.status(400).json({
          error: "Bad Request: 'isRemote' must be a boolean",
          code: "listings/invalid-remote"
        });
      }
      const isRemote = Boolean(body.isRemote);

      const rawCountry = typeof body.country === 'string' ? body.country.trim() : '';
      const rawCity = typeof body.city === 'string' ? body.city.trim() : '';
      const rawLocation = typeof body.location === 'string' ? body.location.trim() : '';

      if (rawCountry.length > 50 || rawCity.length > 50 || rawLocation.length > 200) {
        return res.status(400).json({
          error: "Bad Request: Location fields exceed maximum allowed length",
          code: "listings/location-too-long"
        });
      }

      let country = rawCountry;
      let city = rawCity;
      let location = rawLocation;

      if (isRemote) {
        const hasRealCity = Boolean(rawCity && rawCity.toLowerCase() !== 'online');
        if (!hasRealCity) {
          country = rawCountry && rawCountry.toUpperCase() !== 'GLOBAL' ? rawCountry : 'GLOBAL';
          city = 'Online';
          location = rawLocation || 'Online / Remote';
        } else {
          country = rawCountry || 'GLOBAL';
          city = rawCity;
          location = rawLocation || `${rawCity}, ${country}`;
        }
      } else {
        country = rawCountry;
        city = rawCity;
        if (rawLocation) {
          location = rawLocation;
        } else if (rawCity && rawCountry) {
          location = `${rawCity}, ${rawCountry}`;
        } else {
          location = rawCity || rawCountry || '';
        }
      }

      // Validate coordinates (lat / lng)
      const parseOptionalCoord = (val: unknown, name: string): { present: boolean; value: number | null; valid: boolean } => {
        if (val === undefined || val === null || val === '') {
          return { present: false, value: null, valid: true };
        }
        if (typeof val === 'boolean' || typeof val === 'object') {
          return { present: true, value: null, valid: false };
        }
        const num = Number(val);
        if (!Number.isFinite(num)) {
          return { present: true, value: null, valid: false };
        }
        if (name === 'lat' && (num < -90 || num > 90)) {
          return { present: true, value: null, valid: false };
        }
        if (name === 'lng' && (num < -180 || num > 180)) {
          return { present: true, value: null, valid: false };
        }
        return { present: true, value: num, valid: true };
      };

      const latCheck = parseOptionalCoord(body.lat, 'lat');
      const lngCheck = parseOptionalCoord(body.lng, 'lng');
      if (!latCheck.valid || !lngCheck.valid) {
        return res.status(400).json({
          error: "Bad Request: Invalid coordinates (lat must be -90..90, lng must be -180..180)",
          code: "listings/invalid-coordinates"
        });
      }
      if (latCheck.present !== lngCheck.present) {
        return res.status(400).json({
          error: "Bad Request: Both 'lat' and 'lng' must be provided together",
          code: "listings/incomplete-coordinates"
        });
      }
      const lat = latCheck.present ? latCheck.value : null;
      const lng = lngCheck.present ? lngCheck.value : null;

      // Validate & sanitize category attributes
      const sanitizedAttributes: Record<string, string | number | boolean> = {};
      if (body.attributes !== undefined && body.attributes !== null) {
        if (typeof body.attributes !== 'object' || Array.isArray(body.attributes)) {
          return res.status(400).json({
            error: "Bad Request: 'attributes' must be a plain object",
            code: "listings/invalid-attributes"
          });
        }
        const entries = Object.entries(body.attributes);
        if (entries.length > 50) {
          return res.status(400).json({
            error: "Bad Request: Too many attributes (max 50)",
            code: "listings/too-many-attributes"
          });
        }
        for (const [rawKey, rawVal] of entries) {
          const key = rawKey.trim();
          if (
            !key ||
            key.length > 80 ||
            key === '__proto__' ||
            key === 'constructor' ||
            key === 'prototype' ||
            key.startsWith('$')
          ) {
            return res.status(400).json({
              error: `Bad Request: Invalid attribute key '${rawKey}'`,
              code: "listings/invalid-attribute-key"
            });
          }
          if (rawVal === undefined || rawVal === null) continue;
          if (typeof rawVal === 'boolean') {
            sanitizedAttributes[key] = rawVal;
          } else if (typeof rawVal === 'number') {
            if (!Number.isFinite(rawVal)) {
              return res.status(400).json({
                error: `Bad Request: Attribute '${key}' must be a finite number`,
                code: "listings/invalid-attribute-value"
              });
            }
            sanitizedAttributes[key] = rawVal;
          } else if (typeof rawVal === 'string') {
            const trimmedVal = rawVal.trim();
            if (!trimmedVal) continue;
            if (trimmedVal.length > 500) {
              return res.status(400).json({
                error: `Bad Request: Attribute '${key}' exceeds max length of 500 characters`,
                code: "listings/attribute-too-long"
              });
            }
            if (/^(javascript|data|vbscript):/i.test(trimmedVal)) {
              return res.status(400).json({
                error: `Bad Request: Attribute '${key}' contains an unsafe URI scheme`,
                code: "listings/unsafe-attribute-value"
              });
            }
            sanitizedAttributes[key] = trimmedVal;
          } else {
            return res.status(400).json({
              error: `Bad Request: Attribute '${key}' must be a string, number, or boolean`,
              code: "listings/invalid-attribute-value"
            });
          }
        }
      }

      // Validate serviceDuration & serviceTerms
      const serviceDuration = typeof body.serviceDuration === 'string' ? body.serviceDuration.trim() : '';
      const serviceTerms = typeof body.serviceTerms === 'string' ? body.serviceTerms.trim() : '';
      if (serviceDuration.length > 160 || serviceTerms.length > 2000) {
        return res.status(400).json({
          error: "Bad Request: Service duration or terms exceed maximum length",
          code: "listings/service-fields-too-long"
        });
      }

      // Validate images & primary image
      if (body.images !== undefined && body.images !== null && !Array.isArray(body.images)) {
        return res.status(400).json({
          error: "Bad Request: 'images' must be an array of URLs",
          code: "listings/invalid-images"
        });
      }
      const rawImageList: string[] = [];
      if (typeof body.image === 'string' && body.image.trim()) {
        rawImageList.push(body.image.trim());
      }
      if (Array.isArray(body.images)) {
        if (body.images.length > MAX_LISTING_PHOTOS * 2) {
          return res.status(400).json({
            error: `Bad Request: Too many images (maximum ${MAX_LISTING_PHOTOS})`,
            code: "listings/too-many-images"
          });
        }
        for (const item of body.images) {
          if (typeof item !== 'string') {
            return res.status(400).json({
              error: "Bad Request: All items in 'images' must be strings",
              code: "listings/invalid-images"
            });
          }
          if (item.trim()) rawImageList.push(item.trim());
        }
      }

      const { image: primaryImage, images: normalizedImages } = resolveListingPrimaryAndGalleryImages(
        rawImageList,
        MAX_LISTING_PHOTOS
      );
      for (const imgUrl of normalizedImages) {
        const imgCheck = validateServerListingImageUrl(imgUrl, authRes.uid);
        if (!imgCheck.ok) {
          return res.status(imgCheck.status || 400).json({
            error: imgCheck.error || "Bad Request: Invalid listing image URL",
            code: imgCheck.code || "listings/invalid-image-url"
          });
        }
      }

      // Validate optional tags array
      let sanitizedTags: string[] | undefined;
      if (body.tags !== undefined && body.tags !== null) {
        if (!Array.isArray(body.tags) || body.tags.some((t: unknown) => typeof t !== 'string')) {
          return res.status(400).json({
            error: "Bad Request: 'tags' must be an array of strings",
            code: "listings/invalid-tags"
          });
        }
        const stringTags = (body.tags as string[])
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => t.slice(0, 40));
        sanitizedTags = Array.from(new Set(stringTags)).slice(0, 20);
      }

      const sellerNameRaw = typeof body.sellerName === 'string' ? body.sellerName.trim() : '';
      const sellerName = (
        sellerNameRaw ||
        ((authRes as any).email ? String((authRes as any).email).split('@')[0] : '') ||
        'Proton Merchant'
      ).slice(0, 120);

      // Compute Freshness Registry key (Unicode-safe for Georgian + Latin titles)
      const normalizedTitle = title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
      const registryKey = crypto
        .createHash('sha256')
        .update(`${authRes.uid}_${category.toLowerCase()}_${normalizedTitle || title.toLowerCase()}`)
        .digest('hex');

      const dbAdmin = await (options?.getAdminFirestore ? options.getAdminFirestore() : getAdminFirestoreInstance());
      const registryRef = dbAdmin.collection('seller_freshness_registry').doc(registryKey);
      const listingRef = dbAdmin.collection('listings').doc(listingId);

      const txResult = await dbAdmin.runTransaction(async (transaction: any) => {
        const existingListingSnap = await transaction.get(listingRef);
        if (existingListingSnap && existingListingSnap.exists) {
          return { conflict: true as const };
        }

        const regDoc = await transaction.get(registryRef);
        const nowMs = Date.now();
        let firstPublishedAt = nowMs;

        if (regDoc.exists) {
          const regData = regDoc.data();
          if (typeof regData?.firstPublishedAt === 'number' && Number.isFinite(regData.firstPublishedAt)) {
            firstPublishedAt = regData.firstPublishedAt;
          }
        } else {
          transaction.set(registryRef, {
            sellerId: authRes.uid,
            category: category.toLowerCase(),
            normalizedTitleHash: registryKey,
            firstPublishedAt: nowMs,
            originalListingId: listingId,
            createdAt: nowMs,
          });
        }

        const listingData: Record<string, any> = {
          id: listingId,
          title,
          titleGe,
          titleEn,
          primaryLanguage,
          description,
          descriptionGe,
          price,
          priceUnspecified,
          currency: rawCurrency,
          sellerId: authRes.uid, // Authoritative!
          sellerName,
          image: primaryImage,
          images: normalizedImages,
          category,
          location,
          country,
          city,
          lat,
          lng,
          condition,
          isNegotiable,
          listingType,
          isRemote,
          attributes: sanitizedAttributes,
          serviceDuration,
          serviceTerms,
          status: 'active',
          isSold: false,
          createdAt: firstPublishedAt,
          updatedAt: nowMs,
        };

        if (sanitizedTags !== undefined) {
          listingData.tags = sanitizedTags;
        }

        transaction.set(listingRef, listingData);
        return { conflict: false as const, listingData };
      });

      if (txResult.conflict) {
        return res.status(409).json({
          error: "Conflict: A listing with this ID already exists",
          code: "listings/already-exists"
        });
      }

      return res.status(201).json(txResult.listingData);
    } catch (err: any) {
      if (isAdminCredentialsError(err)) {
        const isConfigErr = err instanceof AnalyticsConfigError;
        return res.status(503).json({
          code: isConfigErr ? err.code : "analytics/admin-credentials-missing",
          error: isConfigErr ? err.message : "Listing creation requires server Firebase Admin credentials."
        });
      }
      console.error("[MarketListings] create error:", err);
      return res.status(500).json({ error: "Failed to create listing securely" });
    }
  });

  // 6. Dynamic Market Listing HTML Preview for Social Media Crawlers & Deep-Linking
  const handleMarketPreview = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const listingId = (
      (typeof req.query.listingId === 'string' && req.query.listingId.trim()) ||
      (typeof req.query.id === 'string' && req.query.id.trim()) ||
      (typeof req.params?.listingId === 'string' && req.params.listingId.trim()) ||
      ''
    );

    // If no listingId is specified on a general route, let normal SPA routing continue
    const isDirectPreviewEndpoint = req.path === '/market-preview' || req.path === '/api/market-preview';
    if (!listingId && !isDirectPreviewEndpoint) {
      return next();
    }

    try {
      const listing = listingId ? await fetchListingPreviewData(listingId) : null;
      const baseHtml = loadBaseHtml();

      const host = req.get('x-forwarded-host') || req.get('host') || '';
      const runtimeOrigin = host ? `https://${host}` : undefined;
      const canonicalOrigin = resolveCanonicalOrigin({
        configuredOrigin: process.env.PUBLIC_SITE_URL,
        runtimeOrigin,
      });
      const canonicalUrl = listingId
        ? `${canonicalOrigin}/market-hub?listingId=${encodeURIComponent(listingId)}`
        : `${canonicalOrigin}/market-hub`;

      const html = injectListingMetaToHtml({
        baseHtml,
        listing,
        canonicalUrl
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).send(html);
    } catch (err) {
      console.error('[MarketPreview] Error serving dynamic listing preview:', err);
      try {
        const baseHtml = loadBaseHtml();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(baseHtml);
      } catch {
        return next();
      }
    }
  };

  apiRouter.get('/market-preview', handleMarketPreview);
  apiRouter.get('/market-hub', handleMarketPreview);
  apiRouter.get('/market-hub/:listingId', handleMarketPreview);

  // Mount apiRouter both with and without "/api" prefix for seamless routing
  // whether called as /api/xxx or rewritten directly to /xxx
  app.use("/api", apiRouter);
  app.use(apiRouter);

  // Explicit JSON 404 catch-all for /api routes to prevent falling through to SPA index.html
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `API endpoint not found: ${req.method} /api${req.path}`,
      path: `/api${req.path}`
    });
  });

  // Global Express error handler preventing unhandled process crashes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[ServerError]:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: "Server Error",
        message: err?.message || "An unexpected error occurred"
      });
    }
  });

  return app;
}

const app = createApiApp();
export default app;
