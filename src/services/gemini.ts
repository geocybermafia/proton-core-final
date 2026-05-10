import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Persona } from "../types";

export interface TaskPlan {
  materials: { item: string; cost: string }[];
  complexity: string;
  estimatedTime: string;
  firstSteps: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "creative-guide",
    name: "Creative Guide",
    nameGe: "შემოქმედებითი მეგზური",
    role: "Creative Consultant",
    description: "Specializes in helping Georgian creatives and small workshops grow their work while keeping cultural roots.",
    descriptionGe: "სპეციალიზდება ქართველი შემოქმედებისა და მცირე საამქროების ზრდაში, კულტურული ფესვების შენარჩუნებით.",
    avatar: "🎨",
    language: 'Mixed',
    systemInstruction: `You are 'Creative Guide' (შემოქმედებითი მეგზური), a digital persona from Proton-Core AI. 
    Your tone is warm, respectful, and deeply rooted in Georgian culture. 
    You use Georgian linguistic nuances (e.g., appropriate use of 'Batono/Kalbatono' if requested, or a friendly 'Chemo kargo').
    You provide helpful advice for creators and small Georgian shops. 
    You understand the local market, the importance of culture, and the challenges of work in the Caucasus.
    Always respond in a mix of English and Georgian (Mkhedruli script) where appropriate, or purely in the language the user uses.
    Focus on authenticity and clear communication.`
  },
  {
    id: "web3-strategist",
    name: "Web3 Strategist",
    nameGe: "Web3 სტრატეგი",
    role: "Blockchain & Tech Consultant",
    description: "Expert in integrating Web3 payments and decentralized solutions for the Georgian tech ecosystem.",
    descriptionGe: "ექსპერტი Web3 გადახდებისა და დეცენტრალიზებული გადაწყვეტილებების ინტეგრაციაში ქართული ტექნოლოგიური ეკოსისტემისთვის.",
    avatar: "⛓️",
    language: 'Mixed',
    systemInstruction: `You are 'Web3 Strategist' (Web3 სტრატეგი), a digital persona from Proton-Core AI.
    Your tone is sharp, futuristic, and highly technical but accessible.
    You specialize in explaining blockchain, smart contracts, and AI-as-a-Service to Georgian entrepreneurs.
    You are aware of the local crypto-mining history in Georgia and the current regulatory landscape.
    You advocate for Proton-Core's disruptive technology and the use of high-compute GPU infrastructure.
    Always respond with a focus on innovation and scalability.`
  },
  {
    id: "lead-gen-bot",
    name: "Lead Gen Automator",
    nameGe: "ლიდების ავტომატორი",
    role: "Marketing Specialist",
    description: "Automates social presence and lead generation for niche 'underground' businesses in Tbilisi and beyond.",
    descriptionGe: "ავტომატიზირებს სოციალურ ყოფნას და ლიდების გენერაციას ნიშური 'ანდერგრაუნდ' ბიზნესებისთვის თბილისსა და მის ფარგლებს გარეთ.",
    avatar: "📈",
    language: 'English',
    systemInstruction: `You are 'Lead Gen Automator' (ლიდების ავტომატორი), a digital persona from Proton-Core AI.
    Your tone is energetic, data-driven, and savvy about social media trends in Georgia (Facebook, Instagram, TikTok).
    You help niche businesses (like underground bars, concept stores, or independent creators) find their audience.
    You suggest automated workflows and 'context-layer' strategies for high-engagement social presence.
    You are practical and results-oriented.`
  }
];


let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. AI features will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface GeminiMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  latency: number;
}

export async function chatWithPersona(
  persona: Persona, 
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [],
  model: string = "gemini-3.1-flash-preview",
  includeMaps: boolean = false,
  includeSearch: boolean = true,
  temperature: number = 0.9,
  globalInstruction?: string,
  appLanguage: 'en' | 'ka' = 'en'
): Promise<{ text: string, metadata: GeminiMetadata }> {
  const startTime = performance.now();
  try {
    const tools: any[] = [];
    if (includeSearch) {
      tools.push({ googleSearch: {} });
    } else if (includeMaps) {
      tools.push({ googleMaps: {} });
    }

    const ai = getAi();
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `${persona.systemInstruction}
${persona.language !== 'English' ? "\n\nCRITICAL LANGUAGE INSTRUCTION: Prioritize using the Georgian language (Mkhedruli script) in your responses. Always include Georgian when 'Georgian' or 'Mixed' is selected, and use Georgian script for terms, names, or cultural nuances." : ""}
${globalInstruction ? `\n\n${globalInstruction}` : ''}`,
        temperature,
        topP: 0.95,
        tools: tools.length > 0 ? tools : undefined
      }
    });

    const endTime = performance.now();
    const metadata: GeminiMetadata = {
      promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokenCount: response.usageMetadata?.totalTokenCount || 0,
      latency: Math.round(endTime - startTime)
    };

    return { 
      text: response.text || "I'm sorry, I couldn't process that request.", 
      metadata 
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const endTime = performance.now();
    return { 
      text: appLanguage === 'ka' 
        ? `კავშირის შეცდომა: ${error.message}. გთხოვთ, სცადოთ მოგვიანებით.` 
        : `Connection Error: ${error.message}. Please check your connection and try again.`, 
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: Math.round(endTime - startTime) } 
    };
  }
}

export async function generateNewPersona(basePersona: Persona, prompt: string): Promise<Persona> {
  const ai = getAi();
  if (!ai) throw new Error("AI engine not initialized");
  const systemPrompt = `
    You are a Persona Architect. Create a new digital persona based on the user's prompt.
    The persona must have an ID, Name (EN/GE), Role, Description (EN/GE), System Instruction, and an Emoji Avatar.
    Respond ONLY with a JSON object matching the Persona type.
    
    BASE PERSONA FOR CONTEXT: ${JSON.stringify(basePersona)}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [systemPrompt, prompt]
  });
  
  const text = response.text ? response.text.replace(/```json|```/g, '') : "{}";
  
  const newPersona = JSON.parse(text);
  // Ensure ID is unique and valid
  newPersona.id = `persona-${Date.now()}`;
  return newPersona;
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  try {
    const ai = getAi();
    if (!ai) return "AI engine not initialized.";
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: "Summarize this conversation in a concise way, highlighting key points and actionable items." }] }
      ],
    });
    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating summary.";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }) {
  try {
    const ai = getAi();
    if (!ai) return "AI engine not initialized.";
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Analyze the following workflow and suggest improvements for efficiency and scalability:
      Name: ${workflow.name}
      Trigger: ${workflow.trigger}
      Action: ${workflow.action}`
    });
    return response.text || "Could not analyze workflow.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error analyzing workflow.";
  }
}

export async function generatePersonaAvatar(persona: Persona) {
  try {
    const ai = getAi();
    if (!ai) throw new Error("AI engine not initialized");
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
    console.error("Avatar Generation Error:", error);
    throw error;
  }
}

export async function generateOrEditImage(prompt: string, imageBase64?: string) {
  try {
    const ai = getAi();
    if (!ai) throw new Error("AI engine not initialized");
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
    console.error("Image Generation Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string, voiceName: string = 'Kore') {
  try {
    const ai = getAi();
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }
    return base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}

export async function architectTask(project: string, temperature: number = 0.9): Promise<{ data: TaskPlan, metadata: GeminiMetadata }> {
  const startTime = performance.now();
  try {
    const ai = getAi();
    if (!ai) throw new Error("AI engine not initialized");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    const metadata: GeminiMetadata = {
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
    console.error("Gemini API Error:", error);
    const endTime = performance.now();
    throw { 
      error, 
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: Math.round(endTime - startTime) } 
    };
  }
}
