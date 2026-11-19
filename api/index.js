// src/serverApp.ts
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import crypto2 from "crypto";

// src/lib/gemini-server.ts
import { GoogleGenAI, Type, Modality } from "@google/genai";
var aiInstances = /* @__PURE__ */ new Map();
function getAi(apiKeyOverride) {
  const rawKey = apiKeyOverride || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!rawKey) {
    console.warn("Secure Config Alert: Server-side VITE_GEMINI_API_KEY and GEMINI_API_KEY environment variables are missing.");
    return null;
  }
  const apiKey = rawKey.trim();
  if (!aiInstances.has(apiKey)) {
    const instance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    aiInstances.set(apiKey, instance);
  }
  return aiInstances.get(apiKey);
}
async function chatWithPersona(persona, message, history = [], model = "gemini-3.5-flash", includeMaps = false, includeSearch = true, temperature = 0.9, globalInstruction, appLanguage = "en", apiKeyOverride) {
  const startTime = performance.now();
  try {
    const tools = [];
    if (includeSearch) {
      tools.push({ googleSearch: {} });
    } else if (includeMaps) {
      tools.push({ googleMaps: {} });
    }
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized (GEMINI_API_KEY is missing on server)");
    const response = await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `${persona.systemInstruction}
${persona.language !== "English" ? "\n\nCRITICAL LANGUAGE INSTRUCTION: Prioritize using the Georgian language (Mkhedruli script) in your responses. Always include Georgian when 'Georgian' or 'Mixed' is selected, and use Georgian script for terms, names, or cultural nuances." : ""}
${globalInstruction ? `

${globalInstruction}` : ""}`,
        temperature,
        topP: 0.95,
        tools: tools.length > 0 ? tools : void 0
      }
    });
    const endTime = performance.now();
    const metadata = {
      promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokenCount: response.usageMetadata?.totalTokenCount || 0,
      latency: Math.round(endTime - startTime)
    };
    return {
      text: response.text || "I'm sorry, I couldn't process that request.",
      metadata
    };
  } catch (error) {
    const endTime = performance.now();
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] chatWithPersona rate-limited or error: ${errStr.substring(0, 120)}`);
    let text = "";
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("limit") || errStr.toLowerCase().includes("resource_exhausted")) {
      text = appLanguage === "ka" ? "\u10D3\u10E6\u10D8\u10E3\u10E0\u10D8 AI \u10DB\u10DD\u10D7\u10EE\u10DD\u10D5\u10DC\u10D4\u10D1\u10D8\u10E1 \u10DA\u10D8\u10DB\u10D8\u10E2\u10D8 \u10D0\u10DB\u10DD\u10D8\u10EC\u10E3\u10E0\u10D0. \u10E8\u10D4\u10D2\u10D8\u10EB\u10DA\u10D8\u10D0\u10D7 Settings-\u10D8\u10D3\u10D0\u10DC \u10E9\u10D0\u10E0\u10D7\u10DD\u10D7 \u10DD\u10E4\u10DA\u10D0\u10D8\u10DC \u10E0\u10D4\u10DF\u10D8\u10DB\u10D8 \u10D0\u10DC \u10EA\u10DD\u10E2\u10D0 \u10EE\u10D0\u10DC\u10E8\u10D8 \u10E1\u10EA\u10D0\u10D3\u10DD\u10D7 \u10D7\u10D0\u10D5\u10D8\u10D3\u10D0\u10DC." : "Daily AI request limit reached. You can turn on Offline Mode in Settings or try again shortly.";
    } else {
      text = appLanguage === "ka" ? "AI \u10D3\u10E0\u10DD\u10D4\u10D1\u10D8\u10D7 \u10DB\u10D8\u10E3\u10EC\u10D5\u10D3\u10DD\u10DB\u10D4\u10DA\u10D8\u10D0. \u10D2\u10D7\u10EE\u10DD\u10D5\u10D7, \u10EA\u10DD\u10E2\u10D0 \u10EE\u10D0\u10DC\u10E8\u10D8 \u10E1\u10EA\u10D0\u10D3\u10DD\u10D7 \u10D7\u10D0\u10D5\u10D8\u10D3\u10D0\u10DC." : "AI is temporarily unavailable. Please try again shortly.";
    }
    return {
      text,
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: Math.round(endTime - startTime) }
    };
  }
}
async function generateNewPersona(basePersona, prompt, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const systemPrompt = `
      You are a Persona Architect. Create a new digital persona based on the user's prompt.
      The persona must have an ID, Name (EN/GE), Role, Description (EN/GE), System Instruction, and an Emoji Avatar.
      Respond ONLY with a JSON object matching the Persona type.
      
      BASE PERSONA FOR CONTEXT: ${JSON.stringify(basePersona)}
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [systemPrompt, prompt]
    });
    const text = response.text ? response.text.replace(/```json|```/g, "") : "{}";
    const newPersona = JSON.parse(text);
    newPersona.id = `persona-${Date.now()}`;
    return newPersona;
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] generateNewPersona fallback triggered: ${errStr.substring(0, 120)}`);
    return {
      id: `persona-${Date.now()}`,
      name: `${prompt.substring(0, 15)} Advisor`,
      nameGe: `${prompt.substring(0, 15)} \u10DB\u10E0\u10E9\u10D4\u10D5\u10D4\u10DA\u10D8`,
      role: "Strategic Assistant",
      description: `Optimized specialist adapted to: "${prompt.substring(0, 40)}"`,
      descriptionGe: `\u10E1\u10DE\u10D4\u10EA\u10D8\u10D0\u10DA\u10D8\u10E1\u10E2\u10D8, \u10E0\u10DD\u10DB\u10D4\u10DA\u10D8\u10EA \u10DB\u10DD\u10E0\u10D2\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0 \u10DB\u10DD\u10D7\u10EE\u10DD\u10D5\u10DC\u10D0\u10D6\u10D4: "${prompt.substring(0, 40)}"`,
      avatar: "\u{1F916}",
      language: "Mixed",
      systemInstruction: `You are an expert digital assistant customized for: "${prompt}". Provide guidance in both English and Georgian, ensuring context-rich responses.`
    };
  }
}
async function summarizeConversation(history, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) return "AI engine not initialized.";
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...history,
        { role: "user", parts: [{ text: "Summarize this conversation in a concise way, highlighting key points and actionable items." }] }
      ]
    });
    return response.text || "Could not generate summary.";
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] summarizeConversation fallback triggered: ${errStr.substring(0, 120)}`);
    return "\u{1F4A1} **\u10E1\u10D0\u10E3\u10D1\u10E0\u10D8\u10E1 \u10E8\u10D4\u10EF\u10D0\u10DB\u10D4\u10D1\u10D0 (Offline Mode)**:\n\n* **\u10D1\u10D8\u10D6\u10DC\u10D4\u10E1 \u10D8\u10D3\u10D4\u10D4\u10D1\u10D8:** \u10D2\u10D0\u10DC\u10EE\u10D8\u10DA\u10E3\u10DA\u10D8\u10D0 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA \u10D1\u10D0\u10D6\u10D0\u10E0\u10D6\u10D4 \u10DB\u10DD\u10E0\u10D2\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D0\u10D5\u10D7\u10D4\u10DC\u10E2\u10E3\u10E0\u10D8 \u10DB\u10D0\u10E0\u10D9\u10D4\u10E2\u10D8\u10DC\u10D2\u10D8\u10E1\u10D0 \u10D3\u10D0 \u10E2\u10D4\u10E5\u10DC\u10DD\u10DA\u10DD\u10D2\u10D8\u10E3\u10E0\u10D8 \u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8\u10D4\u10D1\u10D8.\n* **\u10D0\u10D5\u10E2\u10DD\u10DB\u10D0\u10E2\u10D8\u10D6\u10D0\u10EA\u10D8\u10D0:** \u10D3\u10D0\u10D2\u10D4\u10D2\u10DB\u10D8\u10DA\u10D8\u10D0 \u10D1\u10D8\u10D6\u10DC\u10D4\u10E1 \u10DC\u10D0\u10D9\u10D0\u10D3\u10D4\u10D1\u10D8\u10E1 (Workflows) \u10D2\u10D0\u10D0\u10E5\u10E2\u10D8\u10E3\u10E0\u10D4\u10D1\u10D0 \u10D3\u10D0\u10E7\u10DD\u10D5\u10DC\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10E1\u10D0\u10DB\u10EA\u10D8\u10E0\u10D4\u10D1\u10DA\u10D0\u10D3.\n* **\u10D2\u10D0\u10E4\u10D0\u10E0\u10D7\u10DD\u10D4\u10D1\u10D0:** \u10E0\u10D4\u10D9\u10DD\u10DB\u10D4\u10DC\u10D3\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0 \u10DE\u10D0\u10E0\u10D0\u10DB\u10D4\u10E2\u10E0\u10D4\u10D1\u10E8\u10D8 \u201EAI \u10E1\u10D8\u10DB\u10E3\u10DA\u10D0\u10EA\u10D8\u10E3\u10E0\u10D8 \u10E0\u10D4\u10DF\u10D8\u10DB\u10D8\u10E1\u201C \u10E9\u10D0\u10E0\u10D7\u10D5\u10D0 \u10E8\u10D4\u10D6\u10E6\u10E3\u10D3\u10D5\u10D4\u10D1\u10D8\u10E1 \u10D0\u10E1\u10D0\u10EA\u10D8\u10DA\u10D4\u10D1\u10DA\u10D0\u10D3.";
  }
}
async function analyzeWorkflow(workflow, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) return "AI engine not initialized.";
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analyze the following workflow and suggest improvements for efficiency and scalability:
      Name: ${workflow.name}
      Trigger: ${workflow.trigger}
      Action: ${workflow.action}`
    });
    return response.text || "Could not analyze workflow.";
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] analyzeWorkflow fallback triggered: ${errStr.substring(0, 120)}`);
    return `### \u{1F4CA} \u10D1\u10D8\u10D6\u10DC\u10D4\u10E1 \u10DC\u10D0\u10D9\u10D0\u10D3\u10D8\u10E1 \u10D3\u10D8\u10D0\u10D2\u10DC\u10DD\u10E1\u10E2\u10D8\u10D9\u10D0 \u10D3\u10D0 \u10DD\u10DE\u10E2\u10D8\u10DB\u10D8\u10D6\u10D0\u10EA\u10D8\u10D0 (Offline Mode)
  
**\u10E1\u10D0\u10EE\u10D4\u10DA\u10D8:** ${workflow.name}
**\u10D0\u10DB\u10D0\u10DB\u10E3\u10E8\u10D0\u10D5\u10D4\u10D1\u10D4\u10DA\u10D8 \u10E2\u10E0\u10D8\u10D2\u10D4\u10E0\u10D8:** ${workflow.trigger}
**\u10E8\u10D4\u10E1\u10D0\u10E1\u10E0\u10E3\u10DA\u10D4\u10D1\u10D4\u10DA\u10D8 \u10E5\u10DB\u10D4\u10D3\u10D4\u10D1\u10D0:** ${workflow.action}

#### \u{1F3AF} \u10EB\u10D8\u10E0\u10D8\u10D7\u10D0\u10D3\u10D8 \u10E0\u10D4\u10D9\u10DD\u10DB\u10D4\u10DC\u10D3\u10D0\u10EA\u10D8\u10D4\u10D1\u10D8:
1. **\u10E1\u10D0\u10D8\u10DB\u10D4\u10D3\u10DD\u10DD\u10D1\u10D8\u10E1 \u10D9\u10DD\u10D4\u10E4\u10D8\u10EA\u10D8\u10D4\u10DC\u10E2\u10D8:** \u10E2\u10E0\u10D8\u10D2\u10D4\u10E0\u10D8 \u10DB\u10E3\u10E8\u10D0\u10DD\u10D1\u10E1 \u10E1\u10E2\u10D0\u10D1\u10D8\u10DA\u10E3\u10E0\u10D0\u10D3. \u10E0\u10D4\u10D9\u10DD\u10DB\u10D4\u10DC\u10D3\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0 \u10DB\u10DD\u10DC\u10D0\u10EA\u10D4\u10DB\u10D7\u10D0 \u10D0\u10D3\u10D2\u10D8\u10DA\u10DD\u10D1\u10E0\u10D8\u10D5\u10D8 \u10D5\u10D0\u10DA\u10D8\u10D3\u10D0\u10EA\u10D8\u10D8\u10E1 \u10D3\u10D0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D0.
2. **\u10D2\u10D0\u10DB\u10E2\u10D0\u10E0\u10E3\u10DC\u10D0\u10E0\u10D8\u10D0\u10DC\u10DD\u10D1\u10D0:** \u10DB\u10DD\u10DB\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D4\u10DA\u10D7\u10D0 \u10DB\u10DD\u10D7\u10EE\u10DD\u10D5\u10DC\u10D4\u10D1\u10D8 \u10D2\u10D0\u10D3\u10D0\u10DC\u10D0\u10EC\u10D8\u10DA\u10D3\u10D4\u10D1\u10D0 \u10D3\u10D0\u10E7\u10DD\u10D5\u10DC\u10D4\u10D1\u10D8\u10E1 \u10D2\u10D0\u10E0\u10D4\u10E8\u10D4.
3. **\u10E3\u10E1\u10D0\u10E4\u10E0\u10D7\u10EE\u10DD\u10D4\u10D1\u10D0 \u10D3\u10D0 \u10DA\u10DD\u10D2\u10D8\u10D9\u10D0:** \u10D3\u10D0\u10D0\u10DB\u10D0\u10E2\u10D4\u10D7 "Logic: Wait/Delay" \u10D0\u10DC \u10E8\u10D4\u10E2\u10E7\u10DD\u10D1\u10D8\u10DC\u10D4\u10D1\u10D8\u10E1 \u10D2\u10D0\u10D2\u10D6\u10D0\u10D5\u10DC\u10D0 Slack/Email-\u10D6\u10D4 \u10E8\u10D4\u10EA\u10D3\u10DD\u10DB\u10D4\u10D1\u10D8\u10E1 \u10DE\u10E0\u10D4\u10D5\u10D4\u10DC\u10EA\u10D8\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.

*(\u10E8\u10D4\u10DC\u10D8\u10E8\u10D5\u10DC\u10D0: \u10D0\u10DC\u10D0\u10DA\u10D8\u10D6\u10D8 \u10D2\u10D4\u10DC\u10D4\u10E0\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0 \u10DD\u10E4\u10DA\u10D0\u10D8\u10DC \u10E0\u10D4\u10DF\u10D8\u10DB\u10E8\u10D8 API \u10D9\u10D5\u10DD\u10E2\u10D8\u10E1 \u10D2\u10D0\u10D3\u10D0\u10ED\u10D0\u10E0\u10D1\u10D4\u10D1\u10D8\u10E1 \u10D2\u10D0\u10DB\u10DD. \u10D7\u10E5\u10D5\u10D4\u10DC \u10E8\u10D4\u10D2\u10D8\u10EB\u10DA\u10D8\u10D0\u10D7 \u10D3\u10D0\u10D0\u10D9\u10DD\u10DC\u10E4\u10D8\u10D2\u10E3\u10E0\u10D8\u10E0\u10DD\u10D7 \u10E1\u10D0\u10D9\u10E3\u10D7\u10D0\u10E0\u10D8 Gemini API Key \u10DE\u10D0\u10E0\u10D0\u10DB\u10D4\u10E2\u10E0\u10D4\u10D1\u10D8\u10D3\u10D0\u10DC \u2699\uFE0F)*`;
  }
}
async function generatePersonaAvatar(persona, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            text: `Generate a high-quality, professional digital avatar for an AI persona named '${persona.name}'. 
            Role: ${persona.role}. 
            Description: ${persona.description}. 
            Style: Neo-Brutalist, technical, clean, centered, circular composition, vibrant accents on a dark background. 
            The avatar should be iconic and represent the persona's expertise.
            OUTPUT ONLY THE IMAGE CONTENT.`
          }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });
    const candidates = response.candidates;
    if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image data returned from Gemini API");
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] generatePersonaAvatar fallback triggered: ${errStr.substring(0, 120)}`);
    return persona.avatar || "\u{1F916}";
  }
}
async function generateOrEditImage(prompt, imageBase64, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/jpeg",
        aspectRatio: "1:1"
      }
    });
    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (imageBytes) {
      return `data:image/jpeg;base64,${imageBytes}`;
    }
    throw new Error("No image data returned from Gemini API");
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] generateOrEditImage fallback triggered: ${errStr.substring(0, 120)}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <rect width="100%" height="100%" fill="#0c111d"/>
      <circle cx="200" cy="200" r="160" fill="url(#grad)" opacity="0.15"/>
      <defs>
        <radialGradient id="grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00f2ff"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <g transform="translate(200, 200)">
        <polygon points="0,-120 104,-60 104,60 0,120 -104,60 -104,-60" fill="none" stroke="#00f2ff" stroke-width="2" opacity="0.4"/>
        <polygon points="0,-100 86,-50 86,50 0,100 -86,50 -86,-50" fill="none" stroke="#bc77ff" stroke-width="1.5" opacity="0.6"/>
        <circle cx="0" cy="0" r="40" fill="#00f2ff" opacity="0.1"/>
        <circle cx="0" cy="0" r="20" fill="#bc77ff" opacity="0.3"/>
        <path d="M-50,0 Q0,-80 50,0" fill="none" stroke="#00f2ff" stroke-dasharray="4,4" stroke-width="2"/>
        <path d="M-50,0 Q0,80 50,0" fill="none" stroke="#bc77ff" stroke-dasharray="4,4" stroke-width="2"/>
      </g>
      <text x="200" y="320" fill="#00f2ff" font-family="monospace" font-size="12" letter-spacing="2" text-anchor="middle" opacity="0.8">PROTON SYSTEM LAYER</text>
      <text x="200" y="340" fill="#a4b3c6" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" opacity="0.6">OFFLINE GENERATION FOR: ${prompt.toUpperCase().substring(0, 30)}...</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
async function generateSpeech(text, voiceName = "Kore", apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || "Kore" }
          }
        }
      }
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }
    return base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] generateSpeech fallback triggered: ${errStr.substring(0, 120)}`);
    return "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  }
}
async function architectTask(project, temperature = 0.9, apiKeyOverride) {
  const startTime = performance.now();
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Be professional, brief, and structured. Architect an action plan for: ${project}.
      Respond EXCLUSIVELY in the user's language (e.g. Georgian for Georgian, English for English).`,
      config: {
        temperature,
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
    const endTime = performance.now();
    const metadata = {
      promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokenCount: response.usageMetadata?.totalTokenCount || 0,
      latency: Math.round(endTime - startTime)
    };
    return {
      data: JSON.parse(response.text || "{}"),
      metadata
    };
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] architectTask fallback triggered: ${errStr.substring(0, 120)}`);
    const endTime = performance.now();
    const materials = [
      { item: "Proton Cloud Infrastructure Node (Local)", cost: "0 GEL (Offline Tier)" },
      { item: "Local API Buffers & Security Handlers", cost: "0 GEL" }
    ];
    return {
      data: {
        materials,
        complexity: "Optimal / Adaptive",
        estimatedTime: "1-2 Hours (Offline)",
        firstSteps: [
          "Establish data queues inside your local browser storage context.",
          "Map initial triggers to Proton local processing nodes.",
          "Verify visual elements in the project manager layout."
        ]
      },
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: Math.round(endTime - startTime) }
    };
  }
}
async function translateText(text, sourceRole, targetLanguage, systemInstruction, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized (GEMINI_API_KEY is missing on server)");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate this for the ${targetLanguage} speaker. Input from ${sourceRole}: ${text}`,
      config: {
        systemInstruction
      }
    });
    return response.text || "";
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] translateText fallback triggered: ${errStr.substring(0, 120)}`);
    const textLower = text.toLowerCase();
    if (targetLanguage === "Georgian" || targetLanguage === "georgian" || targetLanguage.includes("\u10E5\u10D0\u10E0\u10D7\u10E3\u10DA")) {
      if (textLower.includes("hello") || textLower.includes("hi")) return "\u10D2\u10D0\u10DB\u10D0\u10E0\u10EF\u10DD\u10D1\u10D0, \u10E1\u10D0\u10E1\u10D8\u10D0\u10DB\u10DD\u10D5\u10DC\u10DD\u10D0 \u10D7\u10E5\u10D5\u10D4\u10DC\u10D7\u10D0\u10DC \u10E8\u10D4\u10EE\u10D5\u10D4\u10D3\u10E0\u10D0!";
      if (textLower.includes("how much") || textLower.includes("price")) return "\u10E0\u10D0 \u10E6\u10D8\u10E0\u10E1 \u10D4\u10E1 \u10DB\u10DD\u10DB\u10E1\u10D0\u10EE\u10E3\u10E0\u10D4\u10D1\u10D0/\u10DE\u10E0\u10DD\u10D3\u10E3\u10E5\u10E2\u10D8?";
      if (textLower.includes("thank")) return "\u10D3\u10D8\u10D3\u10D8 \u10DB\u10D0\u10D3\u10DA\u10DD\u10D1\u10D0 \u10D3\u10D0\u10EE\u10DB\u10D0\u10E0\u10D4\u10D1\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1!";
      return `[\u10D7\u10D0\u10E0\u10D2\u10DB\u10D0\u10DC\u10D8 (\u10DD\u10E4\u10DA\u10D0\u10D8\u10DC)]: ${text}`;
    } else {
      if (textLower.includes("\u10D2\u10D0\u10DB\u10D0\u10E0\u10EF\u10DD\u10D1\u10D0")) return "Hello, nice to meet you!";
      if (textLower.includes("\u10DB\u10D0\u10D3\u10DA\u10DD\u10D1\u10D0")) return "Thank you very much!";
      if (textLower.includes("\u10E4\u10D0\u10E1\u10D8") || textLower.includes("\u10E0\u10D0 \u10E6\u10D8\u10E0\u10E1")) return "How much does this cost?";
      return `[Translated (Offline)]: ${text}`;
    }
  }
}
async function generateTechSpec(title, category, apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized (GEMINI_API_KEY is missing on server)");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate a professional, concise "Tech Spec" or detailed description for a marketplace listing.
      Product Title: ${title}
      Category: ${category}
      
      Requirements:
      - Use professional language.
      - Include technical details if applicable.
      - Format with clear sections or bullet points if necessary.
      - Maximum 500 characters.
      - Return only the description text.`,
      config: {
        temperature: 0.7
      }
    });
    return response.text || "";
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] generateTechSpec fallback triggered: ${errStr.substring(0, 120)}`);
    return `Professional specification for **${title}** (${category}). Fully inspected, guaranteed high fidelity, and ready for immediate deployment in local workflows. Supports seamless integrations with modern services.`;
  }
}
async function breakdownTask(taskContent, appLanguage = "en", apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const prompt = appLanguage === "ka" ? `\u10DB\u10DD\u10EA\u10D4\u10DB\u10E3\u10DA\u10D8\u10D0 \u10D3\u10D0\u10D5\u10D0\u10DA\u10D4\u10D1\u10D0: "${taskContent}". 
\u10D3\u10D0\u10E7\u10D0\u10D5\u10D8 \u10D4\u10E1 \u10D3\u10D0\u10D5\u10D0\u10DA\u10D4\u10D1\u10D0 3-\u10D3\u10D0\u10DC 6-\u10DB\u10D3\u10D4 \u10D9\u10DD\u10DC\u10D9\u10E0\u10D4\u10E2\u10E3\u10DA, \u10DB\u10D0\u10E0\u10E2\u10D8\u10D5 \u10D3\u10D0 \u10DE\u10E0\u10D0\u10E5\u10E2\u10D8\u10D9\u10E3\u10DA \u10E5\u10D5\u10D4-\u10D3\u10D0\u10D5\u10D0\u10DA\u10D4\u10D1\u10D0\u10D3 (\u10DC\u10D0\u10D1\u10D8\u10EF\u10D0\u10D3), \u10E0\u10DD\u10DB\u10DA\u10D4\u10D1\u10D8\u10EA \u10E1\u10D0\u10ED\u10D8\u10E0\u10DD\u10D0 \u10DB\u10D8\u10E1 \u10E8\u10D4\u10E1\u10D0\u10E1\u10E0\u10E3\u10DA\u10D4\u10D1\u10DA\u10D0\u10D3.
\u10DE\u10D0\u10E1\u10E3\u10EE\u10D8 \u10D3\u10D0\u10D0\u10D1\u10E0\u10E3\u10DC\u10D4 \u10D4\u10E5\u10E1\u10D9\u10DA\u10E3\u10D6\u10D8\u10E3\u10E0\u10D0\u10D3 JSON \u10E4\u10DD\u10E0\u10DB\u10D0\u10E2\u10E8\u10D8, \u10E0\u10DD\u10D2\u10DD\u10E0\u10EA \u10E2\u10D4\u10E5\u10E1\u10E2\u10E3\u10E0\u10D8 \u10DB\u10D0\u10E1\u10D8\u10D5\u10D8 (array of strings). \u10DB\u10D0\u10D2\u10D0\u10DA\u10D8\u10D7\u10D0\u10D3: ["\u10DC\u10D0\u10D1\u10D8\u10EF\u10D8 1", "\u10DC\u10D0\u10D1\u10D8\u10EF\u10D8 2", "\u10DC\u10D0\u10D1\u10D8\u10EF\u10D8 3"].
\u10D0\u10E0 \u10D3\u10D0\u10EC\u10D4\u10E0\u10DD \u10D0\u10E0\u10D0\u10DC\u10D0\u10D8\u10E0\u10D8 \u10E1\u10EE\u10D5\u10D0 \u10E2\u10D4\u10E5\u10E1\u10E2\u10D8, \u10E8\u10D4\u10E1\u10D0\u10D5\u10D0\u10DA\u10D8 \u10D0\u10DC \u10D3\u10D0\u10E1\u10D9\u10D5\u10DC\u10D0, \u10DB\u10EE\u10DD\u10DA\u10DD\u10D3 \u10E1\u10E3\u10E4\u10D7\u10D0 JSON \u10DB\u10D0\u10E1\u10D8\u10D5\u10D8.` : `Given the task: "${taskContent}".
Break down this task into 3 to 6 actionable, simple, and practical subtasks (steps) needed to complete it.
Respond EXCLUSIVELY in JSON format as a plain array of strings. Example: ["Step 1", "Step 2", "Step 3"].
Do not include any other text, markdown wrapper, or explanation, just the raw JSON array.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const text = response.text ? response.text.trim() : "[]";
    return JSON.parse(text);
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] breakdownTask fallback triggered: ${errStr.substring(0, 120)}`);
    if (appLanguage === "ka") {
      return [
        `\u10D3\u10D0\u10D2\u10D4\u10D2\u10DB\u10D4\u10D7 \u10E1\u10D0\u10EC\u10E7\u10D8\u10E1\u10D8 \u10D4\u10E2\u10D0\u10DE\u10D4\u10D1\u10D8 \u10D3\u10D0\u10D5\u10D0\u10DA\u10D4\u10D1\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1: "${taskContent}"`,
        "\u10E8\u10D4\u10D0\u10D2\u10E0\u10DD\u10D5\u10D4\u10D7 \u10E1\u10D0\u10ED\u10D8\u10E0\u10DD \u10D8\u10DC\u10E4\u10DD\u10E0\u10DB\u10D0\u10EA\u10D8\u10D0 \u10D3\u10D0 \u10E0\u10D4\u10E1\u10E3\u10E0\u10E1\u10D4\u10D1\u10D8",
        "\u10D2\u10D0\u10DC\u10D0\u10EE\u10DD\u10E0\u10EA\u10D8\u10D4\u10DA\u10D4\u10D7 \u10DE\u10D8\u10E0\u10D5\u10D4\u10DA\u10D8 \u10DE\u10E0\u10D0\u10E5\u10E2\u10D8\u10D9\u10E3\u10DA\u10D8 \u10DC\u10D0\u10D1\u10D8\u10EF\u10D8",
        "\u10D2\u10D0\u10D3\u10D0\u10D0\u10DB\u10DD\u10EC\u10DB\u10D4\u10D7 \u10E8\u10D4\u10E1\u10E0\u10E3\u10DA\u10D4\u10D1\u10E3\u10DA\u10D8 \u10E1\u10D0\u10DB\u10E3\u10E8\u10D0\u10DD \u10D3\u10D0 \u10D3\u10D0\u10D0\u10E1\u10E0\u10E3\u10DA\u10D4\u10D7"
      ];
    } else {
      return [
        `Plan initial requirements for: "${taskContent}"`,
        "Gather necessary references and assets",
        "Execute the primary implementation step",
        "Verify outcomes and complete review"
      ];
    }
  }
}
async function generateStrategicObjective(appLanguage = "en", apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const prompt = appLanguage === "ka" ? `\u10E8\u10D4\u10E5\u10DB\u10D4\u10DC\u10D8 \u10D4\u10E0\u10D7\u10D8 \u10D0\u10EE\u10D0\u10DA\u10D8, \u10E0\u10D4\u10D0\u10DA\u10D8\u10E1\u10E2\u10E3\u10E0\u10D8 \u10D3\u10D0 \u10D8\u10DC\u10DD\u10D5\u10D0\u10EA\u10D8\u10E3\u10E0\u10D8 \u10D1\u10D8\u10D6\u10DC\u10D4\u10E1/\u10E2\u10D4\u10E5\u10DC\u10D8\u10D9\u10E3\u10E0\u10D8 \u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8\u10E3\u10DA\u10D8 \u10DB\u10D8\u10D6\u10D0\u10DC\u10D8 (Strategic Goal) \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D8 \u10D0\u10DC \u10E1\u10D0\u10D4\u10E0\u10D7\u10D0\u10E8\u10DD\u10E0\u10D8\u10E1\u10DD \u10E1\u10E2\u10D0\u10E0\u10E2\u10D0\u10DE\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.
\u10DB\u10D8\u10D6\u10D0\u10DC\u10D8 \u10E3\u10DC\u10D3\u10D0 \u10D4\u10EE\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 \u10D4\u10E0\u10D7-\u10D4\u10E0\u10D7 \u10D9\u10D0\u10E2\u10D4\u10D2\u10DD\u10E0\u10D8\u10D0\u10E1: "Infrastructure", "System", "Interface", "Security" \u10D0\u10DC "Intelligence".
\u10DE\u10E0\u10D8\u10DD\u10E0\u10D8\u10E2\u10D4\u10E2\u10D8 \u10E3\u10DC\u10D3\u10D0 \u10D8\u10E7\u10DD\u10E1 \u10D4\u10E0\u10D7-\u10D4\u10E0\u10D7\u10D8: "low", "medium" \u10D0\u10DC "high".
\u10E5\u10D5\u10D4-\u10D0\u10DB\u10DD\u10EA\u10D0\u10DC\u10D4\u10D1\u10D8 (subtasks) \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1 3-\u10D3\u10D0\u10DC 5-\u10DB\u10D3\u10D4 \u10D9\u10DD\u10DC\u10D9\u10E0\u10D4\u10E2\u10E3\u10DA \u10DC\u10D0\u10D1\u10D8\u10EF\u10E1.
\u10D3\u10D0\u10D0\u10D1\u10E0\u10E3\u10DC\u10D4 \u10DE\u10D0\u10E1\u10E3\u10EE\u10D8 \u10D4\u10E5\u10E1\u10D9\u10DA\u10E3\u10D6\u10D8\u10E3\u10E0\u10D0\u10D3 JSON \u10E4\u10DD\u10E0\u10DB\u10D0\u10E2\u10E8\u10D8, \u10E8\u10D4\u10DB\u10D3\u10D4\u10D2\u10D8 \u10E1\u10E5\u10D4\u10DB\u10D8\u10D7:
{
  "title": "\u10DB\u10D8\u10D6\u10DC\u10D8\u10E1 \u10DB\u10DD\u10D9\u10DA\u10D4 \u10D3\u10D0 \u10D6\u10E3\u10E1\u10E2\u10D8 \u10E1\u10D0\u10D7\u10D0\u10E3\u10E0\u10D8 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D0\u10D3",
  "priority": "low" | "medium" | "high",
  "category": "Infrastructure" | "System" | "Interface" | "Security" | "Intelligence",
  "subtasks": [
    { "label": "\u10DC\u10D0\u10D1\u10D8\u10EF\u10D8 1 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D0\u10D3", "completed": false },
    { "label": "\u10DC\u10D0\u10D1\u10D8\u10EF\u10D8 2 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D0\u10D3", "completed": false }
  ]
}` : `Create a single, realistic, and innovative business/technical strategic goal (Strategic Goal) for a startup.
The goal should belong to one of these categories: "Infrastructure", "System", "Interface", "Security", or "Intelligence".
Priority must be one of: "low", "medium", or "high".
Subtasks should contain 3 to 5 actionable steps.
Respond EXCLUSIVELY in JSON format following this schema:
{
  "title": "Clear and precise goal title in English",
  "priority": "low" | "medium" | "high",
  "category": "Infrastructure" | "System" | "Interface" | "Security" | "Intelligence",
  "subtasks": [
    { "label": "Step 1 in English", "completed": false },
    { "label": "Step 2 in English", "completed": false }
  ]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.85,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            priority: { type: Type.STRING },
            category: { type: Type.STRING },
            subtasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  completed: { type: Type.BOOLEAN }
                },
                required: ["label", "completed"]
              }
            }
          },
          required: ["title", "priority", "category", "subtasks"]
        }
      }
    });
    const text = response.text ? response.text.trim() : "{}";
    const data = JSON.parse(text);
    return {
      title: data.title || (appLanguage === "ka" ? "\u10D8\u10DC\u10E2\u10D4\u10DA\u10D4\u10E5\u10E2\u10E3\u10D0\u10DA\u10E3\u10E0\u10D8 \u10E1\u10D9\u10D0\u10DA\u10D8\u10E0\u10D4\u10D1\u10D0" : "Autonomous Intelligence Scaling"),
      priority: ["low", "medium", "high"].includes(data.priority) ? data.priority : "medium",
      category: ["Infrastructure", "System", "Interface", "Security", "Intelligence"].includes(data.category) ? data.category : "System",
      subtasks: Array.isArray(data.subtasks) ? data.subtasks.map((st) => ({
        label: st.label || "Step",
        completed: !!st.completed
      })) : []
    };
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] generateStrategicObjective fallback triggered: ${errStr.substring(0, 120)}`);
    if (appLanguage === "ka") {
      return {
        title: "\u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D8\u10E1 \u10DA\u10DD\u10D9\u10D0\u10DA\u10E3\u10E0\u10D8 \u10E0\u10D4\u10DE\u10DA\u10D8\u10D9\u10D0\u10EA\u10D8\u10D0",
        priority: "medium",
        category: "Infrastructure",
        subtasks: [
          { label: "\u10D9\u10DD\u10DC\u10E2\u10D4\u10D8\u10DC\u10D4\u10E0\u10D8\u10E1 \u10DA\u10DD\u10D9\u10D0\u10DA\u10E3\u10E0\u10D8 \u10D3\u10D0\u10E7\u10D4\u10DC\u10D4\u10D1\u10D0", completed: false },
          { label: "\u10DB\u10DD\u10DC\u10D0\u10EA\u10D4\u10DB\u10D7\u10D0 \u10E1\u10D8\u10DC\u10E5\u10E0\u10DD\u10DC\u10D8\u10D6\u10D0\u10EA\u10D8\u10D8\u10E1 \u10D1\u10E3\u10E4\u10D4\u10E0\u10D8", completed: false },
          { label: "\u10E0\u10D4\u10D6\u10D4\u10E0\u10D5\u10D4\u10D1\u10D8\u10E1 \u10D0\u10D5\u10E2\u10DD\u10DB\u10D0\u10E2\u10E3\u10E0\u10D8 \u10D2\u10D0\u10D3\u10D0\u10DB\u10DD\u10EC\u10DB\u10D4\u10D1\u10D0", completed: false }
        ]
      };
    } else {
      return {
        title: "Local Database Replication",
        priority: "medium",
        category: "Infrastructure",
        subtasks: [
          { label: "Configure failover clusters locally", completed: false },
          { label: "Enable browser-side state persistence", completed: false },
          { label: "Verify logical fallback endpoints", completed: false }
        ]
      };
    }
  }
}
async function expandObjectiveAnalysis(title, category, appLanguage = "en", apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const prompt = appLanguage === "ka" ? `\u10E8\u10D4\u10DC \u10EE\u10D0\u10E0 \u10D1\u10D8\u10D6\u10DC\u10D4\u10E1 \u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8 \u10D3\u10D0 \u10E2\u10D4\u10E5\u10DC\u10D8\u10D9\u10E3\u10E0\u10D8 \u10DB\u10E0\u10E9\u10D4\u10D5\u10D4\u10DA\u10D8.
\u10D2\u10D0\u10D0\u10D9\u10D4\u10D7\u10D4 \u10E1\u10D8\u10E6\u10E0\u10DB\u10D8\u10E1\u10D4\u10E3\u10DA\u10D8, \u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D0\u10DA\u10D8\u10D6\u10D8 \u10E8\u10D4\u10DB\u10D3\u10D4\u10D2\u10D8 \u10DB\u10D8\u10D6\u10DC\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1: "${title}" (\u10D9\u10D0\u10E2\u10D4\u10D2\u10DD\u10E0\u10D8\u10D0: "${category}").
\u10D3\u10D0\u10EC\u10D4\u10E0\u10D4 \u10D3\u10D0\u10D0\u10EE\u10DA\u10DD\u10D4\u10D1\u10D8\u10D7 300-500 \u10E1\u10D8\u10E2\u10E7\u10D5\u10D0 \u10DA\u10D0\u10DB\u10D0\u10D6\u10D8 Markdown \u10E4\u10DD\u10E0\u10DB\u10D0\u10E2\u10D8\u10E0\u10D4\u10D1\u10D8\u10D7 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA \u10D4\u10DC\u10D0\u10D6\u10D4.
\u10D0\u10DC\u10D0\u10DA\u10D8\u10D6\u10D8 \u10E3\u10DC\u10D3\u10D0 \u10DB\u10DD\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1 \u10E8\u10D4\u10DB\u10D3\u10D4\u10D2 \u10E1\u10D4\u10E5\u10EA\u10D8\u10D4\u10D1\u10E1:
1. **\u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8\u10E3\u10DA\u10D8 \u10D9\u10DD\u10DC\u10E2\u10D4\u10E5\u10E1\u10E2\u10D8 (Strategic Context)** - \u10E0\u10D0\u10E2\u10DD\u10DB \u10D0\u10E0\u10D8\u10E1 \u10D4\u10E1 \u10DB\u10D8\u10D6\u10D0\u10DC\u10D8 \u10D9\u10E0\u10D8\u10E2\u10D8\u10D9\u10E3\u10DA\u10D8 \u10D3\u10D0 \u10E0\u10D0 \u10DE\u10E0\u10DD\u10D1\u10DA\u10D4\u10DB\u10D4\u10D1\u10E1 \u10EC\u10E7\u10D5\u10D4\u10E2\u10E1 \u10D8\u10E1.
2. **\u10DC\u10D0\u10D1\u10D8\u10EF-\u10DC\u10D0\u10D1\u10D8\u10EF \u10E1\u10D0\u10D2\u10D6\u10D0\u10DD \u10E0\u10E3\u10D9\u10D0 (Roadmap)** - \u10D3\u10D4\u10E2\u10D0\u10DA\u10E3\u10E0\u10D8 \u10D4\u10E2\u10D0\u10DE\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10E1\u10D0\u10DD\u10E0\u10D8\u10D4\u10DC\u10E2\u10D0\u10EA\u10D8\u10DD \u10D3\u10E0\u10DD\u10D4\u10D1\u10D8.
3. **\u10EB\u10D8\u10E0\u10D8\u10D7\u10D0\u10D3\u10D8 KPI-\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10EC\u10D0\u10E0\u10DB\u10D0\u10E2\u10D4\u10D1\u10D8\u10E1 \u10E1\u10D0\u10D6\u10DD\u10DB\u10D4\u10D1\u10D8 (Key Performance Indicators)** - \u10E0\u10DD\u10D2\u10DD\u10E0 \u10D2\u10D0\u10D5\u10D8\u10D2\u10D4\u10D1\u10D7, \u10E0\u10DD\u10DB \u10DB\u10D8\u10D6\u10D0\u10DC\u10D8 \u10DB\u10D8\u10E6\u10EC\u10D4\u10E3\u10DA\u10D8\u10D0.
4. **\u10E0\u10D8\u10E1\u10D9\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10DE\u10E0\u10D4\u10D5\u10D4\u10DC\u10EA\u10D8\u10D0 (Risks & Mitigation)** - \u10E0\u10D0 \u10E8\u10D4\u10D8\u10EB\u10DA\u10D4\u10D1\u10D0 \u10EC\u10D0\u10D5\u10D8\u10D3\u10D4\u10E1 \u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D0\u10D3 \u10D3\u10D0 \u10E0\u10DD\u10D2\u10DD\u10E0 \u10D0\u10D5\u10D8\u10EA\u10D8\u10DA\u10DD\u10D7 \u10D7\u10D0\u10D5\u10D8\u10D3\u10D0\u10DC.
5. **\u10DA\u10DD\u10D9\u10D0\u10DA\u10E3\u10E0\u10D8 \u10E0\u10D4\u10D9\u10DD\u10DB\u10D4\u10DC\u10D3\u10D0\u10EA\u10D8\u10D0 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA\u10D8 \u10D1\u10D0\u10D6\u10E0\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1 (Georgian Market Nuances)** - \u10DE\u10E0\u10D0\u10E5\u10E2\u10D8\u10D9\u10E3\u10DA\u10D8 \u10E0\u10E9\u10D4\u10D5\u10D0 \u10D0\u10D3\u10D2\u10D8\u10DA\u10DD\u10D1\u10E0\u10D8\u10D5\u10D8 \u10E1\u10DE\u10D4\u10EA\u10D8\u10E4\u10D8\u10D9\u10D8\u10E1 \u10D2\u10D0\u10D7\u10D5\u10D0\u10DA\u10D8\u10E1\u10EC\u10D8\u10DC\u10D4\u10D1\u10D8\u10D7.` : `You are a strategic business advisor and chief technology officer.
Provide a deep, strategic analysis for the following objective: "${title}" (Category: "${category}").
Write approximately 300-500 words with elegant Markdown formatting in English.
The analysis must include:
1. **Strategic Context** - Why this goal is critical and what bottlenecks it resolves.
2. **Step-by-Step Implementation Roadmap** - Phased execution timeline and dependencies.
3. **Key KPIs & Measurement Metrics** - How we define and measure quantitative success.
4. **Risk Factors & Mitigation Strategies** - Potential points of failure and contingency planning.
5. **Startup Advisory Tips** - Practical recommendations tailored to lean product operations.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.8
      }
    });
    return response.text || "No analysis could be generated.";
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] expandObjectiveAnalysis fallback triggered: ${errStr.substring(0, 120)}`);
    if (appLanguage === "ka") {
      return `### \u{1F4CA} \u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8\u10E3\u10DA\u10D8 \u10D0\u10DC\u10D0\u10DA\u10D8\u10D6\u10D8 (Offline Mode): ${title}
      
\u10DB\u10DD\u10EA\u10D4\u10DB\u10E3\u10DA\u10D8\u10D0 \u10D3\u10D4\u10E2\u10D0\u10DA\u10E3\u10E0\u10D8 \u10D0\u10DC\u10D0\u10DA\u10D8\u10D6\u10D8 \u10D7\u10E5\u10D5\u10D4\u10DC\u10D8 \u10DB\u10D8\u10D6\u10DC\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1. 

#### 1. \u10E1\u10E2\u10E0\u10D0\u10E2\u10D4\u10D2\u10D8\u10E3\u10DA\u10D8 \u10D9\u10DD\u10DC\u10E2\u10D4\u10E5\u10E1\u10E2\u10D8 (Strategic Context)
\u10D4\u10E1 \u10DB\u10D8\u10D6\u10D0\u10DC\u10D8 \u10D9\u10E0\u10D8\u10E2\u10D8\u10D9\u10E3\u10DA\u10D8\u10D0 \u10D3\u10D0\u10E4\u10D0\u10E0\u10D5\u10D8\u10E1 \u10EE\u10D0\u10E0\u10D8\u10E1\u10EE\u10D8\u10E1\u10D0 \u10D3\u10D0 \u10E1\u10E2\u10D0\u10D1\u10D8\u10DA\u10E3\u10E0\u10DD\u10D1\u10D8\u10E1 \u10E3\u10D6\u10E0\u10E3\u10DC\u10D5\u10D4\u10DA\u10E1\u10D0\u10E7\u10DD\u10E4\u10D0\u10D3 \u10E5\u10D0\u10E0\u10D7\u10E3\u10DA \u10D1\u10D0\u10D6\u10D0\u10E0\u10D6\u10D4, \u10D2\u10D0\u10DC\u10E1\u10D0\u10D9\u10E3\u10D7\u10E0\u10D4\u10D1\u10D8\u10D7 \u10D7\u10D1\u10D8\u10DA\u10D8\u10E1\u10D8\u10E1 \u10DB\u10D6\u10D0\u10E0\u10D3\u10D8 \u10E2\u10D4\u10E5\u10DC\u10DD\u10DA\u10DD\u10D2\u10D8\u10E3\u10E0\u10D8 \u10D4\u10D9\u10DD\u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.

#### 2. \u10DC\u10D0\u10D1\u10D8\u10EF-\u10DC\u10D0\u10D1\u10D8\u10EF \u10E1\u10D0\u10D2\u10D6\u10D0\u10DD \u10E0\u10E3\u10D9\u10D0 (Roadmap)
* **\u10E4\u10D0\u10D6\u10D0 1 (\u10D9\u10D5\u10D8\u10E0\u10D0 1):** \u10D0\u10E0\u10E5\u10D8\u10E2\u10D4\u10E5\u10E2\u10E3\u10E0\u10E3\u10DA\u10D8 \u10DB\u10DD\u10DC\u10D0\u10EE\u10D0\u10D6\u10D8 \u10D3\u10D0 \u10DB\u10DD\u10DB\u10D6\u10D0\u10D3\u10D4\u10D1\u10D0.
* **\u10E4\u10D0\u10D6\u10D0 2 (\u10D9\u10D5\u10D8\u10E0\u10D0 2-3):** \u10E1\u10D0\u10EC\u10E7\u10D8\u10E1\u10D8 \u10DE\u10E0\u10DD\u10E2\u10DD\u10E2\u10D8\u10DE\u10D8\u10E0\u10D4\u10D1\u10D0 \u10D3\u10D0 \u10E2\u10D4\u10E1\u10E2\u10D8\u10E0\u10D4\u10D1\u10D0.
* **\u10E4\u10D0\u10D6\u10D0 3 (\u10D9\u10D5\u10D8\u10E0\u10D0 4):** \u10E1\u10E0\u10E3\u10DA\u10D8 \u10D8\u10DC\u10E2\u10D4\u10D2\u10E0\u10D0\u10EA\u10D8\u10D0 \u10D3\u10D0 \u10DB\u10DD\u10DC\u10D8\u10E2\u10DD\u10E0\u10D8\u10DC\u10D2\u10D8.

#### 3. \u10EB\u10D8\u10E0\u10D8\u10D7\u10D0\u10D3\u10D8 KPI-\u10D4\u10D1\u10D8 (Key Performance Indicators)
* \u10D3\u10D0\u10E7\u10DD\u10D5\u10DC\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10DB\u10EA\u10D8\u10E0\u10D4\u10D1\u10D0 (Latency < 200ms)
* 99.9% \u10E1\u10D8\u10E1\u10E2\u10D4\u10DB\u10E3\u10E0\u10D8 \u10DB\u10E3\u10E8\u10D0\u10DD\u10D1\u10D8\u10E1 \u10D3\u10E0\u10DD (Uptime)

#### 4. \u10E0\u10D8\u10E1\u10D9\u10D4\u10D1\u10D8 \u10D3\u10D0 \u10DE\u10E0\u10D4\u10D5\u10D4\u10DC\u10EA\u10D8\u10D0 (Risks)
\u10DB\u10D7\u10D0\u10D5\u10D0\u10E0\u10D8 \u10E0\u10D8\u10E1\u10D9\u10D8 \u10D0\u10E0\u10D8\u10E1 \u10E1\u10D4\u10E0\u10D5\u10D4\u10E0\u10D8\u10E1 \u10E0\u10D4\u10E1\u10E3\u10E0\u10E1\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10D6\u10E6\u10E3\u10D3\u10E3\u10DA\u10DD\u10D1\u10D0, \u10E0\u10DD\u10DB\u10DA\u10D8\u10E1 \u10DE\u10E0\u10D4\u10D5\u10D4\u10DC\u10EA\u10D8\u10D0\u10EA \u10DB\u10DD\u10EE\u10D3\u10D4\u10D1\u10D0 \u10D3\u10D0\u10E2\u10D5\u10D8\u10E0\u10D7\u10D5\u10D8\u10E1 \u10E1\u10EC\u10DD\u10E0\u10D8 \u10DB\u10D4\u10DC\u10D4\u10EF\u10DB\u10D4\u10DC\u10E2\u10D8\u10D7.

*(\u10E8\u10D4\u10DC\u10D8\u10E8\u10D5\u10DC\u10D0: \u10D0\u10DC\u10D0\u10DA\u10D8\u10D6\u10D8 \u10D2\u10D4\u10DC\u10D4\u10E0\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8\u10D0 \u10DD\u10E4\u10DA\u10D0\u10D8\u10DC \u10E0\u10D4\u10DF\u10D8\u10DB\u10E8\u10D8 API \u10D9\u10D5\u10DD\u10E2\u10D8\u10E1 \u10D2\u10D0\u10D3\u10D0\u10ED\u10D0\u10E0\u10D1\u10D4\u10D1\u10D8\u10E1 \u10D2\u10D0\u10DB\u10DD. \u10D7\u10E5\u10D5\u10D4\u10DC \u10E8\u10D4\u10D2\u10D8\u10EB\u10DA\u10D8\u10D0\u10D7 \u10E9\u10D0\u10E0\u10D7\u10DD\u10D7 \u201EAI \u10E1\u10D8\u10DB\u10E3\u10DA\u10D0\u10EA\u10D8\u10E3\u10E0\u10D8 \u10E0\u10D4\u10DF\u10D8\u10DB\u10D8\u201C \u10DE\u10D0\u10E0\u10D0\u10DB\u10D4\u10E2\u10E0\u10D4\u10D1\u10D8\u10D3\u10D0\u10DC \u2699\uFE0F)*`;
    } else {
      return `### \u{1F4CA} Strategic Analysis (Offline Mode): ${title}
      
Here is the detailed structural and operational overview of your goal.

#### 1. Strategic Context
This objective is critical to ensuring high-quality operations and system stability for our target customer base.

#### 2. Phased Roadmap
* **Phase 1 (Week 1):** Structural definitions and alignment.
* **Phase 3 (Weeks 2-3):** Implementation of core connectors.
* **Phase 3 (Week 4):** Final deployment and logging review.

#### 3. Core Measurement Metrics (KPIs)
* Core process latency reduced by 25%.
* Integration error rate below 0.1%.

#### 4. Contingency Planning
Mitigate integration locks by routing offline callbacks gracefully through secondary buffers.

*(Note: Running in offline simulation mode due to shared API key rate limits. You can enable 'AI Simulation Mode' in \u2699\uFE0F settings)*`;
    }
  }
}
async function detectClipIssues(caption, duration, sampledBrightness, appLanguage = "en", apiKeyOverride) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized");
    const prompt = `
      You are a Professional Video Quality Assurance Agent.
      Analyze the video clip details below and detect common issues like black frames, audio silences, low lighting, or bad transitions.
      Suggest precise timestamp ranges (startSec and endSec) for parts that should be removed or trimmed.
      
      CLIP DETAILS:
      - Caption/Title: "${caption}"
      - Duration: ${duration} seconds
      - Frame Brightness Samples (0 to 255 scale, sampled evenly across the video): ${JSON.stringify(sampledBrightness)}
        (Note: low values (<35) indicate black/very dark frames. Sudden drops may mean bad transitions or blank intervals).
        
      Generate 2 to 4 realistic issues based on this data. If there are low brightness samples, prioritize those as black frames or blank transitions.
      Provide response in both English (En) and Georgian (Ka) fields.
      
      Respond EXCLUSIVELY in JSON format following this schema:
      [
        {
          "id": "unique-issue-id",
          "type": "black_frame" | "silence" | "shaky_cam" | "low_lighting" | "unwanted_intro",
          "titleEn": "Issue title in English",
          "titleKa": "Issue title in Georgian",
          "descriptionEn": "Description of what was detected in English",
          "descriptionKa": "Description of what was detected in Georgian",
          "suggestedActionEn": "Suggested fix in English",
          "suggestedActionKa": "Suggested fix in Georgian",
          "startSec": number (start timestamp in seconds),
          "endSec": number (end timestamp in seconds, must be <= clip duration)
        }
      ]
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.8,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              titleEn: { type: Type.STRING },
              titleKa: { type: Type.STRING },
              descriptionEn: { type: Type.STRING },
              descriptionKa: { type: Type.STRING },
              suggestedActionEn: { type: Type.STRING },
              suggestedActionKa: { type: Type.STRING },
              startSec: { type: Type.NUMBER },
              endSec: { type: Type.NUMBER }
            },
            required: ["id", "type", "titleEn", "titleKa", "descriptionEn", "descriptionKa", "suggestedActionEn", "suggestedActionKa", "startSec", "endSec"]
          }
        }
      }
    });
    const text = response.text ? response.text.trim() : "[]";
    return JSON.parse(text);
  } catch (error) {
    const errStr = error?.message || String(error);
    console.warn(`[Gemini API] detectClipIssues fallback triggered: ${errStr.substring(0, 120)}`);
    const issues = [];
    if (sampledBrightness.length > 0 && sampledBrightness[0] < 40) {
      issues.push({
        id: "issue-intro-black",
        type: "black_frame",
        titleEn: "Opening Black Screen Detected",
        titleKa: "\u10E1\u10D0\u10EC\u10E7\u10D8\u10E1\u10D8 \u10E8\u10D0\u10D5\u10D8 \u10D9\u10D0\u10D3\u10E0\u10D8",
        descriptionEn: "A dark/black frame was detected at the very beginning of the clip, likely due to a slow video decoder wake-up or transition lag.",
        descriptionKa: "\u10D5\u10D8\u10D3\u10D4\u10DD\u10E1 \u10D3\u10D0\u10E1\u10D0\u10EC\u10E7\u10D8\u10E1\u10E8\u10D8 \u10D3\u10D0\u10E4\u10D8\u10E5\u10E1\u10D8\u10E0\u10D3\u10D0 \u10E8\u10D0\u10D5\u10D8 \u10D9\u10D0\u10D3\u10E0\u10D8, \u10E0\u10D0\u10EA \u10D2\u10D0\u10DB\u10DD\u10EC\u10D5\u10D4\u10E3\u10DA\u10D8\u10D0 \u10DC\u10D4\u10DA\u10D8 \u10E9\u10D0\u10E2\u10D5\u10D8\u10E0\u10D7\u10D5\u10D8\u10D7 \u10D0\u10DC \u10EA\u10D0\u10E0\u10D8\u10D4\u10DA\u10D8 \u10D2\u10D0\u10D3\u10D0\u10E1\u10D5\u10DA\u10D8\u10D7.",
        suggestedActionEn: "Remove the initial 0.5 seconds of black frames to start the clip instantly.",
        suggestedActionKa: "\u10DB\u10DD\u10ED\u10D4\u10E0\u10D8\u10D7 \u10E1\u10D0\u10EC\u10E7\u10D8\u10E1\u10D8 0.5 \u10EC\u10D0\u10DB\u10D8 \u10E8\u10D0\u10D5\u10D8 \u10D9\u10D0\u10D3\u10E0\u10D4\u10D1\u10D8\u10E1 \u10DB\u10DD\u10E1\u10D0\u10E8\u10DD\u10E0\u10D4\u10D1\u10DA\u10D0\u10D3 \u10D3\u10D0 \u10DB\u10E7\u10D8\u10E1\u10D8\u10D4\u10E0\u10D8 \u10E1\u10E2\u10D0\u10E0\u10E2\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.",
        startSec: 0,
        endSec: 0.5
      });
    }
    if (duration > 5) {
      issues.push({
        id: "issue-silence-gap",
        type: "silence",
        titleEn: "Trailing Audio Silence",
        titleKa: "\u10D3\u10D0\u10E1\u10D0\u10E1\u10E0\u10E3\u10DA\u10D8\u10E1 \u10D0\u10E3\u10D3\u10D8\u10DD \u10E1\u10D8\u10EA\u10D0\u10E0\u10D8\u10D4\u10DA\u10D4",
        descriptionEn: "Detected a substantial drop in audio level near the end of the clip, causing a dead silent transition.",
        descriptionKa: "\u10D9\u10DA\u10D8\u10DE\u10D8\u10E1 \u10D3\u10D0\u10E1\u10D0\u10E1\u10E0\u10E3\u10DA\u10E1 \u10D3\u10D0\u10E4\u10D8\u10E5\u10E1\u10D8\u10E0\u10D3\u10D0 \u10D0\u10E3\u10D3\u10D8\u10DD \u10D3\u10DD\u10DC\u10D8\u10E1 \u10DB\u10D9\u10D5\u10D4\u10D7\u10E0\u10D8 \u10D5\u10D0\u10E0\u10D3\u10DC\u10D0, \u10E0\u10D0\u10EA \u10E5\u10DB\u10DC\u10D8\u10E1 \u10EA\u10D0\u10E0\u10D8\u10D4\u10DA \u10E1\u10D8\u10E9\u10E3\u10DB\u10D4\u10E1.",
        suggestedActionEn: `Trim the last ${(duration * 0.15).toFixed(1)} seconds of silence for a cleaner loop.`,
        suggestedActionKa: `\u10DB\u10DD\u10ED\u10D4\u10E0\u10D8\u10D7 \u10D1\u10DD\u10DA\u10DD ${(duration * 0.15).toFixed(1)} \u10EC\u10D0\u10DB\u10D8 \u10E1\u10D8\u10E9\u10E3\u10DB\u10D4 \u10E3\u10E4\u10E0\u10DD \u10E1\u10E3\u10E4\u10D7\u10D0 \u10DA\u10E3\u10DE\u10D8\u10E1\u10D7\u10D5\u10D8\u10E1.`,
        startSec: Math.max(0, parseFloat((duration * 0.85).toFixed(1))),
        endSec: duration
      });
    }
    if (issues.length === 0) {
      issues.push({
        id: "issue-generic-stabilization",
        type: "shaky_cam",
        titleEn: "Camera Jitter at Midpoint",
        titleKa: "\u10D9\u10D0\u10DB\u10D4\u10E0\u10D8\u10E1 \u10D5\u10D8\u10D1\u10E0\u10D0\u10EA\u10D8\u10D0 \u10E8\u10E3\u10D0 \u10DC\u10D0\u10EC\u10D8\u10DA\u10E8\u10D8",
        descriptionEn: "Unstable camera movement detected which might cause visual fatigue or decrease reel retention.",
        descriptionKa: "\u10D3\u10D0\u10E4\u10D8\u10E5\u10E1\u10D8\u10E0\u10D3\u10D0 \u10D9\u10D0\u10DB\u10D4\u10E0\u10D8\u10E1 \u10D0\u10E0\u10D0\u10E1\u10E2\u10D0\u10D1\u10D8\u10DA\u10E3\u10E0\u10D8 \u10D5\u10D8\u10D1\u10E0\u10D0\u10EA\u10D8\u10D0, \u10E0\u10D0\u10DB\u10D0\u10EA \u10E8\u10D4\u10D8\u10EB\u10DA\u10D4\u10D1\u10D0 \u10E8\u10D4\u10D0\u10DB\u10EA\u10D8\u10E0\u10DD\u10E1 \u10D5\u10D8\u10D3\u10D4\u10DD\u10E1 \u10DC\u10D0\u10EE\u10D5\u10D8\u10E1 \u10D3\u10E0\u10DD.",
        suggestedActionEn: "Remove or apply stabilization between 2.0s and 3.5s.",
        suggestedActionKa: "\u10D0\u10DB\u10DD\u10ED\u10D4\u10E0\u10D8\u10D7 \u10D0\u10DC \u10D3\u10D0\u10D0\u10E1\u10E2\u10D0\u10D1\u10D8\u10DA\u10E3\u10E0\u10D4\u10D7 \u10DB\u10DD\u10DC\u10D0\u10D9\u10D5\u10D4\u10D7\u10D8 2.0-\u10D3\u10D0\u10DC 3.5 \u10EC\u10D0\u10DB\u10D0\u10DB\u10D3\u10D4.",
        startSec: 2,
        endSec: 3.5
      });
    }
    return issues;
  }
}

// src/lib/analyticsServer.ts
import crypto from "crypto";

// src/lib/listingClassification.ts
var PRODUCT_CATEGORY_IDS = [
  "newyear",
  "phones",
  "technics",
  "family-technic",
  "garden",
  "furniture",
  "hunting",
  "music",
  "kids",
  "fashion",
  "building",
  "village",
  "animals",
  "sport",
  "business",
  "book",
  "art"
];
var SERVICE_CATEGORY_IDS = [
  "service",
  "rent",
  "audience-growth"
];
var PROJECT_ASSET_CATEGORY_IDS = [
  "social-accounts",
  "youtube-channels",
  "digital-projects"
];
var JOB_CATEGORY_IDS = [
  "project-jobs"
];
var COLLABORATION_CATEGORY_IDS = [
  "collaboration"
];
var PROJECT_CATEGORY_IDS = [
  "project-jobs",
  "social-accounts",
  "youtube-channels",
  "collaboration",
  "digital-projects"
];
var ALL_ACTIVE_CATEGORY_IDS = [
  ...PRODUCT_CATEGORY_IDS,
  ...SERVICE_CATEGORY_IDS,
  ...PROJECT_CATEGORY_IDS
];
var PRODUCT_CATEGORY_SET = new Set(PRODUCT_CATEGORY_IDS);
var SERVICE_CATEGORY_SET = new Set(SERVICE_CATEGORY_IDS);
var PROJECT_ASSET_CATEGORY_SET = new Set(PROJECT_ASSET_CATEGORY_IDS);
var JOB_CATEGORY_SET = new Set(JOB_CATEGORY_IDS);
var COLLABORATION_CATEGORY_SET = new Set(COLLABORATION_CATEGORY_IDS);
var PROJECT_CATEGORY_SET = new Set(PROJECT_CATEGORY_IDS);
var normalizeCategoryId = (category) => typeof category === "string" ? category.trim().toLowerCase() : "";
var normalizeExplicitListingType = (listingType) => {
  if (typeof listingType !== "string") return null;
  const normalized = listingType.trim().toLowerCase();
  if (normalized === "product" || normalized === "service" || normalized === "project") {
    return normalized;
  }
  return null;
};
var classifyListing = (item) => {
  if (!item) return null;
  const cat = normalizeCategoryId(item.category);
  const explicit = normalizeExplicitListingType(item.listingType);
  if (SERVICE_CATEGORY_SET.has(cat) || cat === "services") {
    return "service";
  }
  if (PROJECT_ASSET_CATEGORY_SET.has(cat)) {
    return "project_asset";
  }
  if (JOB_CATEGORY_SET.has(cat)) {
    return "job";
  }
  if (COLLABORATION_CATEGORY_SET.has(cat)) {
    return "collaboration";
  }
  if (explicit === "service") return "service";
  if (explicit === "project") return "project";
  if (explicit === "product") return "product";
  if (cat === "project" || PROJECT_CATEGORY_SET.has(cat)) return "project";
  return "product";
};
var inferListingType = (category, explicitListingType) => {
  const classification = classifyListing({ category, listingType: explicitListingType });
  if (classification === "service") return "service";
  if (classification === "project_asset" || classification === "job" || classification === "collaboration" || classification === "project") {
    return "project";
  }
  return "product";
};

// src/lib/marketAnalyticsUtils.ts
var BOT_USER_AGENT_PATTERN = /bot|crawler|spider|slurp|mediapartners|headless|puppeteer|playwright|selenium|phantom|curl|wget|python-requests|httpclient|axios\/|node-fetch|postman|insomnia|scrapy|lighthouse|pingdom|uptimerobot/i;
var IMPRESSION_COOLDOWN_MS = 10 * 60 * 1e3;
var VIEW_COOLDOWN_MS = 5 * 60 * 1e3;
function isBotUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== "string") return true;
  const trimmed = userAgent.trim();
  if (trimmed.length < 8) return true;
  return BOT_USER_AGENT_PATTERN.test(trimmed);
}
function isValidAnalyticsId(id) {
  return typeof id === "string" && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}
function getHourBucketKey(tsMs) {
  const d = new Date(tsMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hour = String(d.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}`;
}
function getDayBucketKey(tsMs) {
  const d = new Date(tsMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function sanitizeBucketCounter(v) {
  const bucket = {
    impressions: Number(v.impressions) || 0,
    views: Number(v.views) || 0,
    uniqueViewers: Number(v.uniqueViewers) || 0
  };
  if (typeof v.authImpressions === "number" || typeof v.authViews === "number" || typeof v.authUniqueViewers === "number" || typeof v.guestImpressions === "number" || typeof v.guestViews === "number" || typeof v.guestUniqueViewers === "number") {
    bucket.authImpressions = Number(v.authImpressions) || 0;
    bucket.authViews = Number(v.authViews) || 0;
    bucket.authUniqueViewers = Number(v.authUniqueViewers) || 0;
    bucket.guestImpressions = Number(v.guestImpressions) || 0;
    bucket.guestViews = Number(v.guestViews) || 0;
    bucket.guestUniqueViewers = Number(v.guestUniqueViewers) || 0;
  }
  return bucket;
}
function pruneHourlyBuckets(hourly, nowMs) {
  const result = {};
  if (!hourly || typeof hourly !== "object") return result;
  const minTs = nowMs - 52 * 60 * 60 * 1e3;
  const minKey = getHourBucketKey(minTs);
  for (const [k, v] of Object.entries(hourly)) {
    if (k >= minKey && v && typeof v === "object") {
      result[k] = sanitizeBucketCounter(v);
    }
  }
  return result;
}
function pruneDailyBuckets(daily, nowMs) {
  const result = {};
  if (!daily || typeof daily !== "object") return result;
  const minTs = nowMs - 62 * 24 * 60 * 60 * 1e3;
  const minKey = getDayBucketKey(minTs);
  for (const [k, v] of Object.entries(daily)) {
    if (k >= minKey && v && typeof v === "object") {
      result[k] = sanitizeBucketCounter(v);
    }
  }
  return result;
}
function computeEngagementRate(views, impressions) {
  if (!Number.isFinite(views) || !Number.isFinite(impressions) || views <= 0 || impressions <= 0) {
    return 0;
  }
  const raw = views / impressions * 100;
  return Math.min(100, Math.round(raw * 10) / 10);
}
function sumBucketKeys(buckets, keys) {
  let impressions = 0;
  let views = 0;
  let uniqueViewers = 0;
  if (buckets) {
    for (const key of keys) {
      const b = buckets[key];
      if (b) {
        impressions += Number(b.impressions) || 0;
        views += Number(b.views) || 0;
        uniqueViewers += Number(b.uniqueViewers) || 0;
      }
    }
  }
  return {
    impressions,
    views,
    uniqueViewers,
    engagementRate: computeEngagementRate(views, impressions)
  };
}
function computeComparison(curr, prev) {
  const pct = (c, p) => {
    if (p <= 0) return c > 0 ? 100 : null;
    return Math.round((c - p) / p * 1e3) / 10;
  };
  return {
    impressionsDelta: curr.impressions - prev.impressions,
    viewsDelta: curr.views - prev.views,
    uniqueViewersDelta: curr.uniqueViewers - prev.uniqueViewers,
    engagementRateDelta: Math.round((curr.engagementRate - prev.engagementRate) * 10) / 10,
    impressionsChangePct: pct(curr.impressions, prev.impressions),
    viewsChangePct: pct(curr.views, prev.views),
    uniqueViewersChangePct: pct(curr.uniqueViewers, prev.uniqueViewers)
  };
}
function buildHourWindowKeys(nowMs, offsetHoursStart, count) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.push(getHourBucketKey(nowMs - (offsetHoursStart + i) * 60 * 60 * 1e3));
  }
  return keys;
}
function buildDayWindowKeys(nowMs, offsetDaysStart, count) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.push(getDayBucketKey(nowMs - (offsetDaysStart + i) * 24 * 60 * 60 * 1e3));
  }
  return keys;
}
function aggregatePeriodFromBuckets(docData, nowMs = Date.now()) {
  const h24Keys = buildHourWindowKeys(nowMs, 0, 24);
  const prevH24Keys = buildHourWindowKeys(nowMs, 24, 24);
  const d7Keys = buildDayWindowKeys(nowMs, 0, 7);
  const prevD7Keys = buildDayWindowKeys(nowMs, 7, 7);
  const d30Keys = buildDayWindowKeys(nowMs, 0, 30);
  const prevD30Keys = buildDayWindowKeys(nowMs, 30, 30);
  const m24h = sumBucketKeys(docData.hourly, h24Keys);
  const prev24h = sumBucketKeys(docData.hourly, prevH24Keys);
  const m7d = sumBucketKeys(docData.daily, d7Keys);
  const prev7d = sumBucketKeys(docData.daily, prevD7Keys);
  const m30d = sumBucketKeys(docData.daily, d30Keys);
  const prev30d = sumBucketKeys(docData.daily, prevD30Keys);
  const totalImpressions = Number(docData.impressions) || 0;
  const totalViews = Number(docData.views) || 0;
  const totalUniqueViewers = Number(docData.uniqueViewers) || 0;
  const mAll = {
    impressions: totalImpressions,
    views: totalViews,
    uniqueViewers: totalUniqueViewers,
    engagementRate: computeEngagementRate(totalViews, totalImpressions)
  };
  return {
    periods: {
      "24h": m24h,
      "7d": m7d,
      "30d": m30d,
      "all": mAll
    },
    comparisons: {
      "24h": computeComparison(m24h, prev24h),
      "7d": computeComparison(m7d, prev7d),
      "30d": computeComparison(m30d, prev30d)
    },
    prevPeriods: {
      "24h": prev24h,
      "7d": prev7d,
      "30d": prev30d
    }
  };
}
function sumPeriodMetricsList(list) {
  let impressions = 0;
  let views = 0;
  let uniqueViewers = 0;
  for (const item of list) {
    impressions += item.impressions || 0;
    views += item.views || 0;
    uniqueViewers += item.uniqueViewers || 0;
  }
  return {
    impressions,
    views,
    uniqueViewers,
    engagementRate: computeEngagementRate(views, impressions)
  };
}
function createZeroViewerSegmentMetrics() {
  return {
    authImpressions: 0,
    authViews: 0,
    authUniqueViewers: 0,
    guestImpressions: 0,
    guestViews: 0,
    guestUniqueViewers: 0
  };
}
function sumViewerBreakdownBuckets(buckets, keys) {
  const totals = createZeroViewerSegmentMetrics();
  if (!buckets) return totals;
  for (const key of keys) {
    const b = buckets[key];
    if (!b) continue;
    totals.authImpressions += Number(b.authImpressions) || 0;
    totals.authViews += Number(b.authViews) || 0;
    totals.authUniqueViewers += Number(b.authUniqueViewers) || 0;
    totals.guestImpressions += Number(b.guestImpressions) || 0;
    totals.guestViews += Number(b.guestViews) || 0;
    totals.guestUniqueViewers += Number(b.guestUniqueViewers) || 0;
  }
  return totals;
}
function hasRecordedViewerBreakdown(docData) {
  if (!docData) return false;
  if (typeof docData.breakdownSince === "number" && Number.isFinite(docData.breakdownSince)) {
    return true;
  }
  return typeof docData.authImpressions === "number" || typeof docData.authViews === "number" || typeof docData.authUniqueViewers === "number" || typeof docData.guestImpressions === "number" || typeof docData.guestViews === "number" || typeof docData.guestUniqueViewers === "number";
}
function aggregateViewerBreakdownFromDoc(docData, nowMs = Date.now()) {
  if (!hasRecordedViewerBreakdown(docData)) {
    return void 0;
  }
  const h24Keys = buildHourWindowKeys(nowMs, 0, 24);
  const d7Keys = buildDayWindowKeys(nowMs, 0, 7);
  const d30Keys = buildDayWindowKeys(nowMs, 0, 30);
  return {
    ...typeof docData?.breakdownSince === "number" && Number.isFinite(docData.breakdownSince) ? { breakdownSince: docData.breakdownSince } : {},
    periods: {
      "24h": sumViewerBreakdownBuckets(docData?.hourly, h24Keys),
      "7d": sumViewerBreakdownBuckets(docData?.daily, d7Keys),
      "30d": sumViewerBreakdownBuckets(docData?.daily, d30Keys),
      all: {
        authImpressions: Number(docData?.authImpressions) || 0,
        authViews: Number(docData?.authViews) || 0,
        authUniqueViewers: Number(docData?.authUniqueViewers) || 0,
        guestImpressions: Number(docData?.guestImpressions) || 0,
        guestViews: Number(docData?.guestViews) || 0,
        guestUniqueViewers: Number(docData?.guestUniqueViewers) || 0
      }
    }
  };
}
function sumViewerBreakdownList(breakdowns) {
  const valid = breakdowns.filter((b) => Boolean(b));
  if (valid.length === 0) return void 0;
  const periodKeys = ["24h", "7d", "30d", "all"];
  const periods = {};
  for (const pk of periodKeys) {
    const sum = createZeroViewerSegmentMetrics();
    for (const item of valid) {
      const m = item.periods[pk];
      if (!m) continue;
      sum.authImpressions += m.authImpressions || 0;
      sum.authViews += m.authViews || 0;
      sum.authUniqueViewers += m.authUniqueViewers || 0;
      sum.guestImpressions += m.guestImpressions || 0;
      sum.guestViews += m.guestViews || 0;
      sum.guestUniqueViewers += m.guestUniqueViewers || 0;
    }
    periods[pk] = sum;
  }
  const sinceCandidates = valid.map((b) => b.breakdownSince).filter((v) => typeof v === "number" && Number.isFinite(v));
  return {
    ...sinceCandidates.length > 0 ? { breakdownSince: Math.min(...sinceCandidates) } : {},
    periods
  };
}
var COUNTRY_NAME_TO_CODE = {
  GE: "GEO",
  GEO: "GEO",
  GEORGIA: "GEO",
  "\u10E1\u10D0\u10E5\u10D0\u10E0\u10D7\u10D5\u10D4\u10DA\u10DD": "GEO",
  US: "USA",
  USA: "USA",
  "UNITED STATES": "USA",
  DE: "DEU",
  DEU: "DEU",
  GERMANY: "DEU",
  CN: "CHN",
  CHN: "CHN",
  CHINA: "CHN",
  JP: "JPN",
  JPN: "JPN",
  JAPAN: "JPN",
  GB: "GBR",
  UK: "GBR",
  GBR: "GBR",
  "UNITED KINGDOM": "GBR",
  FR: "FRA",
  FRA: "FRA",
  FRANCE: "FRA",
  EE: "EST",
  EST: "EST",
  ESTONIA: "EST",
  IL: "ISR",
  ISR: "ISR",
  ISRAEL: "ISR",
  SG: "SGP",
  SGP: "SGP",
  SINGAPORE: "SGP",
  AE: "VAE",
  UAE: "VAE",
  VAE: "VAE"
};
function normalizeCountryCode(raw) {
  if (!raw || typeof raw !== "string") return void 0;
  const trimmed = raw.trim();
  if (!trimmed) return void 0;
  const upper = trimmed.toUpperCase();
  if (upper === "GLOBAL" || upper === "WORLDWIDE" || upper === "ONLINE" || upper === "REMOTE") {
    return void 0;
  }
  if (COUNTRY_NAME_TO_CODE[upper]) {
    return COUNTRY_NAME_TO_CODE[upper];
  }
  if (/^[A-Z]{2,3}$/.test(upper)) {
    return upper;
  }
  return void 0;
}
function resolveReliableSellerLocation(params) {
  let country = normalizeCountryCode(params.profileCountry);
  let region;
  const rawProfileRegion = typeof params.profileRegion === "string" ? params.profileRegion.trim() : "";
  if (rawProfileRegion && rawProfileRegion.toLowerCase() !== "global" && rawProfileRegion.toLowerCase() !== "online") {
    const parts = rawProfileRegion.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const maybeCountry = normalizeCountryCode(parts[parts.length - 1]);
      if (maybeCountry && !country) {
        country = maybeCountry;
      }
      region = parts.slice(0, -1).join(", ");
    } else {
      region = rawProfileRegion;
    }
  }
  if (!country) {
    country = normalizeCountryCode(params.listingCountry);
  }
  if (!region && typeof params.listingCity === "string") {
    const cityTrimmed = params.listingCity.trim();
    if (cityTrimmed && cityTrimmed.toLowerCase() !== "online" && cityTrimmed.toLowerCase() !== "remote" && cityTrimmed.toLowerCase() !== "global") {
      region = cityTrimmed;
    }
  }
  return { country, region };
}
function computeBalancedScore(input) {
  const {
    impressions,
    views,
    uniqueViewers,
    categoryBaseline,
    sellerRatingAvg = 0,
    sellerRatingCount = 0,
    listingCreatedAt,
    nowMs = Date.now()
  } = input;
  if (views <= 0 && impressions <= 0) {
    return {
      engagementRate: 0,
      categoryNormalizedScore: 0,
      freshnessBoost: 0,
      balancedScore: 0
    };
  }
  const engagementRate = computeEngagementRate(views, impressions);
  const smoothedEngagement = views / Math.max(impressions + 10, views + 10, 1);
  const uniqueComponent = Math.log1p(Math.max(0, uniqueViewers)) * 28;
  const viewsComponent = Math.log1p(Math.max(0, views)) * 8;
  const engagementComponent = smoothedEngagement * 35;
  const safeBaseline = Math.max(1, categoryBaseline);
  const rawDemand = uniqueViewers + views * 0.35;
  const categoryRatio = rawDemand / safeBaseline;
  const categoryNormalizedScore = Math.round(Math.log1p(categoryRatio) * 18 * 100) / 100;
  const reviewComponent = sellerRatingCount > 0 && sellerRatingAvg > 0 ? Math.min(5, sellerRatingAvg) / 5 * Math.min(sellerRatingCount, 10) * 1.2 : 0;
  let freshnessBoost = 0;
  if (listingCreatedAt && Number.isFinite(listingCreatedAt) && listingCreatedAt > 0) {
    const ageDays = Math.max(0, (nowMs - listingCreatedAt) / (24 * 60 * 60 * 1e3));
    if (ageDays <= 14) {
      freshnessBoost = Math.round((1 - ageDays / 14) * 12 * 100) / 100;
    }
  }
  const balancedScore = Math.round(
    (uniqueComponent + viewsComponent + engagementComponent + categoryNormalizedScore + reviewComponent + freshnessBoost) * 100
  ) / 100;
  return {
    engagementRate,
    categoryNormalizedScore,
    freshnessBoost,
    balancedScore
  };
}
function computeListingAchievements(params) {
  const badges = [];
  const {
    curr7d,
    prev7d,
    curr30d,
    listingCreatedAt,
    nowMs = Date.now(),
    categoryRank,
    categoryTotal = 0,
    globalRank
  } = params;
  const ageDays = listingCreatedAt && Number.isFinite(listingCreatedAt) && listingCreatedAt > 0 ? Math.max(0, (nowMs - listingCreatedAt) / (24 * 60 * 60 * 1e3)) : 999;
  if (curr7d.uniqueViewers >= 5 && prev7d.uniqueViewers > 0 && (curr7d.uniqueViewers - prev7d.uniqueViewers) / prev7d.uniqueViewers >= 0.5 || ageDays <= 14 && curr7d.uniqueViewers >= 5 && curr7d.engagementRate >= 8) {
    badges.push("rising_listing");
  }
  if (curr30d.uniqueViewers >= 25 && curr30d.views >= 35) {
    badges.push("popular_listing");
  }
  if (typeof categoryRank === "number" && (categoryRank === 1 && curr7d.uniqueViewers >= 5 || categoryRank <= 3 && categoryTotal >= 10 && curr30d.uniqueViewers >= 10)) {
    badges.push("top_in_category");
  }
  if (typeof globalRank === "number" && globalRank <= 10 && curr30d.uniqueViewers >= 20 && curr30d.engagementRate >= 5) {
    badges.push("global_recognition");
  }
  return badges;
}
function normalizeListingTypeFilter(raw) {
  if (typeof raw !== "string") return "all";
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "product" || trimmed === "service" || trimmed === "project") {
    return trimmed;
  }
  return "all";
}
function buildRankingsFromPublicDocs(params) {
  const {
    docs,
    sellerRatingsMap,
    scope,
    period,
    listingType,
    category,
    country,
    region,
    nowMs = Date.now(),
    limitCount = 50
  } = params;
  const eligible = docs.filter((d) => !d.optedOut && (!d.status || d.status === "active")).map((d) => {
    const agg = aggregatePeriodFromBuckets(d, nowMs);
    const periodMetrics = agg.periods[period];
    const normalizedType = inferListingType(d.category, d.listingType);
    return {
      doc: d,
      normalizedType,
      agg,
      periodMetrics
    };
  }).filter((item) => item.periodMetrics.views > 0 || item.periodMetrics.impressions > 0);
  if (eligible.length === 0) return [];
  const categoryDemands = /* @__PURE__ */ new Map();
  for (const item of eligible) {
    const cat = (item.doc.category || "other").toLowerCase();
    const arr = categoryDemands.get(cat) || [];
    arr.push(item.periodMetrics.uniqueViewers + item.periodMetrics.views * 0.35);
    categoryDemands.set(cat, arr);
  }
  const categoryBaselines = /* @__PURE__ */ new Map();
  for (const [cat, vals] of categoryDemands.entries()) {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    categoryBaselines.set(cat, Math.max(1, median));
  }
  const scoredAll = eligible.map((item) => {
    const cat = (item.doc.category || "other").toLowerCase();
    const baseline = categoryBaselines.get(cat) || 1;
    const rating = sellerRatingsMap[item.doc.sellerId];
    const scoreData = computeBalancedScore({
      impressions: item.periodMetrics.impressions,
      views: item.periodMetrics.views,
      uniqueViewers: item.periodMetrics.uniqueViewers,
      categoryBaseline: baseline,
      sellerRatingAvg: rating?.avg || 0,
      sellerRatingCount: rating?.count || 0,
      listingCreatedAt: item.doc.listingCreatedAt || item.doc.createdAt,
      nowMs
    });
    return {
      ...item,
      rating,
      scoreData
    };
  });
  scoredAll.sort((a, b) => {
    if (b.scoreData.balancedScore !== a.scoreData.balancedScore) {
      return b.scoreData.balancedScore - a.scoreData.balancedScore;
    }
    return b.periodMetrics.uniqueViewers - a.periodMetrics.uniqueViewers;
  });
  const globalRankMap = /* @__PURE__ */ new Map();
  const categoryLists = /* @__PURE__ */ new Map();
  scoredAll.forEach((entry, idx) => {
    globalRankMap.set(entry.doc.listingId, idx + 1);
    const cat = (entry.doc.category || "other").toLowerCase();
    const list = categoryLists.get(cat) || [];
    list.push(entry);
    categoryLists.set(cat, list);
  });
  const categoryRankMap = /* @__PURE__ */ new Map();
  for (const list of categoryLists.values()) {
    list.forEach((entry, idx) => {
      categoryRankMap.set(entry.doc.listingId, { rank: idx + 1, total: list.length });
    });
  }
  const normCountryFilter = normalizeCountryCode(country);
  const normRegionFilter = region ? region.trim().toLowerCase() : "";
  const normCategoryFilter = category && category !== "all" ? category.trim().toLowerCase() : "";
  const normListingTypeFilter = normalizeListingTypeFilter(listingType);
  const scoped = scoredAll.filter((entry) => {
    if (normListingTypeFilter !== "all" && entry.normalizedType !== normListingTypeFilter) {
      return false;
    }
    if (scope === "country") {
      if (!entry.doc.country) return false;
      if (normCountryFilter && entry.doc.country.toUpperCase() !== normCountryFilter) return false;
      return true;
    }
    if (scope === "regional") {
      if (!entry.doc.region) return false;
      if (normRegionFilter && !entry.doc.region.toLowerCase().includes(normRegionFilter)) return false;
      return true;
    }
    if (scope === "category") {
      if (!normCategoryFilter) return true;
      return (entry.doc.category || "").toLowerCase() === normCategoryFilter;
    }
    return true;
  });
  return scoped.slice(0, limitCount).map((entry, idx) => {
    const catInfo = categoryRankMap.get(entry.doc.listingId);
    const globalRank = globalRankMap.get(entry.doc.listingId);
    const achievements = computeListingAchievements({
      curr7d: entry.agg.periods["7d"],
      prev7d: entry.agg.prevPeriods["7d"],
      curr30d: entry.agg.periods["30d"],
      listingCreatedAt: entry.doc.listingCreatedAt || entry.doc.createdAt,
      nowMs,
      categoryRank: catInfo?.rank,
      categoryTotal: catInfo?.total,
      globalRank
    });
    return {
      rank: idx + 1,
      listingId: entry.doc.listingId,
      title: entry.doc.title,
      titleGe: entry.doc.titleGe,
      category: entry.doc.category,
      listingType: entry.normalizedType,
      image: entry.doc.image,
      sellerName: entry.doc.sellerName || "Proton Vendor",
      country: entry.doc.country,
      region: entry.doc.region,
      impressions: entry.periodMetrics.impressions,
      views: entry.periodMetrics.views,
      uniqueViewers: entry.periodMetrics.uniqueViewers,
      engagementRate: entry.scoreData.engagementRate,
      categoryNormalizedScore: entry.scoreData.categoryNormalizedScore,
      sellerRatingAvg: entry.rating?.avg,
      sellerRatingCount: entry.rating?.count,
      freshnessBoost: entry.scoreData.freshnessBoost,
      balancedScore: entry.scoreData.balancedScore,
      achievements,
      period
    };
  });
}
var GUEST_SESSION_MAX_LISTING_IDS = 50;
var GUEST_SESSION_MAX_SELLER_IDS = 30;
var GUEST_SESSION_TTL_DAYS = 30;
var GUEST_SESSION_TTL_MS = GUEST_SESSION_TTL_DAYS * 24 * 60 * 60 * 1e3;
var SELLER_ANALYTICS_SCHEMA_VERSION = 1;
function isValidHmacDigest(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function createEmptySellerAudienceCounters() {
  return {
    totalImpressions: 0,
    totalViews: 0,
    uniqueViewers: 0,
    authImpressions: 0,
    authViews: 0,
    authUniqueViewers: 0,
    guestImpressions: 0,
    guestViews: 0,
    guestUniqueViewers: 0
  };
}
function createEmptySellerAnalyticsTotalCounters() {
  return {
    totalEvents: 0,
    totalUniqueUsers: 0,
    authEvents: 0,
    guestEvents: 0,
    authUniqueUsers: 0,
    guestUniqueUsers: 0
  };
}
function createEmptySellerAnalyticsDoc(params) {
  const nowMs = params.nowMs ?? Date.now();
  return {
    sellerId: params.sellerId,
    metadata: {
      schemaVersion: SELLER_ANALYTICS_SCHEMA_VERSION,
      ...params.sellerName ? { sellerName: params.sellerName } : {}
    },
    optedOut: Boolean(params.optedOut),
    ...params.country ? { country: params.country } : {},
    ...params.region ? { region: params.region } : {},
    funnelTrackingSince: nowMs,
    audience: createEmptySellerAudienceCounters(),
    totals: createEmptySellerAnalyticsTotalCounters(),
    profileViews: 0,
    uniqueProfileViewers: 0,
    authProfileViews: 0,
    guestProfileViews: 0,
    authUniqueProfileViewers: 0,
    guestUniqueProfileViewers: 0,
    listingToSellerClicks: 0,
    uniqueListingToSellerUsers: 0,
    authListingToSellerClicks: 0,
    guestListingToSellerClicks: 0,
    contactClicks: 0,
    uniqueContactClickers: 0,
    authContactClicks: 0,
    guestContactClicks: 0,
    authUniqueContactClickers: 0,
    guestUniqueContactClickers: 0,
    orderIntents: 0,
    uniqueOrderIntentUsers: 0,
    authOrderIntents: 0,
    guestOrderIntents: 0,
    authUniqueOrderIntentUsers: 0,
    guestUniqueOrderIntentUsers: 0,
    contactConfirmed: 0,
    uniqueContactedBuyers: 0,
    ordersConfirmed: 0,
    uniqueOrderBuyers: 0,
    guestToAuthLinks: 0,
    hourly: {},
    daily: {},
    createdAt: nowMs,
    updatedAt: nowMs
  };
}
var SELLER_VIEWER_TIMESTAMP_FIELDS = [
  "firstSeenAt",
  "lastSeenAt",
  "firstProfileViewAt",
  "lastProfileViewAt",
  "firstListingToSellerAt",
  "lastListingToSellerAt",
  "firstContactClickAt",
  "lastContactClickAt",
  "firstOrderIntentAt",
  "lastOrderIntentAt",
  "firstContactConfirmedAt",
  "firstOrderConfirmedAt",
  "firstAudienceAt",
  "lastAudienceAt"
];
function sanitizeSellerViewerDoc(input) {
  if (!isValidHmacDigest(input?.viewerHash)) {
    throw new Error("Invalid HMAC viewerHash for seller viewer storage");
  }
  const viewerType = input.viewerType === "auth" ? "auth" : "guest";
  const nowFallback = typeof input.lastSeenAt === "number" && Number.isFinite(input.lastSeenAt) ? input.lastSeenAt : Date.now();
  const firstSeenAt = typeof input.firstSeenAt === "number" && Number.isFinite(input.firstSeenAt) ? input.firstSeenAt : nowFallback;
  const clean = {
    viewerHash: input.viewerHash,
    viewerType,
    firstSeenAt,
    lastSeenAt: nowFallback
  };
  for (const field of SELLER_VIEWER_TIMESTAMP_FIELDS) {
    if (field === "firstSeenAt" || field === "lastSeenAt") continue;
    const rawVal = input[field];
    if (typeof rawVal === "number" && Number.isFinite(rawVal) && rawVal > 0) {
      clean[field] = rawVal;
    }
  }
  return clean;
}
function normalizeBoundedUniqueIdList(existing, addition, maxLimit) {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  if (Array.isArray(existing)) {
    for (const item of existing) {
      if (isValidAnalyticsId(item) && !seen.has(item)) {
        seen.add(item);
        result.push(item);
        if (result.length >= maxLimit) return result;
      }
    }
  }
  if (isValidAnalyticsId(addition) && !seen.has(addition) && result.length < maxLimit) {
    result.push(addition);
  }
  return result;
}
function isGuestSessionExpired(doc, nowMs) {
  if (!doc) return true;
  if (typeof doc.expiresAt !== "number" || !Number.isFinite(doc.expiresAt)) return true;
  return doc.expiresAt <= nowMs;
}
function mergeGuestSessionActivity(existingDoc, params) {
  if (!isValidHmacDigest(params.guestHash)) {
    throw new Error("Invalid HMAC guestHash");
  }
  const nowMs = params.nowMs ?? Date.now();
  const activeExisting = existingDoc && !isGuestSessionExpired(existingDoc, nowMs) ? existingDoc : null;
  const listingIds = normalizeBoundedUniqueIdList(
    activeExisting?.listingIds,
    params.listingId,
    GUEST_SESSION_MAX_LISTING_IDS
  );
  const sellerIds = normalizeBoundedUniqueIdList(
    activeExisting?.sellerIds,
    params.sellerId,
    GUEST_SESSION_MAX_SELLER_IDS
  );
  return {
    guestHash: params.guestHash,
    listingIds,
    sellerIds,
    linkedUid: activeExisting?.linkedUid ?? null,
    createdAt: activeExisting?.createdAt ?? nowMs,
    updatedAt: nowMs,
    linkedAt: activeExisting?.linkedAt ?? null,
    expiresAt: nowMs + GUEST_SESSION_TTL_MS
  };
}
function evaluateGuestSessionClaim(existingDoc, params) {
  const nowMs = params.nowMs ?? Date.now();
  if (!isValidAnalyticsId(params.uid)) {
    return { status: 400, claimed: false, reason: "invalid_request" };
  }
  if (!existingDoc || isGuestSessionExpired(existingDoc, nowMs)) {
    return { status: 200, claimed: false, reason: "no_guest_session" };
  }
  const boundedListingIds = normalizeBoundedUniqueIdList(
    existingDoc.listingIds,
    void 0,
    GUEST_SESSION_MAX_LISTING_IDS
  );
  const boundedSellerIds = normalizeBoundedUniqueIdList(
    existingDoc.sellerIds,
    void 0,
    GUEST_SESSION_MAX_SELLER_IDS
  );
  if (existingDoc.linkedUid) {
    if (existingDoc.linkedUid === params.uid) {
      return {
        status: 200,
        claimed: true,
        idempotent: true,
        linkedUid: existingDoc.linkedUid,
        listingIds: boundedListingIds,
        sellerIds: boundedSellerIds
      };
    }
    return {
      status: 409,
      claimed: false,
      reason: "visitor_already_claimed"
    };
  }
  if (boundedListingIds.length === 0 && boundedSellerIds.length === 0) {
    return { status: 200, claimed: false, reason: "no_guest_session" };
  }
  const nextDoc = {
    guestHash: existingDoc.guestHash,
    listingIds: boundedListingIds,
    sellerIds: boundedSellerIds,
    linkedUid: params.uid,
    createdAt: existingDoc.createdAt,
    updatedAt: nowMs,
    linkedAt: nowMs,
    expiresAt: existingDoc.expiresAt
  };
  return {
    status: 200,
    claimed: true,
    idempotent: false,
    linkedUid: params.uid,
    listingIds: boundedListingIds,
    sellerIds: boundedSellerIds,
    nextDoc
  };
}
function buildVerifiedFunnelMarkerId(markerType, sourceId) {
  if (!isValidAnalyticsId(sourceId)) {
    throw new Error("Invalid sourceId for verified funnel marker");
  }
  const prefix = markerType === "order_confirmed" ? "order_" : "contact_";
  const markerId = `${prefix}${sourceId}`;
  if (!isValidAnalyticsId(markerId)) {
    throw new Error("Verified funnel markerId exceeds 128 characters or contains invalid characters");
  }
  return markerId;
}

// src/lib/analyticsServer.ts
function parseTimestampMs(val) {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (val && typeof val.toMillis === "function") return val.toMillis();
  if (val && typeof val.seconds === "number") return val.seconds * 1e3;
  return Date.now();
}
var DEV_FALLBACK_ANALYTICS_SALT = "proton-market-analytics-v1-salt";
var MIN_ANALYTICS_SALT_LENGTH = 32;
var AnalyticsConfigError = class extends Error {
  code;
  statusCode;
  constructor(code, message, statusCode = 503) {
    super(message);
    this.name = "AnalyticsConfigError";
    this.code = code;
    this.statusCode = statusCode;
  }
};
function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}
function parseServiceAccountJson(rawSaJson) {
  let cleaned = rawSaJson.trim();
  if (cleaned.startsWith("'") && cleaned.endsWith("'") || cleaned.startsWith('"') && cleaned.endsWith('"')) {
    const inner = cleaned.slice(1, -1).trim();
    if (inner.startsWith("{")) {
      cleaned = inner;
    } else if (cleaned.startsWith('"')) {
      try {
        const unwrapped = JSON.parse(cleaned);
        if (typeof unwrapped === "string" && unwrapped.trim().startsWith("{")) {
          cleaned = unwrapped.trim();
        }
      } catch {
      }
    }
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AnalyticsConfigError(
      "analytics/admin-credentials-invalid",
      "Server Firebase Admin service account JSON is malformed."
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AnalyticsConfigError(
      "analytics/admin-credentials-invalid",
      "Server Firebase Admin service account JSON must be an object."
    );
  }
  if (typeof parsed.client_email !== "string" || !parsed.client_email.includes("@")) {
    throw new AnalyticsConfigError(
      "analytics/admin-credentials-invalid",
      "Server Firebase Admin service account JSON is missing a valid client_email."
    );
  }
  if (typeof parsed.private_key !== "string" || !parsed.private_key.trim()) {
    throw new AnalyticsConfigError(
      "analytics/admin-credentials-invalid",
      "Server Firebase Admin service account JSON is missing a valid private_key."
    );
  }
  const normalizedKey = parsed.private_key.replace(/\\n/g, "\n").trim();
  if (!normalizedKey.includes("-----BEGIN ") || !normalizedKey.includes("-----END ")) {
    throw new AnalyticsConfigError(
      "analytics/admin-credentials-invalid",
      "Server Firebase Admin private_key is not valid PEM format."
    );
  }
  return {
    ...parsed,
    private_key: `${normalizedKey}
`
  };
}
var cachedAdminFirestore = null;
async function getAdminFirestoreInstance() {
  if (cachedAdminFirestore) return cachedAdminFirestore;
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "proton-core-ai";
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51";
  const appName = "proton-analytics-admin";
  let app2 = getApps().find((a) => a.name === appName);
  if (!app2) {
    const rawSaJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (typeof rawSaJson === "string" && rawSaJson.trim().length > 0) {
      const parsed = parseServiceAccountJson(rawSaJson);
      try {
        app2 = initializeApp(
          {
            credential: cert({
              projectId: parsed.project_id || projectId,
              clientEmail: parsed.client_email,
              privateKey: parsed.private_key
            }),
            projectId: parsed.project_id || projectId
          },
          appName
        );
      } catch {
        console.error("[MarketAnalytics] Failed to initialize Firebase Admin credential from FIREBASE_SERVICE_ACCOUNT_JSON.");
        throw new AnalyticsConfigError(
          "analytics/admin-credentials-invalid",
          "Server Firebase Admin service account credential or private key is invalid."
        );
      }
    } else {
      app2 = initializeApp({ projectId }, appName);
    }
  }
  cachedAdminFirestore = getFirestore(app2, databaseId);
  return cachedAdminFirestore;
}
var DEFAULT_CURSOR_BATCH_SIZE = 500;
var DEFAULT_CURSOR_MAX_PAGES = 200;
var SELLER_SCOPED_CURSOR_MAX_PAGES = 40;
var OPT_OUT_BATCH_CHUNK_SIZE = 200;
var ANALYTICS_CACHE_TTL_MS = 3e4;
async function scanCollectionWithCursor(params) {
  const batchSize = Math.max(1, Math.min(1e3, params.batchSize ?? DEFAULT_CURSOR_BATCH_SIZE));
  const maxPages = Math.max(1, params.maxPages ?? DEFAULT_CURSOR_MAX_PAGES);
  const label = params.label || "collection";
  const items = [];
  const seenIds = /* @__PURE__ */ new Set();
  let lastDoc = null;
  let prevCursorId = null;
  let pagesRead = 0;
  let truncated = false;
  let truncationReason;
  while (true) {
    if (pagesRead >= maxPages) {
      truncated = true;
      truncationReason = `cursor_max_pages_exceeded:${maxPages}`;
      console.error(
        `[MarketAnalytics] Incomplete scan for ${label}: reached safety limit of ${maxPages} pages (${items.length} docs read).`
      );
      break;
    }
    let q = params.collectionRef.orderBy(params.documentIdField);
    if (params.selectFields && params.selectFields.length > 0 && typeof q.select === "function") {
      q = q.select(...params.selectFields);
    }
    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }
    q = q.limit(batchSize);
    const snap = await q.get();
    pagesRead += 1;
    const batchDocs = Array.isArray(snap?.docs) ? snap.docs : [];
    if (batchDocs.length === 0) {
      break;
    }
    let addedInBatch = 0;
    for (const d of batchDocs) {
      if (!d || !d.id || seenIds.has(d.id)) {
        continue;
      }
      seenIds.add(d.id);
      items.push({ id: d.id, data: d.data() || {} });
      addedInBatch += 1;
    }
    const nextLastDoc = batchDocs[batchDocs.length - 1];
    if (!nextLastDoc || !nextLastDoc.id || nextLastDoc.id === prevCursorId || addedInBatch === 0) {
      if (batchDocs.length >= batchSize) {
        truncated = true;
        truncationReason = "cursor_stalled_loop_guard";
        console.error(
          `[MarketAnalytics] Cursor pagination loop guard triggered for ${label} at docId=${nextLastDoc?.id || "unknown"} (${items.length} docs read).`
        );
      }
      break;
    }
    prevCursorId = nextLastDoc.id;
    lastDoc = nextLastDoc;
    if (batchDocs.length < batchSize) {
      break;
    }
  }
  return { items, truncated, truncationReason };
}
var FirestoreAdminAnalyticsRepository = class {
  publicDocsCache = null;
  ratingsCache = null;
  rankMapsCache = null;
  cacheTtlMs;
  constructor(options) {
    this.cacheTtlMs = options?.cacheTtlMs ?? ANALYTICS_CACHE_TTL_MS;
  }
  invalidateCaches() {
    this.publicDocsCache = null;
    this.ratingsCache = null;
    this.rankMapsCache = null;
  }
  async getListing(listingId) {
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection("listings").doc(listingId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    return {
      id: snap.id,
      sellerId: data.sellerId,
      sellerName: data.sellerName || data.authorName,
      title: data.title || data.titleGe || "Untitled",
      titleGe: data.titleGe,
      category: data.category || "other",
      listingType: inferListingType(data.category, data.listingType),
      image: Array.isArray(data.images) && data.images[0] ? data.images[0] : data.image,
      status: data.status,
      country: data.country,
      city: data.city,
      createdAt: parseTimestampMs(data.createdAt),
      isDemo: data.isDemo,
      isSeed: data.isSeed,
      isMock: data.isMock
    };
  }
  async getSellerProfileLocation(sellerId) {
    const db = await getAdminFirestoreInstance();
    const [userSnap, prefSnap] = await Promise.all([
      db.collection("users").doc(sellerId).get().catch(() => null),
      db.collection("seller_competition_prefs").doc(sellerId).get().catch(() => null)
    ]);
    const uData = userSnap?.exists ? userSnap.data() || {} : {};
    const pData = prefSnap?.exists ? prefSnap.data() || {} : {};
    const loc = resolveReliableSellerLocation({
      profileCountry: uData.country,
      profileRegion: uData.region
    });
    return {
      country: loc.country,
      region: loc.region,
      optedOut: Boolean(pData.optedOut ?? uData.competitionOptOut)
    };
  }
  mapListingDocToRecord(id, data) {
    return {
      id,
      sellerId: data.sellerId,
      sellerName: data.sellerName || data.authorName,
      title: data.title || data.titleGe || "Untitled",
      titleGe: data.titleGe,
      category: data.category || "other",
      listingType: inferListingType(data.category, data.listingType),
      image: Array.isArray(data.images) && data.images[0] ? data.images[0] : data.image,
      status: data.status,
      country: data.country,
      city: data.city,
      createdAt: parseTimestampMs(data.createdAt),
      isDemo: data.isDemo,
      isSeed: data.isSeed,
      isMock: data.isMock
    };
  }
  async getSellerListingsWithMeta(sellerId) {
    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import("firebase-admin/firestore");
    const scan = await scanCollectionWithCursor({
      collectionRef: db.collection("listings").where("sellerId", "==", sellerId),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: SELLER_SCOPED_CURSOR_MAX_PAGES,
      label: `listings:seller:${sellerId}`
    });
    return {
      listings: scan.items.map((item) => this.mapListingDocToRecord(item.id, item.data)),
      truncated: scan.truncated,
      ...scan.truncationReason ? { truncationReason: scan.truncationReason } : {}
    };
  }
  async getSellerListings(sellerId) {
    const res = await this.getSellerListingsWithMeta(sellerId);
    return res.listings;
  }
  async getListingAnalyticsDoc(listingId) {
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection("listing_analytics").doc(listingId).get();
    if (!snap.exists) return null;
    return snap.data();
  }
  async getSellerListingAnalyticsMap(sellerId) {
    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import("firebase-admin/firestore");
    const scan = await scanCollectionWithCursor({
      collectionRef: db.collection("listing_analytics").where("sellerId", "==", sellerId),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: SELLER_SCOPED_CURSOR_MAX_PAGES,
      label: `listing_analytics:seller:${sellerId}`
    });
    const docsByListingId = /* @__PURE__ */ new Map();
    for (const item of scan.items) {
      docsByListingId.set(item.id, item.data);
    }
    return {
      docsByListingId,
      truncated: scan.truncated,
      ...scan.truncationReason ? { truncationReason: scan.truncationReason } : {}
    };
  }
  async getAllPublicAnalyticsDocsWithMeta() {
    const now = Date.now();
    if (this.cacheTtlMs > 0 && this.publicDocsCache && this.publicDocsCache.expiresAt > now) {
      return this.publicDocsCache.value;
    }
    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import("firebase-admin/firestore");
    const scan = await scanCollectionWithCursor({
      collectionRef: db.collection("listing_analytics_public"),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: DEFAULT_CURSOR_MAX_PAGES,
      label: "listing_analytics_public"
    });
    const result = {
      docs: scan.items.map((item) => item.data),
      truncated: scan.truncated,
      ...scan.truncationReason ? { truncationReason: scan.truncationReason } : {}
    };
    if (this.cacheTtlMs > 0 && !result.truncated) {
      this.publicDocsCache = { expiresAt: now + this.cacheTtlMs, value: result };
    }
    return result;
  }
  async getAllPublicAnalyticsDocs() {
    const res = await this.getAllPublicAnalyticsDocsWithMeta();
    return res.docs;
  }
  async getSellerRatingsMapWithMeta() {
    const now = Date.now();
    if (this.cacheTtlMs > 0 && this.ratingsCache && this.ratingsCache.expiresAt > now) {
      return this.ratingsCache.value;
    }
    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import("firebase-admin/firestore");
    const scan = await scanCollectionWithCursor({
      collectionRef: db.collection("seller_reviews"),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: DEFAULT_CURSOR_MAX_PAGES,
      selectFields: ["sellerId", "rating"],
      label: "seller_reviews"
    });
    const agg = {};
    for (const item of scan.items) {
      const r = item.data || {};
      if (r.sellerId && typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5) {
        if (!agg[r.sellerId]) agg[r.sellerId] = { sum: 0, count: 0 };
        agg[r.sellerId].sum += r.rating;
        agg[r.sellerId].count += 1;
      }
    }
    const ratings = {};
    for (const [sid, v] of Object.entries(agg)) {
      ratings[sid] = { avg: Math.round(v.sum / v.count * 10) / 10, count: v.count };
    }
    const result = {
      ratings,
      truncated: scan.truncated,
      ...scan.truncationReason ? { truncationReason: scan.truncationReason } : {}
    };
    if (this.cacheTtlMs > 0 && !result.truncated) {
      this.ratingsCache = { expiresAt: now + this.cacheTtlMs, value: result };
    }
    return result;
  }
  async getSellerRatingsMap() {
    const res = await this.getSellerRatingsMapWithMeta();
    return res.ratings;
  }
  async getAggregatedRankMaps(nowMs = Date.now()) {
    const now = Date.now();
    if (this.cacheTtlMs > 0 && this.rankMapsCache && this.rankMapsCache.expiresAt > now) {
      return this.rankMapsCache.value;
    }
    const warnings = [];
    let truncated = false;
    const [publicScan, ratingsScan] = await Promise.all([
      this.getAllPublicAnalyticsDocsWithMeta().catch((err) => {
        console.error("[MarketAnalytics] Failed to load public docs for seller stats:", err);
        truncated = true;
        warnings.push("public_docs_read_failed");
        return { docs: [], truncated: true, truncationReason: "public_docs_read_failed" };
      }),
      this.getSellerRatingsMapWithMeta().catch((err) => {
        console.error("[MarketAnalytics] Failed to load seller ratings for seller stats:", err);
        truncated = true;
        warnings.push("ratings_read_failed");
        return { ratings: {}, truncated: true, truncationReason: "ratings_read_failed" };
      })
    ]);
    if (publicScan.truncated) {
      truncated = true;
      if (publicScan.truncationReason && !warnings.includes(publicScan.truncationReason)) {
        warnings.push(publicScan.truncationReason);
      } else if (!publicScan.truncationReason && warnings.length === 0) {
        warnings.push("public_docs_truncated");
      }
    }
    if (ratingsScan.truncated) {
      truncated = true;
      if (ratingsScan.truncationReason && !warnings.includes(ratingsScan.truncationReason)) {
        warnings.push(ratingsScan.truncationReason);
      } else if (!ratingsScan.truncationReason && warnings.length === 0) {
        warnings.push("seller_ratings_truncated");
      }
    }
    const globalRankings = buildRankingsFromPublicDocs({
      docs: publicScan.docs,
      sellerRatingsMap: ratingsScan.ratings,
      scope: "global",
      period: "30d",
      nowMs,
      limitCount: Math.max(300, publicScan.docs.length)
    });
    const globalRankMap = new Map(globalRankings.map((r) => [r.listingId, r.rank]));
    const catRankMap = /* @__PURE__ */ new Map();
    const byCat = /* @__PURE__ */ new Map();
    for (const r of globalRankings) {
      const cat = (r.category || "other").toLowerCase();
      const arr = byCat.get(cat) || [];
      arr.push(r);
      byCat.set(cat, arr);
    }
    for (const arr of byCat.values()) {
      arr.forEach((r, idx) => catRankMap.set(r.listingId, { rank: idx + 1, total: arr.length }));
    }
    const result = {
      globalRankMap,
      catRankMap,
      truncated,
      warnings
    };
    if (this.cacheTtlMs > 0 && !truncated) {
      this.rankMapsCache = { expiresAt: now + this.cacheTtlMs, value: result };
    }
    return result;
  }
  async recordEventTransaction(params) {
    const db = await getAdminFirestoreInstance();
    const { listing, sellerLocation, viewerHash, viewerType, eventType, nowMs } = params;
    const analyticsRef = db.collection("listing_analytics").doc(listing.id);
    const viewerRef = analyticsRef.collection("viewers").doc(viewerHash);
    const publicRef = db.collection("listing_analytics_public").doc(listing.id);
    const loc = resolveReliableSellerLocation({
      profileCountry: sellerLocation.country,
      profileRegion: sellerLocation.region,
      listingCountry: listing.country,
      listingCity: listing.city
    });
    return db.runTransaction(async (tx) => {
      const [analyticsSnap, viewerSnap] = await Promise.all([
        tx.get(analyticsRef),
        tx.get(viewerRef)
      ]);
      const viewerData = viewerSnap.exists ? viewerSnap.data() : { viewerHash, viewerType };
      if (eventType === "impression") {
        if (viewerData.lastImpressionAt && nowMs - viewerData.lastImpressionAt < IMPRESSION_COOLDOWN_MS) {
          return { recorded: false, reason: "impression_cooldown", uniqueIncremented: false };
        }
      } else {
        if (viewerData.lastViewAt && nowMs - viewerData.lastViewAt < VIEW_COOLDOWN_MS) {
          return { recorded: false, reason: "view_cooldown", uniqueIncremented: false };
        }
      }
      const existingDoc = analyticsSnap.exists ? analyticsSnap.data() || {} : {};
      const hourKey = getHourBucketKey(nowMs);
      const dayKey = getDayBucketKey(nowMs);
      const hourly = pruneHourlyBuckets(existingDoc.hourly, nowMs);
      const daily = pruneDailyBuckets(existingDoc.daily, nowMs);
      const hBucket = hourly[hourKey] || {
        impressions: 0,
        views: 0,
        uniqueViewers: 0,
        authImpressions: 0,
        authViews: 0,
        authUniqueViewers: 0,
        guestImpressions: 0,
        guestViews: 0,
        guestUniqueViewers: 0
      };
      const dBucket = daily[dayKey] || {
        impressions: 0,
        views: 0,
        uniqueViewers: 0,
        authImpressions: 0,
        authViews: 0,
        authUniqueViewers: 0,
        guestImpressions: 0,
        guestViews: 0,
        guestUniqueViewers: 0
      };
      const isAuthViewer = viewerType === "auth";
      let impressions = Number(existingDoc.impressions) || 0;
      let views = Number(existingDoc.views) || 0;
      let uniqueViewers = Number(existingDoc.uniqueViewers) || 0;
      let authImpressions = Number(existingDoc.authImpressions) || 0;
      let authViews = Number(existingDoc.authViews) || 0;
      let authUniqueViewers = Number(existingDoc.authUniqueViewers) || 0;
      let guestImpressions = Number(existingDoc.guestImpressions) || 0;
      let guestViews = Number(existingDoc.guestViews) || 0;
      let guestUniqueViewers = Number(existingDoc.guestUniqueViewers) || 0;
      let uniqueIncremented = false;
      if (eventType === "impression") {
        impressions += 1;
        hBucket.impressions += 1;
        dBucket.impressions += 1;
        if (isAuthViewer) {
          authImpressions += 1;
          hBucket.authImpressions = (Number(hBucket.authImpressions) || 0) + 1;
          dBucket.authImpressions = (Number(dBucket.authImpressions) || 0) + 1;
        } else {
          guestImpressions += 1;
          hBucket.guestImpressions = (Number(hBucket.guestImpressions) || 0) + 1;
          dBucket.guestImpressions = (Number(dBucket.guestImpressions) || 0) + 1;
        }
        viewerData.firstImpressionAt = viewerData.firstImpressionAt || nowMs;
        viewerData.lastImpressionAt = nowMs;
      } else {
        views += 1;
        hBucket.views += 1;
        dBucket.views += 1;
        if (isAuthViewer) {
          authViews += 1;
          hBucket.authViews = (Number(hBucket.authViews) || 0) + 1;
          dBucket.authViews = (Number(dBucket.authViews) || 0) + 1;
        } else {
          guestViews += 1;
          hBucket.guestViews = (Number(hBucket.guestViews) || 0) + 1;
          dBucket.guestViews = (Number(dBucket.guestViews) || 0) + 1;
        }
        if (!viewerData.firstViewedAt) {
          uniqueViewers += 1;
          hBucket.uniqueViewers += 1;
          dBucket.uniqueViewers += 1;
          if (isAuthViewer) {
            authUniqueViewers += 1;
            hBucket.authUniqueViewers = (Number(hBucket.authUniqueViewers) || 0) + 1;
            dBucket.authUniqueViewers = (Number(dBucket.authUniqueViewers) || 0) + 1;
          } else {
            guestUniqueViewers += 1;
            hBucket.guestUniqueViewers = (Number(hBucket.guestUniqueViewers) || 0) + 1;
            dBucket.guestUniqueViewers = (Number(dBucket.guestUniqueViewers) || 0) + 1;
          }
          viewerData.firstViewedAt = nowMs;
          uniqueIncremented = true;
        }
        viewerData.lastViewAt = nowMs;
      }
      hourly[hourKey] = hBucket;
      daily[dayKey] = dBucket;
      const breakdownSince = typeof existingDoc.breakdownSince === "number" && Number.isFinite(existingDoc.breakdownSince) ? existingDoc.breakdownSince : nowMs;
      const optedOut = Boolean(sellerLocation.optedOut ?? existingDoc.optedOut);
      const normalizedListingType = inferListingType(listing.category, listing.listingType);
      const nextAnalyticsDoc = {
        listingId: listing.id,
        sellerId: listing.sellerId,
        title: listing.title,
        ...listing.titleGe ? { titleGe: listing.titleGe } : {},
        category: listing.category,
        listingType: normalizedListingType,
        ...listing.image ? { image: listing.image } : {},
        status: listing.status || "active",
        sellerName: listing.sellerName || "Proton Vendor",
        ...loc.country ? { country: loc.country } : {},
        ...loc.region ? { region: loc.region } : {},
        optedOut,
        impressions,
        views,
        uniqueViewers,
        authImpressions,
        authViews,
        authUniqueViewers,
        guestImpressions,
        guestViews,
        guestUniqueViewers,
        breakdownSince,
        hourly,
        daily,
        createdAt: Number(existingDoc.createdAt) || nowMs,
        listingCreatedAt: parseTimestampMs(listing.createdAt),
        updatedAt: nowMs
      };
      tx.set(viewerRef, viewerData, { merge: true });
      tx.set(analyticsRef, nextAnalyticsDoc);
      if (!optedOut && (!listing.status || listing.status === "active")) {
        tx.set(publicRef, nextAnalyticsDoc);
      } else {
        tx.delete(publicRef);
      }
      return { recorded: true, uniqueIncremented };
    }).then((res) => {
      if (res.recorded) {
        this.publicDocsCache = null;
        this.rankMapsCache = null;
      }
      return res;
    });
  }
  async setSellerCompetitionOptOut(sellerId, optedOut, nowMs) {
    const db = await getAdminFirestoreInstance();
    const { FieldPath } = await import("firebase-admin/firestore");
    await db.collection("seller_competition_prefs").doc(sellerId).set({ optedOut, updatedAt: nowMs }, { merge: true });
    await db.collection("users").doc(sellerId).set({ competitionOptOut: optedOut }, { merge: true });
    const sellerAnalyticsRef = db.collection("seller_analytics").doc(sellerId);
    const sellerAnalyticsSnap = await sellerAnalyticsRef.get().catch(() => null);
    if (sellerAnalyticsSnap?.exists) {
      await sellerAnalyticsRef.set({ optedOut, updatedAt: nowMs }, { merge: true });
    }
    const scan = await scanCollectionWithCursor({
      collectionRef: db.collection("listing_analytics").where("sellerId", "==", sellerId),
      documentIdField: FieldPath.documentId(),
      batchSize: DEFAULT_CURSOR_BATCH_SIZE,
      maxPages: SELLER_SCOPED_CURSOR_MAX_PAGES,
      label: `optout:listing_analytics:seller:${sellerId}`
    });
    if (scan.truncated) {
      throw new Error(
        `Failed to complete competition opt-out update: listing analytics scan was truncated (${scan.truncationReason || "cursor_max_pages_exceeded"}). Some listings may not have been updated.`
      );
    }
    for (let i = 0; i < scan.items.length; i += OPT_OUT_BATCH_CHUNK_SIZE) {
      const chunk = scan.items.slice(i, i + OPT_OUT_BATCH_CHUNK_SIZE);
      const batch = db.batch();
      for (const item of chunk) {
        const data = item.data;
        const normalizedType = inferListingType(data.category, data.listingType);
        const docRef = db.collection("listing_analytics").doc(item.id);
        batch.set(
          docRef,
          { optedOut, listingType: normalizedType, updatedAt: nowMs },
          { merge: true }
        );
        const pubRef = db.collection("listing_analytics_public").doc(item.id);
        if (optedOut || data.status && data.status !== "active") {
          batch.delete(pubRef);
        } else {
          batch.set(pubRef, {
            ...data,
            listingType: normalizedType,
            optedOut: false,
            updatedAt: nowMs
          });
        }
      }
      await batch.commit();
    }
    this.invalidateCaches();
  }
  // ============================================================================
  // PHASE 2B: SELLER ANALYTICS FOUNDATION REPOSITORY METHODS
  // ============================================================================
  async getSellerAnalyticsDoc(sellerId) {
    if (!isValidAnalyticsId(sellerId)) return null;
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection("seller_analytics").doc(sellerId).get();
    if (!snap.exists) return null;
    return snap.data();
  }
  async ensureSellerAnalyticsDoc(params) {
    if (!isValidAnalyticsId(params.sellerId)) {
      throw new Error("Invalid sellerId for seller_analytics");
    }
    const db = await getAdminFirestoreInstance();
    const ref = db.collection("seller_analytics").doc(params.sellerId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        return snap.data();
      }
      const initialDoc = createEmptySellerAnalyticsDoc(params);
      tx.set(ref, initialDoc);
      return initialDoc;
    });
  }
  async getSellerViewerDoc(sellerId, sellerViewerHash) {
    if (!isValidAnalyticsId(sellerId) || !isValidHmacDigest(sellerViewerHash)) return null;
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection("seller_analytics").doc(sellerId).collection("viewers").doc(sellerViewerHash).get();
    if (!snap.exists) return null;
    return snap.data();
  }
  async upsertSellerViewerDoc(sellerId, viewerDoc) {
    if (!isValidAnalyticsId(sellerId)) {
      throw new Error("Invalid sellerId for seller viewer storage");
    }
    const cleanDoc = sanitizeSellerViewerDoc(viewerDoc);
    const db = await getAdminFirestoreInstance();
    const ref = db.collection("seller_analytics").doc(sellerId).collection("viewers").doc(cleanDoc.viewerHash);
    await ref.set(cleanDoc, { merge: true });
    return cleanDoc;
  }
  async getGuestSessionIndex(guestHash) {
    if (!isValidHmacDigest(guestHash)) return null;
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection("analytics_guest_sessions").doc(guestHash).get();
    if (!snap.exists) return null;
    return snap.data();
  }
  async recordGuestSessionActivity(params) {
    if (!isValidHmacDigest(params.guestHash)) {
      throw new Error("Invalid guestHash");
    }
    const db = await getAdminFirestoreInstance();
    const ref = db.collection("analytics_guest_sessions").doc(params.guestHash);
    const nowMs = params.nowMs ?? Date.now();
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? snap.data() : null;
      const nextDoc = mergeGuestSessionActivity(existing, {
        guestHash: params.guestHash,
        listingId: params.listingId,
        sellerId: params.sellerId,
        nowMs
      });
      tx.set(ref, nextDoc);
      return nextDoc;
    });
  }
  async claimGuestSession(params) {
    if (!isValidHmacDigest(params.guestHash) || !isValidAnalyticsId(params.uid)) {
      return { status: 400, claimed: false, reason: "invalid_request" };
    }
    const db = await getAdminFirestoreInstance();
    const ref = db.collection("analytics_guest_sessions").doc(params.guestHash);
    const nowMs = params.nowMs ?? Date.now();
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? snap.data() : null;
      const evaluation = evaluateGuestSessionClaim(existing, {
        uid: params.uid,
        nowMs
      });
      if (evaluation.claimed && !evaluation.idempotent && evaluation.nextDoc) {
        tx.set(ref, evaluation.nextDoc);
      }
      const { nextDoc: _unused, ...publicResult } = evaluation;
      return publicResult;
    });
  }
  async getVerifiedFunnelMarker(markerId) {
    if (!isValidAnalyticsId(markerId)) return null;
    const db = await getAdminFirestoreInstance();
    const snap = await db.collection("analytics_verified_markers").doc(markerId).get();
    if (!snap.exists) return null;
    return snap.data();
  }
  async claimVerifiedFunnelMarker(params) {
    if (!isValidAnalyticsId(params.sellerId) || !isValidHmacDigest(params.buyerHash)) {
      throw new Error("Invalid sellerId or buyerHash for verified funnel marker");
    }
    if (params.listingId !== void 0 && !isValidAnalyticsId(params.listingId)) {
      throw new Error("Invalid listingId for verified funnel marker");
    }
    const markerId = buildVerifiedFunnelMarkerId(params.markerType, params.sourceId);
    const nowMs = params.nowMs ?? Date.now();
    const db = await getAdminFirestoreInstance();
    const ref = db.collection("analytics_verified_markers").doc(markerId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        return { created: false, duplicate: true, markerId };
      }
      const markerDoc = {
        markerId,
        markerType: params.markerType,
        sellerId: params.sellerId,
        buyerHash: params.buyerHash,
        sourceId: params.sourceId,
        ...params.listingId ? { listingId: params.listingId } : {},
        recordedAt: nowMs
      };
      tx.set(ref, markerDoc);
      return { created: true, duplicate: false, markerId };
    });
  }
};
var MarketAnalyticsService = class {
  repo;
  explicitSalt;
  // In-memory short burst IP+listing guard to prevent rotating-token spam WITHOUT storing raw IPs in DB
  ipListingThrottle = /* @__PURE__ */ new Map();
  constructor(repo, salt) {
    this.repo = repo || new FirestoreAdminAnalyticsRepository();
    if (typeof salt === "string" && salt.length > 0) {
      this.explicitSalt = salt;
    }
  }
  resolveEffectiveSalt() {
    if (this.explicitSalt) {
      return this.explicitSalt;
    }
    if (isProductionRuntime()) {
      const prodSalt = (process.env.ANALYTICS_HASH_SALT || "").trim();
      if (!prodSalt || prodSalt.length < MIN_ANALYTICS_SALT_LENGTH || prodSalt === DEV_FALLBACK_ANALYTICS_SALT) {
        throw new AnalyticsConfigError(
          "analytics/salt-missing",
          "Server analytics hash salt (ANALYTICS_HASH_SALT) is missing or insufficiently strong for production."
        );
      }
      return prodSalt;
    }
    const devSalt = (process.env.ANALYTICS_HASH_SALT || process.env.ANALYTICS_SALT || "").trim();
    return devSalt || DEV_FALLBACK_ANALYTICS_SALT;
  }
  computeViewerHash(listingId, identityKey) {
    const activeSalt = this.resolveEffectiveSalt();
    return crypto.createHmac("sha256", activeSalt).update(`${listingId}:${identityKey}`).digest("hex");
  }
  /**
   * Server-only HMAC hash for seller_analytics/{sellerId}/viewers/{sellerViewerHash}.
   * Never persisted with raw IP, visitorToken, or User-Agent.
   */
  computeSellerViewerHash(sellerId, identityKey) {
    if (!isValidAnalyticsId(sellerId)) {
      throw new Error("Invalid sellerId for seller viewer hash");
    }
    const activeSalt = this.resolveEffectiveSalt();
    return crypto.createHmac("sha256", activeSalt).update(`seller:${sellerId}:${identityKey}`).digest("hex");
  }
  /**
   * Server-only HMAC hash for analytics_guest_sessions/{guestHash}.
   */
  computeGuestSessionHash(visitorToken) {
    if (typeof visitorToken !== "string" || visitorToken.length < 8 || visitorToken.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(visitorToken)) {
      throw new Error("Invalid visitorToken for guest session hash");
    }
    const activeSalt = this.resolveEffectiveSalt();
    return crypto.createHmac("sha256", activeSalt).update(`guest_session:${visitorToken}`).digest("hex");
  }
  /**
   * Server-only HMAC hash for buyer identity in verified funnel markers.
   */
  computeBuyerIdentityHash(buyerUid) {
    if (!isValidAnalyticsId(buyerUid)) {
      throw new Error("Invalid buyerUid for verified marker hash");
    }
    const activeSalt = this.resolveEffectiveSalt();
    return crypto.createHmac("sha256", activeSalt).update(`buyer:${buyerUid}`).digest("hex");
  }
  checkInMemoryIpGuard(clientIp, listingId, eventType, nowMs, activeSalt) {
    if (!clientIp) return true;
    const keyHash = crypto.createHmac("sha256", activeSalt).update(`${clientIp}:${listingId}:${eventType}`).digest("hex").slice(0, 24);
    const prev = this.ipListingThrottle.get(keyHash);
    const minGap = eventType === "impression" ? 15e3 : 1e4;
    if (prev && nowMs - prev < minGap) {
      return false;
    }
    this.ipListingThrottle.set(keyHash, nowMs);
    if (this.ipListingThrottle.size > 5e3) {
      const cutoff = nowMs - 6e4;
      for (const [k, ts] of this.ipListingThrottle.entries()) {
        if (ts < cutoff) this.ipListingThrottle.delete(k);
      }
    }
    return true;
  }
  async recordListingEvent(params) {
    const nowMs = params.nowMs ?? Date.now();
    if (isBotUserAgent(params.userAgent)) {
      return { status: 200, body: { recorded: false, reason: "bot_filtered" } };
    }
    if (!isValidAnalyticsId(params.listingId)) {
      return { status: 400, body: { error: "Invalid listingId", code: "analytics/invalid-listing-id" } };
    }
    if (params.eventType !== "impression" && params.eventType !== "view") {
      return { status: 400, body: { error: "Invalid eventType", code: "analytics/invalid-event-type" } };
    }
    let viewerType;
    let identityKey;
    if (params.verifiedUid && isValidAnalyticsId(params.verifiedUid)) {
      viewerType = "auth";
      identityKey = `auth:${params.verifiedUid}`;
    } else {
      if (typeof params.visitorToken !== "string" || params.visitorToken.length < 8 || params.visitorToken.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(params.visitorToken)) {
        return { status: 400, body: { error: "Valid visitorToken required for guest telemetry", code: "analytics/invalid-visitor-token" } };
      }
      viewerType = "guest";
      identityKey = `guest:${params.visitorToken}`;
    }
    let activeSalt;
    try {
      activeSalt = this.resolveEffectiveSalt();
    } catch (err) {
      if (err instanceof AnalyticsConfigError && err.code === "analytics/salt-missing") {
        return {
          status: 503,
          body: {
            recorded: false,
            code: "analytics/salt-missing",
            error: err.message
          }
        };
      }
      throw err;
    }
    if (!this.checkInMemoryIpGuard(params.clientIp, params.listingId, params.eventType, nowMs, activeSalt)) {
      return { status: 200, body: { recorded: false, reason: "rate_throttled" } };
    }
    const listing = await this.repo.getListing(params.listingId);
    if (!listing || listing.isDemo || listing.isSeed || listing.isMock || listing.status === "deleted") {
      return { status: 404, body: { error: "Listing not found", code: "analytics/listing-not-found" } };
    }
    if (params.verifiedUid && params.verifiedUid === listing.sellerId) {
      return { status: 200, body: { recorded: false, reason: "owner_excluded" } };
    }
    const sellerLocation = await this.repo.getSellerProfileLocation(listing.sellerId);
    const viewerHash = this.computeViewerHash(listing.id, identityKey);
    const txResult = await this.repo.recordEventTransaction({
      listing,
      sellerLocation,
      viewerHash,
      viewerType,
      eventType: params.eventType,
      nowMs
    });
    return {
      status: 200,
      body: {
        recorded: txResult.recorded,
        ...txResult.reason ? { reason: txResult.reason } : {},
        uniqueIncremented: txResult.uniqueIncremented
      }
    };
  }
  async getSellerStats(params) {
    const nowMs = params.nowMs ?? Date.now();
    const { verifiedUid, listingId } = params;
    if (listingId !== void 0) {
      if (!isValidAnalyticsId(listingId)) {
        return { status: 400, body: { error: "Invalid listingId", code: "analytics/invalid-listing-id" } };
      }
      const listing = await this.repo.getListing(listingId);
      if (!listing) {
        return { status: 404, body: { error: "Listing not found", code: "analytics/listing-not-found" } };
      }
      if (listing.sellerId !== verifiedUid) {
        return { status: 403, body: { error: "Forbidden: Only listing owner can read private analytics", code: "analytics/forbidden" } };
      }
      const rawDoc = await this.repo.getListingAnalyticsDoc(listingId);
      const stats = await this.buildSingleListingStats(listing, rawDoc, nowMs);
      return { status: 200, body: { listing: stats } };
    }
    const [listingsResult, sellerPref] = await Promise.all([
      this.repo.getSellerListingsWithMeta ? this.repo.getSellerListingsWithMeta(verifiedUid) : this.repo.getSellerListings(verifiedUid).then((listings) => ({
        listings,
        truncated: false
      })),
      this.repo.getSellerProfileLocation(verifiedUid)
    ]);
    const realListings = listingsResult.listings.filter(
      (l) => !l.isDemo && !l.isSeed && !l.isMock && l.status !== "deleted"
    );
    let listingsTruncated = Boolean(listingsResult.truncated);
    let listingsTruncationReason = listingsResult.truncationReason;
    let analyticsTruncated = false;
    let analyticsTruncationReason;
    let globalRankMap = /* @__PURE__ */ new Map();
    let catRankMap = /* @__PURE__ */ new Map();
    if (realListings.length > 0 && !sellerPref.optedOut) {
      if (this.repo.getAggregatedRankMaps) {
        const rankMaps = await this.repo.getAggregatedRankMaps(nowMs);
        globalRankMap = rankMaps.globalRankMap;
        catRankMap = rankMaps.catRankMap;
        if (rankMaps.truncated) {
          analyticsTruncated = true;
          analyticsTruncationReason = rankMaps.warnings?.[0] || "rank_maps_truncated";
        }
      } else {
        const [publicDocs, ratingsMap] = await Promise.all([
          this.repo.getAllPublicAnalyticsDocs().catch((err) => {
            console.error("[MarketAnalytics] Failed to load public docs for seller stats:", err);
            return [];
          }),
          this.repo.getSellerRatingsMap().catch((err) => {
            console.error("[MarketAnalytics] Failed to load seller ratings for seller stats:", err);
            return {};
          })
        ]);
        const globalRankings = buildRankingsFromPublicDocs({
          docs: publicDocs,
          sellerRatingsMap: ratingsMap,
          scope: "global",
          period: "30d",
          nowMs,
          limitCount: Math.max(300, publicDocs.length)
        });
        globalRankMap = new Map(globalRankings.map((r) => [r.listingId, r.rank]));
        const byCat = /* @__PURE__ */ new Map();
        for (const r of globalRankings) {
          const cat = (r.category || "other").toLowerCase();
          const arr = byCat.get(cat) || [];
          arr.push(r);
          byCat.set(cat, arr);
        }
        for (const arr of byCat.values()) {
          arr.forEach((r, idx) => catRankMap.set(r.listingId, { rank: idx + 1, total: arr.length }));
        }
      }
    }
    let analyticsDocs;
    if (realListings.length === 0) {
      analyticsDocs = [];
    } else if (this.repo.getSellerListingAnalyticsMap) {
      const sellerAnalyticsScan = await this.repo.getSellerListingAnalyticsMap(verifiedUid);
      analyticsDocs = realListings.map((l) => sellerAnalyticsScan.docsByListingId.get(l.id) ?? null);
      if (sellerAnalyticsScan.truncated) {
        analyticsTruncated = true;
        analyticsTruncationReason = sellerAnalyticsScan.truncationReason || "seller_analytics_scan_truncated";
      }
    } else {
      analyticsDocs = await Promise.all(
        realListings.map((l) => this.repo.getListingAnalyticsDoc(l.id))
      );
    }
    const isPartialData = listingsTruncated || analyticsTruncated;
    const truncationReason = listingsTruncationReason || analyticsTruncationReason;
    const listingStats = realListings.map((listing, idx) => {
      const rawDoc = analyticsDocs[idx];
      const agg = aggregatePeriodFromBuckets(
        rawDoc || { impressions: 0, views: 0, uniqueViewers: 0 },
        nowMs
      );
      const viewerBreakdown = aggregateViewerBreakdownFromDoc(rawDoc, nowMs);
      const catInfo = catRankMap.get(listing.id);
      const achievements = computeListingAchievements({
        curr7d: agg.periods["7d"],
        prev7d: agg.prevPeriods["7d"],
        curr30d: agg.periods["30d"],
        listingCreatedAt: parseTimestampMs(listing.createdAt),
        nowMs,
        categoryRank: catInfo?.rank,
        categoryTotal: catInfo?.total,
        globalRank: globalRankMap.get(listing.id)
      });
      return {
        listingId: listing.id,
        title: listing.title,
        titleGe: listing.titleGe,
        category: listing.category,
        listingType: inferListingType(listing.category, listing.listingType),
        image: listing.image,
        status: listing.status || "active",
        optedOut: Boolean(sellerPref.optedOut ?? rawDoc?.optedOut),
        createdAt: parseTimestampMs(listing.createdAt),
        updatedAt: rawDoc?.updatedAt || 0,
        periods: agg.periods,
        comparisons: agg.comparisons,
        achievements,
        ...viewerBreakdown ? { viewerBreakdown } : {}
      };
    });
    const periodKeys = ["24h", "7d", "30d", "all"];
    const periodTotals = {};
    for (const pk of periodKeys) {
      periodTotals[pk] = sumPeriodMetricsList(listingStats.map((s) => s.periods[pk]));
    }
    const compKeys = ["24h", "7d", "30d"];
    const periodComparisons = {};
    for (const ck of compKeys) {
      const sumDelta = (field) => listingStats.reduce((acc, s) => acc + s.comparisons[ck][field], 0);
      const impDelta = sumDelta("impressionsDelta");
      const vDelta = sumDelta("viewsDelta");
      const uDelta = sumDelta("uniqueViewersDelta");
      const currP = periodTotals[ck];
      const prevImp = Math.max(0, currP.impressions - impDelta);
      const prevViews = Math.max(0, currP.views - vDelta);
      const prevUniq = Math.max(0, currP.uniqueViewers - uDelta);
      const prevEng = prevImp > 0 ? Math.min(100, Math.round(prevViews / prevImp * 1e3) / 10) : 0;
      const pct = (c, p) => p <= 0 ? c > 0 ? 100 : null : Math.round((c - p) / p * 1e3) / 10;
      periodComparisons[ck] = {
        impressionsDelta: impDelta,
        viewsDelta: vDelta,
        uniqueViewersDelta: uDelta,
        engagementRateDelta: Math.round((currP.engagementRate - prevEng) * 10) / 10,
        impressionsChangePct: pct(currP.impressions, prevImp),
        viewsChangePct: pct(currP.views, prevViews),
        uniqueViewersChangePct: pct(currP.uniqueViewers, prevUniq)
      };
    }
    const earnedAchievements = [];
    for (const s of listingStats) {
      for (const badge of s.achievements) {
        earnedAchievements.push({
          id: badge,
          listingId: s.listingId,
          listingTitle: s.title,
          listingTitleGe: s.titleGe,
          category: s.category
        });
      }
    }
    const overviewBreakdown = sumViewerBreakdownList(listingStats.map((s) => s.viewerBreakdown));
    const overview = {
      totalImpressions: periodTotals.all.impressions,
      totalViews: periodTotals.all.views,
      totalUniqueViewers: periodTotals.all.uniqueViewers,
      engagementRate: periodTotals.all.engagementRate,
      periodTotals,
      periodComparisons,
      listings: listingStats,
      competitionOptOut: Boolean(sellerPref.optedOut),
      earnedAchievements,
      ...overviewBreakdown ? { viewerBreakdown: overviewBreakdown } : {},
      isPartialData,
      ...truncationReason ? { truncationReason } : {}
    };
    return { status: 200, body: { overview } };
  }
  async buildSingleListingStats(listing, rawDoc, nowMs) {
    const agg = aggregatePeriodFromBuckets(
      rawDoc || { impressions: 0, views: 0, uniqueViewers: 0 },
      nowMs
    );
    const viewerBreakdown = aggregateViewerBreakdownFromDoc(rawDoc, nowMs);
    const achievements = computeListingAchievements({
      curr7d: agg.periods["7d"],
      prev7d: agg.prevPeriods["7d"],
      curr30d: agg.periods["30d"],
      listingCreatedAt: parseTimestampMs(listing.createdAt),
      nowMs
    });
    return {
      listingId: listing.id,
      title: listing.title,
      titleGe: listing.titleGe,
      category: listing.category,
      listingType: inferListingType(listing.category, listing.listingType),
      image: listing.image,
      status: listing.status || "active",
      optedOut: Boolean(rawDoc?.optedOut),
      createdAt: parseTimestampMs(listing.createdAt),
      updatedAt: rawDoc?.updatedAt || 0,
      periods: agg.periods,
      comparisons: agg.comparisons,
      achievements,
      ...viewerBreakdown ? { viewerBreakdown } : {}
    };
  }
  async getRankings(params) {
    const scope = params.scope === "country" || params.scope === "category" || params.scope === "regional" || params.scope === "listingType" ? params.scope : "global";
    const period = params.period === "30d" ? "30d" : "7d";
    const listingType = normalizeListingTypeFilter(params.listingType);
    const nowMs = params.nowMs ?? Date.now();
    const [publicScan, ratingsScan] = await Promise.all([
      this.repo.getAllPublicAnalyticsDocsWithMeta ? this.repo.getAllPublicAnalyticsDocsWithMeta() : this.repo.getAllPublicAnalyticsDocs().then((docs) => ({ docs, truncated: false })),
      this.repo.getSellerRatingsMapWithMeta ? this.repo.getSellerRatingsMapWithMeta() : this.repo.getSellerRatingsMap().then((ratings) => ({ ratings, truncated: false })).catch((err) => {
        console.error("[MarketAnalytics] Failed to load seller ratings map for rankings:", err);
        return { ratings: {}, truncated: true, truncationReason: "ratings_read_failed" };
      })
    ]);
    const publicDocs = publicScan.docs;
    const sellerRatingsMap = ratingsScan.ratings;
    const warnings = [];
    if (publicScan.truncated) {
      warnings.push(publicScan.truncationReason || "public_docs_truncated");
    }
    if (ratingsScan.truncated) {
      warnings.push(ratingsScan.truncationReason || "seller_ratings_truncated");
    }
    const isPartialData = warnings.length > 0;
    if (isPartialData) {
      console.error("[MarketAnalytics] Rankings computed on partial data:", warnings.join(", "));
    }
    const rankings = buildRankingsFromPublicDocs({
      docs: publicDocs,
      sellerRatingsMap,
      scope,
      period,
      listingType,
      category: params.category,
      country: params.country,
      region: params.region,
      nowMs
    });
    const availableCountries = Array.from(
      new Set(publicDocs.filter((d) => !d.optedOut && d.country).map((d) => d.country))
    ).sort();
    const availableRegions = Array.from(
      new Set(publicDocs.filter((d) => !d.optedOut && d.region).map((d) => d.region))
    ).sort();
    return {
      status: 200,
      body: {
        scope,
        period,
        listingType,
        rankings,
        availableCountries,
        availableRegions,
        isPartialData,
        dataCompleteness: {
          isComplete: !isPartialData,
          publicDocsTruncated: publicScan.truncated,
          ratingsTruncated: ratingsScan.truncated,
          warnings
        }
      }
    };
  }
  async updateCompetitionOptOut(params) {
    await this.repo.setSellerCompetitionOptOut(
      params.verifiedUid,
      Boolean(params.optedOut),
      params.nowMs ?? Date.now()
    );
    return {
      status: 200,
      body: {
        success: true,
        optedOut: Boolean(params.optedOut)
      }
    };
  }
  // Phase 2B Server Foundation Operations (no public HTTP endpoints exposed yet)
  async getSellerAnalyticsDoc(sellerId) {
    if (!isValidAnalyticsId(sellerId) || !this.repo.getSellerAnalyticsDoc) {
      return null;
    }
    return this.repo.getSellerAnalyticsDoc(sellerId);
  }
  async ensureSellerAnalyticsDoc(params) {
    if (!this.repo.ensureSellerAnalyticsDoc) {
      throw new Error("Repository does not implement ensureSellerAnalyticsDoc");
    }
    return this.repo.ensureSellerAnalyticsDoc(params);
  }
  async claimGuestSessionForUser(params) {
    if (!this.repo.claimGuestSession) {
      throw new Error("Repository does not implement claimGuestSession");
    }
    if (!isValidAnalyticsId(params.uid)) {
      return { status: 400, claimed: false, reason: "invalid_request" };
    }
    let guestHash;
    try {
      guestHash = this.computeGuestSessionHash(params.visitorToken);
    } catch {
      return { status: 400, claimed: false, reason: "invalid_request" };
    }
    return this.repo.claimGuestSession({
      guestHash,
      uid: params.uid,
      nowMs: params.nowMs ?? Date.now()
    });
  }
  async claimVerifiedFunnelMarker(params) {
    if (!this.repo.claimVerifiedFunnelMarker) {
      throw new Error("Repository does not implement claimVerifiedFunnelMarker");
    }
    const buyerHash = this.computeBuyerIdentityHash(params.buyerUid);
    return this.repo.claimVerifiedFunnelMarker({
      markerType: params.markerType,
      sourceId: params.sourceId,
      sellerId: params.sellerId,
      buyerHash,
      listingId: params.listingId,
      nowMs: params.nowMs ?? Date.now()
    });
  }
};
function isAdminCredentialsError(err) {
  if (err instanceof AnalyticsConfigError) return true;
  const code = String(err?.code || "");
  const msg = String(err?.message || err || "");
  return err?.code === 7 || err?.code === 16 || code === "analytics/admin-credentials-missing" || code === "analytics/admin-credentials-invalid" || code === "analytics/salt-missing" || msg.includes("PERMISSION_DENIED") || msg.includes("Could not load the default credentials") || msg.includes("UNAUTHENTICATED") || msg.includes("Failed to parse private key") || msg.includes("Invalid PEM");
}

// src/serverApp.ts
dotenv.config();
var _adminAuthMap = /* @__PURE__ */ new Map();
var _googlePublicCerts = null;
var _googlePublicCertsExpiresAt = 0;
async function getGooglePublicCerts() {
  const now = Date.now();
  if (_googlePublicCerts && now < _googlePublicCertsExpiresAt) {
    return _googlePublicCerts;
  }
  try {
    const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    const cc = res.headers.get("cache-control") || "";
    const match = cc.match(/max-age=(\d+)/);
    const maxAge = match ? parseInt(match[1], 10) : 3600;
    _googlePublicCertsExpiresAt = now + maxAge * 1e3;
    _googlePublicCerts = await res.json();
    return _googlePublicCerts || {};
  } catch (e) {
    console.warn("[StorageServer] Failed to fetch Google public certs:", e);
    return _googlePublicCerts || {};
  }
}
async function verifyFirebaseTokenDirectly(idToken, candidateProjects) {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const unpaddedHeader = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const headerB64 = unpaddedHeader + "=".repeat((4 - unpaddedHeader.length % 4) % 4);
    const header = JSON.parse(Buffer.from(headerB64, "base64").toString("utf8"));
    const unpaddedPayload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payloadB64 = unpaddedPayload + "=".repeat((4 - unpaddedPayload.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    if (header.alg !== "RS256" || !header.kid) return null;
    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;
    const verifier = crypto2.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const unpaddedSig = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const sigB64 = unpaddedSig + "=".repeat((4 - unpaddedSig.length % 4) % 4);
    const sig = Buffer.from(sigB64, "base64");
    if (!verifier.verify(cert, sig)) return null;
    if (!candidateProjects.includes(payload.aud)) return null;
    if (payload.iss !== `https://securetoken.google.com/${payload.aud}`) return null;
    const nowSec = Math.floor(Date.now() / 1e3);
    if (payload.exp < nowSec - 300) return null;
    if (payload.iat > nowSec + 300) return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    return { uid: payload.sub, email: payload.email, aud: payload.aud };
  } catch {
    return null;
  }
}
function detectImageMimeType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return "image/jpeg";
  }
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return "image/png";
  }
  if (buffer[0] === 82 && buffer[1] === 73 && buffer[2] === 70 && buffer[3] === 70 && buffer[8] === 87 && buffer[9] === 69 && buffer[10] === 66 && buffer[11] === 80) {
    return "image/webp";
  }
  return null;
}
async function getVerifiedAdminAuth(targetProjectId) {
  const { initializeApp: initAdminApp, getApps: getAdminApps } = await import("firebase-admin/app");
  const { getAuth: getAdminAuth } = await import("firebase-admin/auth");
  const projectId = targetProjectId || "proton-core-ai";
  if (!_adminAuthMap.has(projectId)) {
    const existing = getAdminApps().find((a) => a.name === projectId || a.name === "[DEFAULT]" && a.options?.projectId === projectId);
    const adminApp = existing || initAdminApp({ projectId }, projectId);
    _adminAuthMap.set(projectId, getAdminAuth(adminApp));
  }
  return _adminAuthMap.get(projectId);
}
async function verifyBearerTokenFromRequest(req, customVerifier) {
  const authHeader = req.headers.authorization || req.headers["Authorization"];
  const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  if (!bearerMatch) {
    return { error: "Unauthorized: Missing or invalid Authorization header", status: 401 };
  }
  const idToken = bearerMatch[1].trim().replace(/^["']|["']$/g, "");
  if (!idToken) {
    return { error: "Unauthorized: Empty authentication token", status: 401 };
  }
  if (customVerifier) {
    try {
      const customResult = await customVerifier(idToken);
      if (customResult?.uid) return { uid: customResult.uid };
      return { error: "Unauthorized: Invalid or expired Firebase authentication token", status: 401, code: "auth/invalid-id-token" };
    } catch (e) {
      return { error: e?.message || "Unauthorized", status: 401, code: e?.code || "auth/invalid-id-token" };
    }
  }
  const tokenParts = idToken.split(".");
  if (tokenParts.length !== 3) {
    return { error: "Unauthorized: Invalid or expired Firebase authentication token", status: 401, code: "auth/invalid-id-token" };
  }
  let tokenAudience;
  try {
    const unpadded = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - unpadded.length % 4) % 4;
    const base64 = unpadded + "=".repeat(padLength);
    const parsedPayload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    tokenAudience = parsedPayload.aud || (typeof parsedPayload.iss === "string" ? parsedPayload.iss.replace("https://securetoken.google.com/", "") : void 0);
  } catch {
  }
  const candidateProjects = [];
  if (tokenAudience && typeof tokenAudience === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(tokenAudience)) {
    candidateProjects.push(tokenAudience);
  }
  for (const proj of [
    "proton-core-ai",
    "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51",
    process.env.VITE_FIREBASE_PROJECT_ID,
    process.env.FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT
  ].filter(Boolean)) {
    if (!candidateProjects.includes(proj)) candidateProjects.push(proj);
  }
  try {
    const directResult = await verifyFirebaseTokenDirectly(idToken, candidateProjects);
    if (directResult?.uid) return { uid: directResult.uid };
  } catch {
  }
  for (const projId of candidateProjects) {
    try {
      const authInstance = await getVerifiedAdminAuth(projId);
      const decoded = await authInstance.verifyIdToken(idToken);
      if (decoded?.uid) return { uid: decoded.uid };
    } catch {
    }
  }
  return { error: "Unauthorized: Invalid or expired Firebase authentication token", status: 401, code: "auth/invalid-id-token" };
}
function createApiApp(options) {
  const app2 = express();
  const analyticsService = options?.analyticsService || new MarketAnalyticsService();
  app2.set("trust proxy", 1);
  app2.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    xFrameOptions: false,
    originAgentCluster: false
  }));
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 150,
    // limit each IP to 150 API calls per window
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
  app2.use(express.json({ limit: "10mb" }));
  const cacheControlMiddleware = (req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };
  const apiRouter = express.Router();
  apiRouter.use(cacheControlMiddleware);
  apiRouter.use("/gemini", apiLimiter);
  const healthHandler = (req, res) => {
    const hasSupabaseServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: {
        supabaseServiceRoleKey: hasSupabaseServiceKey ? "configured" : "missing",
        geminiApiKey: hasGeminiKey ? "configured" : "missing",
        platform: process.env.VERCEL ? "vercel" : "server"
      }
    });
  };
  apiRouter.get("/health", healthHandler);
  const uploadHandler = async (req, res) => {
    const authHeader = req.headers.authorization || req.headers["Authorization"];
    const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    if (!bearerMatch) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
    }
    const idToken = bearerMatch[1].trim().replace(/^["']|["']$/g, "");
    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Empty authentication token" });
    }
    const tokenParts = idToken.split(".");
    if (tokenParts.length !== 3) {
      console.warn("[StorageServer] Token rejected: malformed JWT structure (expected 3 dot-separated segments)");
      return res.status(401).json({
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        reason: "Malformed JWT structure. Expected 3 segments."
      });
    }
    let tokenAudience;
    try {
      const unpadded = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padLength = (4 - unpadded.length % 4) % 4;
      const base64 = unpadded + "=".repeat(padLength);
      const payloadJson = Buffer.from(base64, "base64").toString("utf8");
      const parsedPayload = JSON.parse(payloadJson);
      tokenAudience = parsedPayload.aud || (typeof parsedPayload.iss === "string" ? parsedPayload.iss.replace("https://securetoken.google.com/", "") : void 0);
    } catch (e) {
      console.warn("[StorageServer] Could not parse token payload:", e);
    }
    const candidateProjects = [];
    if (tokenAudience && typeof tokenAudience === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(tokenAudience)) {
      candidateProjects.push(tokenAudience);
    }
    const standardProjects = [
      "proton-core-ai",
      "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51",
      process.env.VITE_FIREBASE_PROJECT_ID,
      process.env.FIREBASE_PROJECT_ID,
      process.env.GCLOUD_PROJECT
    ].filter(Boolean);
    for (const proj of standardProjects) {
      if (!candidateProjects.includes(proj)) {
        candidateProjects.push(proj);
      }
    }
    if (candidateProjects.length === 0) {
      candidateProjects.push("proton-core-ai");
    }
    let decodedToken = null;
    let lastAuthError = null;
    try {
      const directResult = await verifyFirebaseTokenDirectly(idToken, candidateProjects);
      if (directResult && directResult.uid) {
        decodedToken = directResult;
      }
    } catch (e) {
      console.warn("[StorageServer] Direct public cert verification attempt notice:", e?.message);
    }
    if (!decodedToken || !decodedToken.uid) {
      for (const projId of candidateProjects) {
        try {
          const authInstance = await getVerifiedAdminAuth(projId);
          decodedToken = await authInstance.verifyIdToken(idToken);
          if (decodedToken && decodedToken.uid) {
            break;
          }
        } catch (authErr) {
          lastAuthError = authErr;
        }
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
    const { image, productId } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Bad Request: Image data is required" });
    }
    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Bad Request: Invalid image format. Must be a valid Base64 data URI." });
    }
    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];
    const ALLOWED_MIME_TYPES = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return res.status(400).json({
        error: `Bad Request: Unsupported image format (${mimeType}). Allowed formats are JPEG, PNG, and WebP.`
      });
    }
    const buffer = Buffer.from(base64Data, "base64");
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `Bad Request: Image exceeds 5 MB limit. Received size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.`
      });
    }
    const detectedMimeType = detectImageMimeType(buffer);
    if (!detectedMimeType) {
      return res.status(400).json({
        error: "Bad Request: Invalid image content. Magic bytes do not match an allowed image type (JPEG, PNG, WebP).",
        code: "storage/invalid-magic-bytes"
      });
    }
    const ext = detectedMimeType === "image/jpeg" ? "jpg" : detectedMimeType === "image/png" ? "png" : "webp";
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ntndwrpruyrttlpjptzf.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const timestamp = Date.now();
    const randomSuffix = crypto2.randomUUID().replace(/-/g, "").substring(0, 10);
    const cleanProdId = typeof productId === "string" ? productId.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 32) : "prod";
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
      const { data, error: uploadErr } = await supabaseAdmin.storage.from("listings").upload(storagePath, buffer, {
        contentType: detectedMimeType,
        upsert: true
      });
      if (uploadErr) {
        console.error("[StorageServer] Supabase storage upload failed:", uploadErr.message);
        return res.status(502).json({
          error: `Storage service error: ${uploadErr.message}`,
          code: "storage/upload-failed"
        });
      }
      const { data: publicUrlData } = supabaseAdmin.storage.from("listings").getPublicUrl(storagePath);
      return res.status(200).json({
        success: true,
        publicUrl: publicUrlData.publicUrl,
        path: storagePath
      });
    } catch (err) {
      console.error("[StorageServer] Unexpected error during upload:", err);
      return res.status(500).json({ error: "Internal server error during image storage" });
    }
  };
  apiRouter.get("/storage/file/:uid/:filename", async (req, res) => {
    const { uid, filename } = req.params;
    const uidRegex = /^[a-zA-Z0-9_-]{1,128}$/;
    const filenameRegex = /^[a-zA-Z0-9_.-]{1,128}$/;
    if (!uid || !filename || !uidRegex.test(uid) || !filenameRegex.test(filename) || uid.includes("..") || filename.includes("..")) {
      return res.status(400).json({ error: "Bad Request: Invalid path parameters", code: "storage/invalid-path" });
    }
    const storagePath = `${uid}/${filename}`;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ntndwrpruyrttlpjptzf.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    try {
      if (serviceRoleKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data, error } = await supabaseAdmin.storage.from("listings").download(storagePath);
        if (error || !data) {
          return res.status(404).json({ error: "Not Found: Image not found in storage", code: "storage/object-not-found" });
        }
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = detectImageMimeType(buffer) || (data.type || "application/octet-stream");
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buffer);
      } else {
        const publicFetchUrl = `${supabaseUrl}/storage/v1/object/public/listings/${storagePath}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6e3);
        let supRes;
        try {
          supRes = await fetch(publicFetchUrl, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
        if (!supRes.ok) {
          let isNotFound = supRes.status === 404;
          try {
            const errJson = await supRes.json();
            if (errJson.statusCode === "404" || errJson.statusCode === 404 || errJson.error === "not_found" || errJson.code === "NoSuchKey" || typeof errJson.message === "string" && errJson.message.toLowerCase().includes("not found")) {
              isNotFound = true;
            }
          } catch {
          }
          return res.status(isNotFound ? 404 : 503).json({
            error: isNotFound ? "Not Found: Image not found in storage" : "Storage service unavailable",
            code: isNotFound ? "storage/object-not-found" : "storage/service-unavailable"
          });
        }
        const arrayBuffer = await supRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = detectImageMimeType(buffer) || (supRes.headers.get("content-type") || "application/octet-stream");
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buffer);
      }
    } catch (err) {
      console.warn(`[StorageServer] File retrieval notice for ${storagePath}:`, err?.message);
      return res.status(404).json({ error: "Not Found: Image not found in storage", code: "storage/object-not-found" });
    }
  });
  const deleteHandler = async (req, res) => {
    const authHeader = req.headers.authorization || req.headers["Authorization"];
    const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    if (!bearerMatch) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
    }
    const idToken = bearerMatch[1].trim().replace(/^["']|["']$/g, "");
    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Empty authentication token" });
    }
    const tokenParts = idToken.split(".");
    if (tokenParts.length !== 3) {
      return res.status(401).json({
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        reason: "Malformed JWT structure"
      });
    }
    let tokenAudience;
    try {
      const unpadded = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padLength = (4 - unpadded.length % 4) % 4;
      const base64 = unpadded + "=".repeat(padLength);
      const payloadJson = Buffer.from(base64, "base64").toString("utf8");
      const parsedPayload = JSON.parse(payloadJson);
      tokenAudience = parsedPayload.aud || (typeof parsedPayload.iss === "string" ? parsedPayload.iss.replace("https://securetoken.google.com/", "") : void 0);
    } catch {
    }
    const candidateProjects = [];
    if (tokenAudience && typeof tokenAudience === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(tokenAudience)) {
      candidateProjects.push(tokenAudience);
    }
    const standardProjects = [
      "proton-core-ai",
      "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51",
      process.env.VITE_FIREBASE_PROJECT_ID,
      process.env.FIREBASE_PROJECT_ID,
      process.env.GCLOUD_PROJECT
    ].filter(Boolean);
    for (const proj of standardProjects) {
      if (!candidateProjects.includes(proj)) candidateProjects.push(proj);
    }
    if (candidateProjects.length === 0) candidateProjects.push("proton-core-ai");
    let decodedToken = null;
    try {
      const directResult = await verifyFirebaseTokenDirectly(idToken, candidateProjects);
      if (directResult && directResult.uid) decodedToken = directResult;
    } catch {
    }
    if (!decodedToken || !decodedToken.uid) {
      for (const projId of candidateProjects) {
        try {
          const authInstance = await getVerifiedAdminAuth(projId);
          decodedToken = await authInstance.verifyIdToken(idToken);
          if (decodedToken && decodedToken.uid) break;
        } catch {
        }
      }
    }
    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        code: "auth/invalid-id-token"
      });
    }
    const verifiedUid = decodedToken.uid;
    const { path, url } = req.body || {};
    const target = path || url;
    if (!target || typeof target !== "string") {
      return res.status(400).json({ error: "Bad Request: 'path' or 'url' is required" });
    }
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
    normalizedPath = normalizedPath.replace(/^\/+/, "");
    if (normalizedPath.startsWith("listings/")) {
      normalizedPath = normalizedPath.substring("listings/".length);
    }
    normalizedPath = normalizedPath.split("?")[0].split("#")[0];
    const segments = normalizedPath.split("/");
    if (segments.some((s) => s === ".." || s === "." || s === "")) {
      return res.status(400).json({ error: "Bad Request: Path traversal or invalid path segments" });
    }
    if (!normalizedPath.startsWith(`${verifiedUid}/`)) {
      return res.status(403).json({
        error: "Forbidden: You are not authorized to delete images belonging to other users",
        code: "storage/ownership-mismatch"
      });
    }
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ntndwrpruyrttlpjptzf.supabase.co";
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
      const { data, error: delErr } = await supabaseAdmin.storage.from("listings").remove([normalizedPath]);
      if (delErr) {
        console.warn(`[StorageServer] Supabase deletion notice for ${normalizedPath}:`, delErr.message);
        return res.status(502).json({
          error: `Storage service error: ${delErr.message}`,
          code: "storage/deletion-failed"
        });
      }
      return res.status(200).json({
        success: true,
        deletedPath: normalizedPath
      });
    } catch (err) {
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
  const authenticateFirebaseUser = async (req) => {
    const authHeader = req.headers.authorization || req.headers["Authorization"];
    const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
    if (!bearerMatch) {
      return { error: "Unauthorized: Missing or invalid Authorization header", statusCode: 401 };
    }
    const idToken = bearerMatch[1].trim().replace(/^["']|["']$/g, "");
    if (!idToken) {
      return { error: "Unauthorized: Empty authentication token", statusCode: 401 };
    }
    const tokenParts = idToken.split(".");
    if (tokenParts.length !== 3) {
      return {
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        statusCode: 401,
        reason: "Malformed JWT structure. Expected 3 segments."
      };
    }
    let tokenAudience;
    try {
      const unpadded = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padLength = (4 - unpadded.length % 4) % 4;
      const base64 = unpadded + "=".repeat(padLength);
      const payloadJson = Buffer.from(base64, "base64").toString("utf8");
      const parsedPayload = JSON.parse(payloadJson);
      tokenAudience = parsedPayload.aud || (typeof parsedPayload.iss === "string" ? parsedPayload.iss.replace("https://securetoken.google.com/", "") : void 0);
    } catch (e) {
      console.warn("[StorageServer] Could not parse token payload:", e);
    }
    const candidateProjects = [];
    if (tokenAudience && typeof tokenAudience === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(tokenAudience)) {
      candidateProjects.push(tokenAudience);
    }
    const standardProjects = [
      "proton-core-ai",
      "ai-studio-01dfb83a-da41-4952-8647-6368b0e05d51",
      process.env.VITE_FIREBASE_PROJECT_ID,
      process.env.FIREBASE_PROJECT_ID,
      process.env.GCLOUD_PROJECT
    ].filter(Boolean);
    for (const proj of standardProjects) {
      if (!candidateProjects.includes(proj)) {
        candidateProjects.push(proj);
      }
    }
    if (candidateProjects.length === 0) {
      candidateProjects.push("proton-core-ai");
    }
    let decodedToken = null;
    let lastAuthError = null;
    try {
      const directResult = await verifyFirebaseTokenDirectly(idToken, candidateProjects);
      if (directResult && directResult.uid) {
        decodedToken = directResult;
      }
    } catch (e) {
      console.warn("[StorageServer] Direct public cert verification attempt notice:", e?.message);
    }
    if (!decodedToken || !decodedToken.uid) {
      for (const projId of candidateProjects) {
        try {
          const authInstance = await getVerifiedAdminAuth(projId);
          decodedToken = await authInstance.verifyIdToken(idToken);
          if (decodedToken && decodedToken.uid) {
            break;
          }
        } catch (authErr) {
          lastAuthError = authErr;
        }
      }
    }
    if (!decodedToken || !decodedToken.uid) {
      const errDetail = lastAuthError?.message || "Token verification rejected";
      return {
        error: "Unauthorized: Invalid or expired Firebase authentication token",
        statusCode: 401,
        reason: errDetail,
        code: lastAuthError?.code || "auth/invalid-id-token"
      };
    }
    return { uid: decodedToken.uid, email: decodedToken.email };
  };
  const createClipUploadUrlHandler = async (req, res) => {
    const authResult = await authenticateFirebaseUser(req);
    if ("error" in authResult) {
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
    const { fileExt, extension, mimeType, filename } = req.body || {};
    let ext = "mp4";
    const candidateExt = (fileExt || extension || (filename ? String(filename).split(".").pop() : ""))?.toLowerCase().replace(/^\./, "").trim();
    if (candidateExt === "mov" || candidateExt === "quicktime") {
      ext = "mov";
    } else if (candidateExt === "webm") {
      ext = "webm";
    } else if (candidateExt === "mp4") {
      ext = "mp4";
    } else if (typeof mimeType === "string") {
      const mt = mimeType.toLowerCase();
      if (mt.includes("webm")) ext = "webm";
      else if (mt.includes("quicktime") || mt.includes("mov")) ext = "mov";
      else if (mt.includes("mp4")) ext = "mp4";
      else {
        return res.status(400).json({
          error: "Bad Request: Unsupported video format. Allowed formats are mp4, mov, webm.",
          code: "storage/unsupported-video-format"
        });
      }
    } else if (candidateExt && !["mp4", "mov", "webm"].includes(candidateExt)) {
      return res.status(400).json({
        error: `Bad Request: Unsupported video extension (.${candidateExt}). Allowed formats are mp4, mov, webm.`,
        code: "storage/unsupported-video-format"
      });
    }
    const timestamp = Date.now();
    const uniqueSuffix = crypto2.randomUUID().replace(/-/g, "").substring(0, 8);
    const storagePath = `${verifiedUid}/clip_${timestamp}_${uniqueSuffix}.${ext}`;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ntndwrpruyrttlpjptzf.supabase.co";
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
      const { data, error: signError } = await supabaseAdmin.storage.from("clips").createSignedUploadUrl(storagePath);
      if (signError || !data?.signedUrl) {
        console.error("[StorageServer] Failed to create signed upload URL:", signError?.message);
        return res.status(502).json({
          error: "Storage service error: Failed to create signed upload URL",
          code: "storage/signed-url-failed"
        });
      }
      const { data: publicData } = supabaseAdmin.storage.from("clips").getPublicUrl(storagePath);
      return res.status(200).json({
        success: true,
        signedUrl: data.signedUrl,
        token: data.token,
        path: storagePath,
        publicUrl: publicData.publicUrl
      });
    } catch (err) {
      console.error("[StorageServer] Unexpected error generating signed upload URL:", err);
      return res.status(500).json({ error: "Internal server error during upload URL generation" });
    }
  };
  const deleteClipVideoHandler = async (req, res) => {
    const authResult = await authenticateFirebaseUser(req);
    if ("error" in authResult) {
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
    const { path, url } = req.body || {};
    const target = path || url;
    if (!target || typeof target !== "string") {
      return res.status(400).json({ error: "Bad Request: 'path' or 'url' is required" });
    }
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
    normalizedPath = normalizedPath.replace(/^\/+/, "");
    if (normalizedPath.startsWith("clips/")) {
      normalizedPath = normalizedPath.substring("clips/".length);
    }
    normalizedPath = normalizedPath.split("?")[0].split("#")[0];
    const segments = normalizedPath.split("/");
    if (segments.length !== 2 || segments.some((s) => s === ".." || s === "." || !s.trim())) {
      return res.status(400).json({
        error: "Bad Request: Path traversal or invalid path format. Expected format: '{userId}/{filename}'",
        code: "storage/invalid-path"
      });
    }
    const [folderUid, filename] = segments;
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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ntndwrpruyrttlpjptzf.supabase.co";
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
      const { data, error: delErr } = await supabaseAdmin.storage.from("clips").remove([normalizedPath]);
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
    } catch (err) {
      console.error("[StorageServer] Unexpected error during clip deletion:", err);
      return res.status(500).json({ error: "Internal server error during clip deletion" });
    }
  };
  apiRouter.post("/storage/create-clip-upload-url", createClipUploadUrlHandler);
  apiRouter.post("/storage/delete-clip-video", deleteClipVideoHandler);
  const geminiHandler = async (req, res) => {
    const { action, args } = req.body || {};
    const customApiKey = req.headers["x-custom-api-key"];
    try {
      let result;
      switch (action) {
        case "chatWithPersona":
          result = await chatWithPersona(
            args[0],
            args[1],
            args[2],
            args[3],
            args[4],
            args[5],
            args[6],
            args[7],
            args[8],
            customApiKey
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
    } catch (error) {
      console.warn(`Gemini Request [action: ${action}] was handled via fallback/user configuration message:`, error);
      const errStr = error.message || String(error);
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("limit") || errStr.includes("RESOURCE_EXHAUSTED")) {
        const errorMsg = JSON.stringify({
          isQuotaError: true,
          messageEn: `Quota Exceeded (Error 429). The shared environment API key has reached its direct rate limit. Please navigate to the "System Settings" panel in the top-right \u2699\uFE0F and configure your own custom Gemini API Key to bypass this shared limit immediately. Thanks for your understanding!`,
          messageKa: `Quota Exceeded (Error 429). The shared environment API key has reached its direct rate limit. Please navigate to the "System Settings" panel in the top-right \u2699\uFE0F and configure your own custom Gemini API Key to bypass this shared limit immediately. Thanks for your understanding!`
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
  const analyticsEventLimiter = rateLimit({
    windowMs: 60 * 1e3,
    // 1 minute
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
    windowMs: 60 * 1e3,
    // 1 minute
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
  apiRouter.post("/market/listing-event", analyticsEventLimiter, async (req, res) => {
    try {
      const hasAuthHeader = Boolean(req.headers.authorization || req.headers["Authorization"]);
      let verifiedUid = null;
      if (hasAuthHeader) {
        const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken);
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
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : void 0,
        clientIp: req.ip
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
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
  apiRouter.get("/market/listing-stats", analyticsReadLimiter, async (req, res) => {
    try {
      const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken);
      if (!authRes.uid) {
        return res.status(authRes.status || 401).json({
          error: authRes.error || "Unauthorized",
          code: authRes.code || "auth/invalid-id-token"
        });
      }
      const listingId = typeof req.query.listingId === "string" && req.query.listingId.trim() ? req.query.listingId.trim() : void 0;
      const result = await analyticsService.getSellerStats({
        verifiedUid: authRes.uid,
        listingId
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
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
  apiRouter.get("/market/rankings", analyticsReadLimiter, async (req, res) => {
    try {
      const result = await analyticsService.getRankings({
        scope: typeof req.query.scope === "string" ? req.query.scope : "global",
        period: typeof req.query.period === "string" ? req.query.period : "7d",
        listingType: typeof req.query.listingType === "string" ? req.query.listingType : void 0,
        category: typeof req.query.category === "string" ? req.query.category : void 0,
        country: typeof req.query.country === "string" ? req.query.country : void 0,
        region: typeof req.query.region === "string" ? req.query.region : void 0
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
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
  apiRouter.post("/market/competition-preference", analyticsReadLimiter, async (req, res) => {
    try {
      const authRes = await verifyBearerTokenFromRequest(req, options?.verifyIdToken);
      if (!authRes.uid) {
        return res.status(authRes.status || 401).json({
          error: authRes.error || "Unauthorized",
          code: authRes.code || "auth/invalid-id-token"
        });
      }
      const { optedOut } = req.body || {};
      if (typeof optedOut !== "boolean") {
        return res.status(400).json({ error: "Bad Request: 'optedOut' boolean is required" });
      }
      const result = await analyticsService.updateCompetitionOptOut({
        verifiedUid: authRes.uid,
        optedOut
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
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
  app2.use("/api", apiRouter);
  app2.use(apiRouter);
  app2.use("/api", (req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `API endpoint not found: ${req.method} /api${req.path}`,
      path: `/api${req.path}`
    });
  });
  app2.use((err, req, res, next) => {
    console.error("[ServerError]:", err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: "Server Error",
        message: err?.message || "An unexpected error occurred"
      });
    }
  });
  return app2;
}
var app = createApiApp();
var serverApp_default = app;

// src/serverlessEntry.ts
var ROOT_REWRITE_PATHS = /* @__PURE__ */ new Set([
  "/api",
  "/api/",
  "/",
  "",
  "/api/index",
  "/api/index.js"
]);
function stripRewriteParams(searchParams) {
  const cleaned = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== "1" && key !== "path") {
      cleaned.append(key, value);
    }
  });
  return cleaned;
}
function handler(req, res) {
  try {
    const rawUrl = typeof req.url === "string" ? req.url : "/";
    let parsedIncoming;
    try {
      parsedIncoming = new URL(rawUrl, "http://localhost");
    } catch {
      parsedIncoming = new URL("/", "http://localhost");
    }
    const originalParams = stripRewriteParams(parsedIncoming.searchParams);
    const prePopulatedQuery = req.query;
    if (prePopulatedQuery && typeof prePopulatedQuery === "object") {
      for (const [k, v] of Object.entries(prePopulatedQuery)) {
        if (k === "1" || k === "path" || originalParams.has(k)) continue;
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item !== void 0 && item !== null) {
              originalParams.append(k, String(item));
            }
          }
        } else if (v !== void 0 && v !== null) {
          originalParams.append(k, String(v));
        }
      }
    }
    if (ROOT_REWRITE_PATHS.has(parsedIncoming.pathname)) {
      let resolvedPath = null;
      let headerParams = null;
      const headerCandidate = req.headers["x-forwarded-uri"] || req.headers["x-invoke-path"] || req.headers["x-matched-path"] || req.headers["x-forwarded-url"] || req.headers["x-original-url"] || req.headers["x-vercel-matched-path"];
      if (typeof headerCandidate === "string" && headerCandidate.trim()) {
        try {
          const parsedHeader = new URL(headerCandidate.trim(), "http://localhost");
          const candidatePath = parsedHeader.pathname;
          if ((candidatePath.startsWith("/api/") || candidatePath.startsWith("/")) && !ROOT_REWRITE_PATHS.has(candidatePath)) {
            resolvedPath = candidatePath.startsWith("/api") ? candidatePath : `/api${candidatePath}`;
            headerParams = stripRewriteParams(parsedHeader.searchParams);
          }
        } catch {
        }
      }
      if (!resolvedPath && typeof req.headers["x-now-route-matches"] === "string") {
        const match = req.headers["x-now-route-matches"].match(/(?:^|&)1=([^&]+)/);
        if (match && match[1]) {
          const subPath = decodeURIComponent(match[1]);
          const cleanSub = subPath.split("?")[0].replace(/^\/+/, "");
          if (cleanSub) {
            resolvedPath = `/api/${cleanSub}`;
          }
        }
      }
      if (!resolvedPath) {
        const pathParam = parsedIncoming.searchParams.get("path") || parsedIncoming.searchParams.get("1") || (typeof prePopulatedQuery?.path === "string" ? prePopulatedQuery.path : void 0) || (typeof prePopulatedQuery?.["1"] === "string" ? prePopulatedQuery["1"] : void 0);
        if (pathParam) {
          const cleanSub = pathParam.split("?")[0].replace(/^\/+/, "");
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
      } else if (req.method === "GET" || req.method === "HEAD") {
        req.url = qs ? `/api/health?${qs}` : "/api/health";
      }
    } else if (parsedIncoming.searchParams.has("1") || parsedIncoming.searchParams.has("path")) {
      const qs = originalParams.toString();
      req.url = qs ? `${parsedIncoming.pathname}?${qs}` : parsedIncoming.pathname;
    }
    if ("_parsedUrl" in req) {
      try {
        delete req._parsedUrl;
      } catch {
      }
    }
    if ("query" in req) {
      try {
        delete req.query;
      } catch {
        if (req.query && typeof req.query === "object") {
          try {
            delete req.query["1"];
          } catch {
          }
          try {
            delete req.query["path"];
          } catch {
          }
        }
      }
    }
    return serverApp_default(req, res);
  } catch (err) {
    console.error("[Vercel Serverless Invocation Caught Error]:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error in Serverless Handler",
        message: err?.message || String(err)
      });
    }
  }
}
export {
  serverApp_default as app,
  handler as default,
  handler
};
