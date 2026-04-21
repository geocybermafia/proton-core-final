
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
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, message, history, model, includeSearch, includeMaps, temperature, globalInstruction })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Server error');
    }
    
    const data = await response.json();
    return data.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    return "Error connecting to Proton Core AI. Please check your internet connection or login again.";
  }
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  try {
    const response = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history })
    });
    const data = await response.json();
    return data.text || "Could not generate summary.";
  } catch (error) {
    console.error("Summary Error:", error);
    return "Error generating summary.";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }) {
  try {
    const response = await fetch('/api/ai/analyze-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow })
    });
    const data = await response.json();
    return data.text || "Could not analyze workflow.";
  } catch (error) {
    console.error("Workflow Analysis Error:", error);
    return "Error analyzing workflow.";
  }
}

export async function generatePersonaAvatar(persona: Persona) {
  try {
    const response = await fetch('/api/ai/generate-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona })
    });
    const data = await response.json();
    if (data.image) return data.image;
    throw new Error(data.error || "No image data returned from Gemini API");
  } catch (error) {
    console.error("Avatar Generation Error:", error);
    throw error;
  }
}

export async function generateOrEditImage(prompt: string, imageBase64?: string) {
  try {
    const response = await fetch('/api/ai/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, imageBase64 })
    });
    const data = await response.json();
    if (data.image) return data.image;
    throw new Error(data.error || "No image data returned from Gemini API");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string, voiceName: string = 'Kore') {
  try {
    const response = await fetch('/api/ai/generate-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName })
    });
    const data = await response.json();
    if (data.audio) return data.audio;
    throw new Error(data.error || "No audio data returned from Gemini API");
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}
