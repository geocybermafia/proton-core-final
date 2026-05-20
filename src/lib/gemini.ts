import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Persona, GeminiMetadata } from "../types";

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



async function callServerGemini<T>(action: string, args: any[]): Promise<T> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, args })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function chatWithPersona(
  persona: Persona, 
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [],
  model: string = "gemini-1.5-flash",
  includeMaps: boolean = false,
  includeSearch: boolean = true,
  temperature: number = 0.9,
  globalInstruction?: string,
  appLanguage: 'en' | 'ka' = 'en'
): Promise<{ text: string, metadata: GeminiMetadata }> {
  try {
    return await callServerGemini<{ text: string, metadata: GeminiMetadata }>('chatWithPersona', [
      persona, message, history, model, includeMaps, includeSearch, temperature, globalInstruction, appLanguage
    ]);
  } catch (error: any) {
    console.error("Gemini API Client Proxy Error:", error);
    return {
      text: appLanguage === 'ka' 
        ? `კავშირის შეცდომა: ${error.message || error}. გთხოვთ, სცადოთ მოგვიანებით.` 
        : `Connection Error: ${error.message || error}. Please check your connection and try again.`, 
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: 0 } 
    };
  }
}

export async function generateNewPersona(basePersona: Persona, prompt: string): Promise<Persona> {
  return callServerGemini<Persona>('generateNewPersona', [basePersona, prompt]);
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  try {
    return await callServerGemini<string>('summarizeConversation', [history]);
  } catch (error) {
    console.error("summarizeConversation Proxy Error:", error);
    return "Error generating summary.";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }) {
  try {
    return await callServerGemini<string>('analyzeWorkflow', [workflow]);
  } catch (error) {
    console.error("analyzeWorkflow Proxy Error:", error);
    return "Error analyzing workflow.";
  }
}

export async function generatePersonaAvatar(persona: Persona) {
  return callServerGemini<string>('generatePersonaAvatar', [persona]);
}

export async function generateOrEditImage(prompt: string, imageBase64?: string) {
  return callServerGemini<string>('generateOrEditImage', [prompt, imageBase64]);
}

export async function generateSpeech(text: string, voiceName: string = 'Kore') {
  return callServerGemini<string>('generateSpeech', [text, voiceName]);
}

export async function translateText(
  text: string,
  sourceRole: 'Visitor' | 'Creative',
  targetLanguage: 'Georgian' | 'English',
  systemInstruction: string
): Promise<string> {
  return callServerGemini<string>('translateText', [text, sourceRole, targetLanguage, systemInstruction]);
}

export async function architectTask(project: string, temperature: number = 0.9): Promise<{ data: TaskPlan, metadata: GeminiMetadata }> {
  return callServerGemini<{ data: TaskPlan, metadata: GeminiMetadata }>('architectTask', [project, temperature]);
}

