import app from "./src/serverApp.js";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production settings with Edge Caching orientation
    const distPath = path.join(process.cwd(), "dist");
    
    // Cache static assets (JS, CSS, Images) for 1 year
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false
    }));

    // Handle SPA routing - ensure missing assets or files with extensions return 404, never index.html
    app.get("*", (req, res) => {
      if (req.path.startsWith("/assets/") || path.extname(req.path)) {
        return res.status(404).send("Asset not found");
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Non-sensitive key presence check at server startup
    const gk = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
    const ssk = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
    
    console.log("[CONFIG SECURE CHECK] Security environment state on startup:");
    console.log("  - GEMINI_API_KEY:", gk ? "Configured" : "Missing");
    console.log("  - SUPABASE_SERVICE_ROLE_KEY:", ssk ? "Configured" : "Missing (required for secure listing image uploads)");
  });
}

// Only start listening server when running as a dedicated Node server, not on Vercel Serverless
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  startServer();
}

export default app;
