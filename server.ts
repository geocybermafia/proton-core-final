import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
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
  generateTechSpec
} from "./src/lib/gemini-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Middleware to disable caching for all API routes & ensure dynamic rendering
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // Health check or other dynamic API routes can go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gemini API Proxy
  app.post("/api/gemini", async (req, res) => {
    const { action, args } = req.body;
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
        default:
          return res.status(400).send(`Unknown action: ${action}`);
      }
      res.json(result);
    } catch (error: any) {
      console.error(`Error in /api/gemini [action: ${action}]:`, error);
      const errStr = error.message || String(error);
      
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("limit") || errStr.includes("RESOURCE_EXHAUSTED")) {
        const errorMsg = JSON.stringify({
          isQuotaError: true,
          messageEn: `Quota Exceeded (Error 429). The shared environment API key has reached its direct rate limit. Please navigate to the "System Settings" panel in the top-right ⚙️ and configure your own custom Gemini API Key to bypass this shared limit immediately. Thanks for your understanding!`,
          messageKa: `კვოტა ამოიწურა (შეცდომა 429). გაზიარებულმა გარემოს API გასაღებმა მიაღწია ლიმიტს. გთხოვთ, გახსნათ "პარამეტრები" პანელი ზედა მარჯვენა კუთხეში ⚙️ და შეიყვანოთ თქვენი საკუთარი Gemini API გასაღები მუშაობის შეუფერხებლად გასაგრძელებლად! მადლობა გაგებისთვის!`
        });
        res.status(429).send(errorMsg);
      } else if (errStr.includes("404") || errStr.toLowerCase().includes("not found")) {
        const errorMsg = JSON.stringify({
          isModelError: true,
          messageEn: `Model request failed. A legacy model may have been defined. Returning default setup fallback. Please configure a modern Gemini model.`,
          messageKa: `მოდელის მოთხოვნა ვერ მოხერხდა. შესაძლოა ძველი მოდელი იყო განსაზღვრული. გთხოვთ გამოიყენოთ თანამედროვე Gemini მოდელი.`
        });
        res.status(404).send(errorMsg);
      } else {
        res.status(500).send(errStr);
      }
    }
  });

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

    // Handle SPA routing - no cache for index.html to ensure users get latest version
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Secure check of keys at server startup to prevent accidental exposures
    const gk = process.env.GEMINI_API_KEY;
    const vgk = process.env.VITE_GEMINI_API_KEY;
    
    console.log("[CONFIG SECURE CHECK] Security environment state on startup:");
    console.log("  - GEMINI_API_KEY:", gk ? `Present (starts with ${gk.substring(0, 6)}..., Length: ${gk.length})` : "Missing");
    console.log("  - VITE_GEMINI_API_KEY:", vgk ? `Present (starts with ${vgk.substring(0, 6)}..., Length: ${vgk.length})` : "Missing");
    if (gk && vgk && gk !== vgk) {
      console.warn("  - Warning: Both keys are present but different! VITE_GEMINI_API_KEY takes precedence.");
    }
  });
}

startServer();
