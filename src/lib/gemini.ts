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
    systemInstruction: `You are 'Creative Guide' (შემოქმედებითი მეგზური), a digital persona from Proton AI. 
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
    systemInstruction: `You are 'Web3 Strategist' (Web3 სტრატეგი), a digital persona from Proton AI.
    Your tone is sharp, futuristic, and highly technical but accessible.
    You specialize in explaining blockchain, smart contracts, and AI-as-a-Service to Georgian entrepreneurs.
    You are aware of the local crypto-mining history in Georgia and the current regulatory landscape.
    You advocate for Proton's disruptive technology and the use of high-compute GPU infrastructure.
    Always respond with a focus on innovation and scalability.`
  },
  {
    id: "lead-gen-bot",
    name: "Lead Gen Automator",
    nameGe: "ლიდების ავტომატორი",
    role: "Marketing Specialist",
    description: "Automates social presence and lead generation for niche 'underground' businesses in Tbilisi and beyond.",
    descriptionGe: "ავტომატიზირებს სოციალურ ყოფნას და ლიდების გენერაცი�async function callServerGemini<T>(action: string, args: any[]): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  try {
    const saved = localStorage.getItem('proton_ai_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.customApiKey) {
        headers['x-custom-api-key'] = parsed.customApiKey;
      }
    }
  } catch (e) {
    console.warn("Could not load customApiKey from storage, using environment fallback.", e);
  }

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers,
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
  model: string = "gemini-3.5-flash",
  includeMaps: boolean = false,
  includeSearch: boolean = true,
  temperature: number = 0.9,
  globalInstruction?: string,
  appLanguage: 'en' | 'ka' = 'en'
): Promise<{ text: string, metadata: GeminiMetadata }> {
  try {
    const res = await callServerGemini<{ text: string, metadata: GeminiMetadata }>('chatWithPersona', [
      persona, message, history, model, includeMaps, includeSearch, temperature, globalInstruction, appLanguage
    ]);
    return res;
  } catch (error: any) {
    console.error("Gemini API Client Proxy Error:", error);
    const isKa = appLanguage === 'ka';
    return {
      text: isKa 
        ? "⚠️ პრობლემა შეიქმნა Gemini API-სთან კავშირისას. გთხოვთ, შეამოწმოთ თქვენი ინტერნეტ კავშირი ან სცადოთ მოგვიანებით."
        : "⚠️ An error occurred while communicating with the Gemini API. Please check your network connection or try again later.",
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: 0 }
    };
  }
}

export async function generateNewPersona(basePersona: Persona, prompt: string): Promise<Persona> {
  try {
    return await callServerGemini<Persona>('generateNewPersona', [basePersona, prompt]);
  } catch (error) {
    console.error("generateNewPersona proxy failed:", error);
    throw error;
  }
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  try {
    return await callServerGemini<string>('summarizeConversation', [history]);
  } catch (error) {
    console.error("summarizeConversation Proxy Error:", error);
    return "";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }) {
  try {
    return await callServerGemini<string>('analyzeWorkflow', [workflow]);
  } catch (error) {
    console.error("analyzeWorkflow Proxy Error:", error);
    throw error;
  }
}

export async function generatePersonaAvatar(persona: Persona) {
  try {
    return await callServerGemini<string>('generatePersonaAvatar', [persona]);
  } catch (error) {
    console.error("generatePersonaAvatar Proxy Error:", error);
    return persona.avatar || "🤖";
  }
}

export async function generateOrEditImage(prompt: string, imageBase64?: string) {
  try {
    return await callServerGemini<string>('generateOrEditImage', [prompt, imageBase64]);
  } catch (error) {
    console.error("generateOrEditImage Proxy Error:", error);
    throw error;
  }
}

export async function generateSpeech(text: string, voiceName: string = 'Kore') {
  try {
    return await callServerGemini<string>('generateSpeech', [text, voiceName]);
  } catch (error) {
    console.error("generateSpeech Proxy Error:", error);
    throw error;
  }
}

export async function translateText(
  text: string,
  sourceRole: 'Visitor' | 'Creative',
  targetLanguage: string,
  systemInstruction: string
): Promise<string> {
  try {
    return await callServerGemini<string>('translateText', [text, sourceRole, targetLanguage, systemInstruction]);
  } catch (error) {
    console.error("translateText Proxy Error:", error);
    return text;
  }
}

export async function architectTask(project: string, temperature: number = 0.9): Promise<{ data: TaskPlan, metadata: GeminiMetadata }> {
  try {
    return await callServerGemini<{ data: TaskPlan, metadata: GeminiMetadata }>('architectTask', [project, temperature]);
  } catch (error) {
    console.error("architectTask Proxy Error:", error);
    throw error;
  }
}

export async function breakdownTask(taskContent: string, appLanguage: 'en' | 'ka' = 'en'): Promise<string[]> {
  try {
    return await callServerGemini<string[]>('breakdownTask', [taskContent, appLanguage]);
  } catch (error) {
    console.error("breakdownTask Proxy Error:", error);
    return [];
  }
}

export async function generateStrategicObjective(appLanguage: 'en' | 'ka' = 'en'): Promise<{
  title: string;
  priority: 'low' | 'medium' | 'high';
  category: 'Infrastructure' | 'System' | 'Interface' | 'Security' | 'Intelligence';
  subtasks: { label: string; completed: boolean }[];
}> {
  try {
    return await callServerGemini<{
      title: string;
      priority: 'low' | 'medium' | 'high';
      category: 'Infrastructure' | 'System' | 'Interface' | 'Security' | 'Intelligence';
      subtasks: { label: string; completed: boolean }[];
    }>('generateStrategicObjective', [appLanguage]);
  } catch (error) {
    console.error("generateStrategicObjective Proxy Error:", error);
    throw error;
  }
}

export async function expandObjectiveAnalysis(title: string, category: string, appLanguage: 'en' | 'ka' = 'en'): Promise<string> {
  try {
    return await callServerGemini<string>('expandObjectiveAnalysis', [title, category, appLanguage]);
  } catch (error) {
    console.error("expandObjectiveAnalysis Proxy Error:", error);
    return "";
  }
}Metadata }>('architectTask', [project, temperature]);
  } catch (error) {
    console.warn("architectTask Proxy Error, falling back to simulation:", error);
    autoEnableSimulationMode();
    return architectTask(project, temperature);
  }
}

export async function breakdownTask(taskContent: string, appLanguage: 'en' | 'ka' = 'en'): Promise<string[]> {
  if (isSimulatedActive()) {
    await sleep(600);
    if (appLanguage === 'ka') {
      return [
        "განსაზღვრეთ დავალების მიზანი და მასშტაბი",
        "მოამზადეთ სამუშაო გარემო და ინსტრუმენტები",
        "განახორციელეთ დავალების პირველი ეტაპი",
        "შეასრულეთ ძირითადი დეტალები",
        "გადაამოწმეთ შესრულებული სამუშაოს ხარისხი"
      ];
    } else {
      return [
        "Define task objective and scope",
        "Prepare workspace and tools",
        "Execute initial phase of the task",
        "Implement core details",
        "Review and verify the final output"
      ];
    }
  }
  try {
    return await callServerGemini<string[]>('breakdownTask', [taskContent, appLanguage]);
  } catch (error) {
    console.warn("breakdownTask Proxy Error, falling back to simulation:", error);
    autoEnableSimulationMode();
    return breakdownTask(taskContent, appLanguage);
  }
}

export async function generateStrategicObjective(appLanguage: 'en' | 'ka' = 'en'): Promise<{
  title: string;
  priority: 'low' | 'medium' | 'high';
  category: 'Infrastructure' | 'System' | 'Interface' | 'Security' | 'Intelligence';
  subtasks: { label: string; completed: boolean }[];
}> {
  if (isSimulatedActive()) {
    await sleep(600);
    if (appLanguage === 'ka') {
      return {
        title: "სისტემის ავტომატური რეპლიკაცია",
        priority: "medium",
        category: "Infrastructure",
        subtasks: [
          { label: "კლასტერის მომზადება", completed: false },
          { label: "დატვირთვის გადანაწილება", completed: false },
          { label: "რეზერვების ტესტირება", completed: false }
        ]
      };
    } else {
      return {
        title: "Database Cloud Replication",
        priority: "medium",
        category: "Infrastructure",
        subtasks: [
          { label: "Configure failover clusters", completed: false },
          { label: "Enable real-time transaction sync", completed: false },
          { label: "Verify disaster recovery backup", completed: false }
        ]
      };
    }
  }
  try {
    return await callServerGemini<{
      title: string;
      priority: 'low' | 'medium' | 'high';
      category: 'Infrastructure' | 'System' | 'Interface' | 'Security' | 'Intelligence';
      subtasks: { label: string; completed: boolean }[];
    }>('generateStrategicObjective', [appLanguage]);
  } catch (error) {
    console.warn("generateStrategicObjective Proxy Error, falling back to simulation:", error);
    autoEnableSimulationMode();
    return generateStrategicObjective(appLanguage);
  }
}

export async function expandObjectiveAnalysis(title: string, category: string, appLanguage: 'en' | 'ka' = 'en'): Promise<string> {
  if (isSimulatedActive()) {
    await sleep(800);
    if (appLanguage === 'ka') {
      return `### 📊 სტრატეგიული ანალიზი: ${title}

ეს არის დეტალური ბიზნეს ანალიზი, რომელიც გენერირებულია რეალურ დროში.

#### 1. სტრატეგიული კონტექსტი (Strategic Context)
ეს მიზანი კრიტიკულია დაფარვის ხარისხისა და სტაბილურობის უზრუნველსაყოფად ქართულ ბაზარზე, განსაკუთრებით თბილისის მზარდი ტექნოლოგიური ეკოსისტემისთვის.

#### 2. ნაბიჯ-ნაბიჯ საგზაო რუკა (Roadmap)
* **ფაზა 1 (კვირა 1):** არქიტექტურული მონახაზი და მომზადება.
* **ფაზა 2 (კვირა 2-3):** საწყისი პროტოტიპირება და ტესტირება.
* **ფაზა 3 (კვირა 4):** სრული ინტეგრაცია და მონიტორინგი.

#### 3. ძირითადი KPI-ები (Key Performance Indicators)
* დაყოვნების შემცირება (Latency < 200ms)
* 99.9% სისტემური მუშაობის დრო (Uptime)

#### 4. რისკები და პრევენცია (Risks)
მთავარი რისკი არის სერვერის რესურსების შეზღუდულობა, რომლის პრევენციაც მოხდება დატვირთვის სწორი მენეჯმენტით.`;
    } else {
      return `### 📊 Strategic Analysis: ${title}

This is a deep dive strategic analysis generated in real-time.

#### 1. Strategic Context
This objective is critical to ensuring high-quality operations and system stability for our target customer base.

#### 2. Phased Roadmap
* **Phase 1 (Week 1):** Structural definitions and alignment.
* **Phase 2 (Weeks 2-3):** Implementation of core connectors.
* **Phase 3 (Week 4):** Final deployment and logging review.

#### 3. Core Measurement Metrics (KPIs)
* Core process latency reduced by 25%.
* Integration error rate below 0.1%.

#### 4. Contingency Planning
Mitigate integration locks by routing offline callbacks gracefully through secondary buffers.`;
    }
  }
  try {
    return await callServerGemini<string>('expandObjectiveAnalysis', [title, category, appLanguage]);
  } catch (error) {
    console.warn("expandObjectiveAnalysis Proxy Error, falling back to simulation:", error);
    autoEnableSimulationMode();
    return expandObjectiveAnalysis(title, category, appLanguage);
  }
}


