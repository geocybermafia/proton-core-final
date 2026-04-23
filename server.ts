import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Modality, Type } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/gemini/chat", async (req, res) => {
    const { persona, message, history, model, includeMaps, includeSearch, temperature, globalInstruction } = req.body;
    try {
      console.log(`[Server] Chatting with persona: ${persona.id}`);
      const tools: any[] = [];
      if (includeSearch) {
        tools.push({ googleSearch: {} });
      } else if (includeMaps) {
        tools.push({ googleMaps: {} });
      }

      const response = await ai.models.generateContent({
        model,
        contents: [
          ...history,
          { role: 'user', parts: [{ text: message }] }
        ],
        config: {
          temperature,
          topP: 0.95,
          systemInstruction: `${persona.systemInstruction}
${persona.language !== 'English' ? "\n\nCRITICAL LANGUAGE INSTRUCTION: Prioritize using the Georgian language (Mkhedruli script) in your responses. Always include Georgian when 'Georgian' or 'Mixed' is selected, and use Georgian script for terms, names, or cultural nuances." : ""}
${globalInstruction ? `\n\n${globalInstruction}` : ''}`,
          tools: tools.length > 0 ? tools : undefined
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[Server] Gemini Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/summarize", async (req, res) => {
    const { history } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: 'user', parts: [{ text: "Summarize this conversation in a concise way, highlighting key points and actionable items." }] }
        ],
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[Server] Gemini Summarize Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/analyze-workflow", async (req, res) => {
    const { workflow } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{
          role: 'user',
          parts: [{
            text: `Analyze the following workflow and suggest improvements for efficiency and scalability:
            Name: ${workflow.name}
            Trigger: ${workflow.trigger}
            Action: ${workflow.action}`
          }]
        }],
        config: {
          // thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[Server] Gemini Analysis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/generate-avatar", async (req, res) => {
    const { persona } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{
          role: 'user',
          parts: [{
            text: `Generate a high-quality, professional digital avatar for an AI persona named '${persona.name}'. 
            Role: ${persona.role}. 
            Description: ${persona.description}. 
            Style: Neo-Brutalist, technical, clean, centered, circular composition, vibrant accents on a dark background. 
            The avatar should be iconic and represent the persona's expertise.
            OUTPUT ONLY THE IMAGE CONTENT.`
          }]
        }],
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData) {
        res.json({ data: `data:image/png;base64,${part.inlineData.data}` });
      } else {
        throw new Error("No image data returned from Gemini API");
      }
    } catch (error: any) {
      console.error("[Server] Avatar Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/generate-image", async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    try {
      const parts: any[] = [{ text: prompt + "\n\nOUTPUT ONLY THE IMAGE CONTENT." }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
          },
        });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ role: 'user', parts }],
        config: {
          imageConfig: { aspectRatio: "1:1" }
        }
      });
      
      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.find(p => p.inlineData);
      if (part?.inlineData) {
        res.json({ data: `data:image/png;base64,${part.inlineData.data}` });
      } else {
        throw new Error("No image data returned from Gemini API");
      }
    } catch (error: any) {
      console.error("[Server] Image Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/tts", async (req, res) => {
    const { text, voiceName } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
            },
          },
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio data returned from Gemini API");
      }
      res.json({ data: base64Audio });
    } catch (error: any) {
      console.error("[Server] TTS Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/architect", async (req, res) => {
    const { project } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [{
            text: `Be professional, brief, and structured. Architect an action plan for: ${project}.
            Respond EXCLUSIVELY in the user's language (e.g. Georgian for Georgian, English for English).`
          }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              materials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    cost: { type: Type.STRING }
                  },
                  required: ["item", "cost"]
                }
              },
              complexity: { type: Type.STRING, description: "Beginner, Intermediate, Advanced, or Master" },
              estimatedTime: { type: Type.STRING },
              firstSteps: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "The first 3 steps to take immediately."
              }
            },
            required: ["materials", "complexity", "estimatedTime", "firstSteps"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("[Server] Architect Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
