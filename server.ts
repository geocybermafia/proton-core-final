import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// AI Proxy Routes
app.post("/api/ai/chat", async (req, res) => {
  const { persona, message, history, model, includeSearch, includeMaps, temperature, globalInstruction } = req.body;
  
  try {
    const tools: any[] = [];
    if (includeSearch) {
      tools.push({ googleSearch: {} });
    } else if (includeMaps) {
      tools.push({ googleMaps: {} });
    }

    const response = await ai.models.generateContent({
      model: model || "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `${persona.systemInstruction}
${persona.language !== 'English' ? "\n\nCRITICAL LANGUAGE INSTRUCTION: Prioritize using the Georgian language (Mkhedruli script) in your responses. Always include Georgian when 'Georgian' or 'Mixed' is selected, and use Georgian script for terms, names, or cultural nuances." : ""}
${globalInstruction ? `\n\n${globalInstruction}` : ''}`,
        temperature: temperature || 0.8,
        topP: 0.95,
        tools: tools.length > 0 ? tools : undefined
      }
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    res.status(500).json({ error: "Proton Core AI connection failed.", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/api/ai/summarize", async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ error: "Summary generation failed." });
  }
});

app.post("/api/ai/analyze-workflow", async (req, res) => {
  const { workflow } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Analyze the following workflow and suggest improvements for efficiency and scalability:
      Name: ${workflow.name}
      Trigger: ${workflow.trigger}
      Action: ${workflow.action}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    res.json({ text: response.text });
  } catch (error) {
    res.status(500).json({ error: "Workflow analysis failed." });
  }
});

app.post("/api/ai/generate-avatar", async (req, res) => {
  const { persona } = req.body;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a high-quality, professional digital avatar for an AI persona named '${persona.name}'. 
            Role: ${persona.role}. 
            Description: ${persona.description}. 
            Style: Neo-Brutalist, technical, clean, centered, circular composition, vibrant accents on a dark background. 
            The avatar should be iconic and represent the persona's expertise.
            OUTPUT ONLY THE IMAGE CONTENT.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    if (response && response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return res.json({ image: `data:image/png;base64,${part.inlineData.data}` });
        }
      }
    }
    throw new Error("No image data returned from Gemini API");
  } catch (error) {
    res.status(500).json({ error: "Avatar generation failed." });
  }
});

app.post("/api/ai/generate-image", async (req, res) => {
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
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    if (response && response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return res.json({ image: `data:image/png;base64,${part.inlineData.data}` });
        }
      }
    }
    throw new Error("No image data returned from Gemini API");
  } catch (error) {
    res.status(500).json({ error: "Image generation failed." });
  }
});

app.post("/api/ai/generate-speech", async (req, res) => {
  const { text, voiceName } = req.body;
  let supportedVoice = voiceName || 'Kore';
  if (voiceName === 'TbilisiDialect' || voiceName === 'GeorgianModern') {
    supportedVoice = 'Kore';
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: supportedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }
    res.json({ audio: base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, "") });
  } catch (error) {
    res.status(500).json({ error: "Speech generation failed." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Proton Core AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
