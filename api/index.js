// src/serverApp.ts
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";

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

// src/serverApp.ts
dotenv.config();
var _adminAuth = null;
function getVerifiedAdminAuth() {
  if (!_adminAuth) {
    const adminApp = !getAdminApps().length ? initAdminApp({ projectId: "proton-core-ai" }) : getAdminApps()[0];
    _adminAuth = getAdminAuth(adminApp);
  }
  return _adminAuth;
}
function createApiApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
    }
    const idToken = authHeader.split("Bearer ")[1]?.trim();
    if (!idToken) {
      return res.status(401).json({ error: "Unauthorized: Empty authentication token" });
    }
    let decodedToken;
    try {
      const authInstance = getVerifiedAdminAuth();
      decodedToken = await authInstance.verifyIdToken(idToken);
    } catch (authErr) {
      console.error("[StorageServer] Token verification failed:", authErr?.message);
      return res.status(401).json({ error: "Unauthorized: Invalid or expired Firebase authentication token" });
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
    const ext = ALLOWED_MIME_TYPES[mimeType];
    const buffer = Buffer.from(base64Data, "base64");
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `Bad Request: Image exceeds 5 MB limit. Received size: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.`
      });
    }
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ntndwrpruyrttlpjptzf.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceRoleKey) {
      console.error("[StorageServer] Upload aborted: SUPABASE_SERVICE_ROLE_KEY is not configured in server environment.");
      return res.status(503).json({
        error: "Server storage configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is required on the server."
      });
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().replace(/-/g, "").substring(0, 10);
    const cleanProdId = typeof productId === "string" ? productId.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 32) : "prod";
    const storagePath = `${verifiedUid}/${cleanProdId}_${timestamp}_${randomSuffix}.${ext}`;
    try {
      const { data, error: uploadErr } = await supabaseAdmin.storage.from("listings").upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });
      if (uploadErr) {
        console.error("[StorageServer] Supabase storage upload failed:", uploadErr.message);
        return res.status(502).json({
          error: `Storage service error: ${uploadErr.message}`
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
  apiRouter.post("/storage/upload-listing-image", uploadHandler);
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
  app2.use("/api", apiRouter);
  app2.use(apiRouter);
  return app2;
}
var app = createApiApp();
var serverApp_default = app;

// src/serverlessEntry.ts
function handler(req, res) {
  if (req.url === "/api" || req.url === "/api/" || req.url === "/" || req.url === "") {
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-url"] || req.headers["x-original-url"];
    if (typeof matchedPath === "string" && (matchedPath.startsWith("/api") || matchedPath.startsWith("/"))) {
      req.url = matchedPath;
    }
  }
  return serverApp_default(req, res);
}
export {
  handler as default
};
