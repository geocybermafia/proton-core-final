export type Persona = {
  id: string;
  name: string;
  nameGe: string;
  role: string;
  description: string;
  descriptionGe: string;
  systemInstruction: string;
  avatar: string;
  language: 'English' | 'Georgian' | 'Mixed';
};

export interface TaskPlan {
  materials: { item: string; cost: string }[];
  complexity: string;
  estimatedTime: string;
  firstSteps: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "artisan-guide",
    name: "Artisan Guide",
    nameGe: "ხელოსნის მეგზური",
    role: "Local Business Consultant",
    description: "Specializes in helping Georgian artisans and small workshops scale their business while preserving cultural heritage.",
    descriptionGe: "სპეციალიზდება ქართველი ხელოსნებისა და მცირე საამქროების ბიზნესის გაფართოებაში, კულტურული მემკვიდრეობის შენარჩუნებით.",
    avatar: "🏺",
    language: 'Mixed',
    systemInstruction: `You are 'Artisan Guide' (ხელოსნის მეგზური), a digital persona from Proton-Core AI. 
    Your tone is warm, respectful, and deeply rooted in Georgian culture. 
    You use Georgian linguistic nuances (e.g., appropriate use of 'Batono/Kalbatono' if requested, or a friendly 'Chemo kargo').
    You provide business advice for small Georgian enterprises. 
    You understand the local market, the importance of 'Supra' culture in networking, and the challenges of logistics in the Caucasus.
    Always respond in a mix of English and Georgian (Mkhedruli script) where appropriate, or purely in the language the user uses.
    Focus on authenticity and high-engagement communication.`
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

// Helper for API calls with logging
async function callGeminiApi(endpoint: string, body: any) {
  console.log(`[Client] Calling ${endpoint}`, body);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorData = await response.json();
        errorDetail = errorData.error || errorData.message || JSON.stringify(errorData);
      } catch (e) {
        errorDetail = await response.text();
      }
      throw new Error(`[Server] ${errorDetail || `Status ${response.status}`}`);
    }
    
    const result = await response.json();
    console.log(`[Client] Response from ${endpoint}:`, result);
    return result;
  } catch (error: any) {
    console.error(`[Client] API Error (${endpoint}):`, error);
    if (error.message.includes("Failed to fetch")) {
      throw new Error("Network connection failed. Verify the server is running and accessible.");
    }
    throw error;
  }
}

export async function chatWithPersona(
  persona: Persona, 
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[] = [],
  model: string = "gemini-3-flash-preview",
  includeMaps: boolean = false,
  includeSearch: boolean = true,
  temperature: number = 0.8,
  globalInstruction?: string
) {
  try {
    const data = await callGeminiApi('/api/gemini/chat', {
      persona, message, history, model, includeMaps, includeSearch, temperature, globalInstruction
    });
    return data.text;
  } catch (error: any) {
    return `System Error: ${error.message}. Please verify the server connection and API key configuration.`;
  }
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  try {
    const data = await callGeminiApi('/api/gemini/summarize', { history });
    return data.text;
  } catch (error) {
    return "Error generating summary.";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }) {
  try {
    const data = await callGeminiApi('/api/gemini/analyze-workflow', { workflow });
    return data.text;
  } catch (error) {
    return "Error analyzing workflow.";
  }
}

export async function generatePersonaAvatar(persona: Persona) {
  try {
    const data = await callGeminiApi('/api/gemini/generate-avatar', { persona });
    return data.data;
  } catch (error: any) {
    throw error;
  }
}

export async function generateOrEditImage(prompt: string, imageBase64?: string) {
  try {
    const data = await callGeminiApi('/api/gemini/generate-image', { prompt, imageBase64 });
    return data.data;
  } catch (error: any) {
    throw error;
  }
}

export async function generateSpeech(text: string, voiceName: string = 'Kore') {
  try {
    const data = await callGeminiApi('/api/gemini/tts', { text, voiceName });
    return data.data;
  } catch (error: any) {
    throw error;
  }
}

export async function architectTask(project: string): Promise<TaskPlan> {
  try {
    return await callGeminiApi('/api/gemini/architect', { project });
  } catch (error) {
    throw error;
  }
}
