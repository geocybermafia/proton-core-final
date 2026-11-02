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

// Lazy dynamic initialization of Firebase Admin for server-side token authentication
const _adminAuthMap = new Map<string, any>();

async function getVerifiedAdminAuth(targetProjectId?: string) {
  const { initializeApp: initAdminApp, getApps: getAdminApps } = await import("firebase-admin/app");
  const { getAuth: getAdminAuth } = await import("firebase-admin/auth");
  
  const projectId = targetProjectId || "proton-core-ai";
  if (!_adminAuthMap.has(projectId)) {
    const existing = getAdminApps().find((a: any) => a.name === projectId || (a.name === '[DEFAULT]' && a.options?.projectId === projectId));
    const adminApp = existing || initAdminApp({ projectId }, projectId);
    _adminAuthMap.set(projectId, getAdminAuth(adminApp));
  }
  return _adminAuthMap.get(projectId);
}

export function createApiApp(): express.Express {
  const app = express();

  // Set trust proxy to trust the proxy headers in front of Cloud Run and Vercel Edge
  app.set("trust proxy", 1);

  // 1. Industry-standard Security Headers via Helmet
  app.use(helmet({
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
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

  // Health route - reports status and non-sensitive key presence without leaking any secrets
  const healthHandler: express.RequestHandler = (req, res) => {
    const hasSupabaseServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: {
        supabaseServiceRoleKey: hasSupabaseServiceKey ? "configured" : "missing",
        geminiApiKey: hasGeminiKey ? "configured" : "missing",
        platform: process.env.VERCEL ? "vercel" : "server"
      }
    });
  };

  apiRouter.get("/health", healthHandler);

  // Secure Server-side Market Hub Listing Image Upload
  const uploadHandler: express.RequestHandler = async (req, res) => {
    // 1. Authenticate user via Firebase ID Token
    const authHeader = req.headers.authorization || (req.headers as any)['Authorization'];
    const bearerMatch = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    if (!bearerMatch) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
    }
    const idToken = bearerMatch[1].trim().replace(/^["']|["']$/g, '');
    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Empty authentication token" });
    }

    // Basic structure check: Firebase ID token is a standard JWT with 3 dot-separated base64url segments
    const tokenParts = idToken.split(".");
    if (tokenParts.length !== 3) {
      console.warn("[StorageServer] Token rejected: malformed JWT structure (expected 3 dot-separated segments)");
      return res.status(401).json({ 
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        reason: "Malformed JWT structure. Expected 3 segments."
      });
    }

    // Inspect token audience claim to dynamically match the issuing Firebase Project
    let tokenAudience: string | undefined;
    try {
      const unpadded = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padLength = (4 - (unpadded.length % 4)) % 4;
      const base64 = unpadded + '='.repeat(padLength);
      const payloadJson = Buffer.from(base64, 'base64').toString('utf8');
      const parsedPayload = JSON.parse(payloadJson);
      tokenAudience = parsedPayload.aud || (typeof parsedPayload.iss === 'string' ? parsedPayload.iss.replace('https://securetoken.google.com/', '') : undefined);
    } catch (e) {
      console.warn("[StorageServer] Could not parse token payload:", e);
    }

    // Build list of candidate project IDs to verify against, prioritizing the token's own audience
    const candidateProjects: string[] = [];
    if (tokenAudience && typeof tokenAudience === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(tokenAudience)) {
      candidateProjects.push(tokenAudience);
    }
    const standardProjects = [
      "proton-core-ai",
      "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51",
      process.env.VITE_FIREBASE_PROJECT_ID,
      process.env.FIREBASE_PROJECT_ID,
      process.env.GCLOUD_PROJECT,
    ].filter(Boolean) as string[];

    for (const proj of standardProjects) {
      if (!candidateProjects.includes(proj)) {
        candidateProjects.push(proj);
      }
    }
    if (candidateProjects.length === 0) {
      candidateProjects.push("proton-core-ai");
    }

    let decodedToken: any = null;
    let lastAuthError: any = null;

    for (const projId of candidateProjects) {
      try {
        const authInstance = await getVerifiedAdminAuth(projId);
        decodedToken = await authInstance.verifyIdToken(idToken);
        if (decodedToken && decodedToken.uid) {
          break;
        }
      } catch (authErr: any) {
        lastAuthError = authErr;
      }
    }

    if (!decodedToken || !decodedToken.uid) {
      const errDetail = lastAuthError?.message || "Token verification rejected";
      console.warn("[StorageServer] Token verification rejected (401):", errDetail, "Candidates tried:", candidateProjects);
      return res.status(401).json({ 
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        reason: errDetail,
        code: lastAuthError?.code || "auth/invalid-id-token"
      });
    }

    const verifiedUid = decodedToken.uid;
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

    const ext = ALLOWED_MIME_TYPES[mimeType];
    const buffer = Buffer.from(base64Data, 'base64');

    // 5 MB max file size limit
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `Bad Request: Image exceeds 5 MB limit. Received size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.` 
      });
    }

    // 3. Supabase client with server-only service role key
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ntndwrpruyrttlpjptzf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!serviceRoleKey) {
      console.error("[StorageServer] Upload aborted: SUPABASE_SERVICE_ROLE_KEY is not configured in server environment.");
      return res.status(503).json({ 
        error: "Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server." 
      });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 4. Generate safe unique path strictly under verified user's folder
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 10);
    const cleanProdId = typeof productId === 'string'
      ? productId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32)
      : 'prod';
    const storagePath = `${verifiedUid}/${cleanProdId}_${timestamp}_${randomSuffix}.${ext}`;

    try {
      const { data, error: uploadErr } = await supabaseAdmin.storage
        .from('listings')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) {
        console.error("[StorageServer] Supabase storage upload failed:", uploadErr.message);
        return res.status(502).json({ 
          error: `Storage service error: ${uploadErr.message}` 
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

  apiRouter.post("/storage/upload-listing-image", uploadHandler);

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
