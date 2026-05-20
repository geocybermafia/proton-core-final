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




function isSimulatedActive(): boolean {
  try {
    const saved = localStorage.getItem('proton_ai_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return !!parsed?.useSimulatedAi;
    }
  } catch (e) {
    console.warn("Could not check simulated AI status", e);
  }
  return false;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callServerGemini<T>(action: string, args: any[]): Promise<T> {
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
  if (isSimulatedActive()) {
    await sleep(750);
    const msgLower = message.toLowerCase();
    const isKa = appLanguage === 'ka';
    let responseText = "";

    if (msgLower.includes("gamarjoba") || msgLower.includes("გამარჯობა") || msgLower.includes("hello") || msgLower.includes("hey")) {
      responseText = isKa 
        ? `გამარჯობა! მე ვარ **${persona.nameGe || persona.name}** — თქვენი პერსონალური ციფრული მრჩეველი Proton-ში. 🚀\n\nმოხარული ვარ თქვენთან კავშირით! როგორ შემიძლია მხარი დავუჭირო თქვენს იდეებს, შემოქმედებას ან ბიზნეს ოპერაციებს დღეს?`
        : `Hello! I am **${persona.name}** — your personal AI advisor within the Proton workspace. 🚀\n\nI'm excited to help you optimize, brainstorm, or automate. What are we collaborating on today?`;
    } else if (msgLower.includes("business") || msgLower.includes("ბიზნეს") || msgLower.includes("idea") || msgLower.includes("იდეა") || msgLower.includes("სტარტაპ")) {
      responseText = isKa
        ? `ეს შესანიშნავი იდეაა! ქართული ბაზრისთვის წარმატებული სტარტაპის ასაშენებლად შემდეგი ნაბიჯებია რეკომენდებული:\n\n1. **ავთენტურობა და ხარისხი:** მომხმარებლები საქართველოში უპირატესობას ანიჭებენ ორგანულ და საიმედო ბრენდებს.\n2. **ციფრული Funnel:** გამოიყენეთ ავტომატური Facebook-შეტყობინებები ლიდების საწყისი დამუშავებისთვის.\n3. **Proton Automation:** დაუკავშირეთ თქვენი საკონტაქტო ფორმები ავტომატურ ბიზნეს ნაკადებს (Proton Workflows), რათა არც ერთი კლიენტი არ დაკარგოთ.\n\nგსურთ კონკრეტულად შევადგინოთ თქვენი პროექტის გეგმა?`
        : `That sounds like a brilliant startup direction! To build a high-converting business in our current landscape, focus on these pillars:\n\n1. **Authenticity:** Modern customers prioritize honest, human-driven storytelling.\n2. **Smart Lead Capture:** Automate initial inquiries using simple message chains to reduce response latency to under 2 seconds.\n3. **Data Pipelines:** Integrate custom logic via Proton Workflows to sync form inputs and save hours of manual entry weekly.\n\nWould you like me to architect a custom action plan for this template?`;
    } else if (msgLower.includes("marketing") || msgLower.includes("მარკეტინგ") || msgLower.includes("lead") || msgLower.includes("ლიდ")) {
      responseText = isKa
        ? `მარკეტინგული კამპანიის ავტომატიზაცია უმნიშვნელოვანესია:\n\n* **ლოკალური ტრიგერები:** ინსტაგრამ რილსები (Instagram Reels) და TikTok ყველაზე სწრაფი ორგანული ზრდის საშუალებაა თბილისში.\n* **ლიდების მაგნიტი (Lead Magnet):** შესთავაზეთ მომხმარებელს უფასო სასარგებლო გზამკვლევი, რათა მიიღოთ მათი საკონტაქტო მონაცემები.\n* **სინქრონიზაცია:** ყოველი ახალი კლიენტის მონაცემი ავტომატურად გადაიტანეთ თქვენს CRM-ში.`
        : `Let's optimize your growth funnel! Active lead generation requires these high-impact processes:\n\n* **Video Seeding:** Instagram Reels & TikTok are generating the highest organic conversion rates for Georgian brands right now.\n* **Value First:** Provide a checklist, discount code, or informative toolkit in exchange for contact info.\n* **Integration:** Auto-route and update leads into your centralized project board immediately.`;
    } else if (msgLower.includes("help") || msgLower.includes("დახმარება") || msgLower.includes("შეგიძლია")) {
      responseText = isKa
        ? `სიამოვნებით! მე შემიძლია დაგეხმაროთ შემდეგ მიმართულებებში:\n\n* 📈 **ლიდების გენერირება & მარკეტინგი:** აუდიტორიის მოზიდვის და კამპანიების დაგეგმვა.\n* ⚙️ **ავტომატიზაცია:** თქვენი სამუშაო პროცესების გაციფრულება და Proton-ის გამოყენება.\n* ⛓️ **Web3 სტრატეგია:** დეცენტრალიზებული გადახდები და ტექნოლოგიური გადაწყვეტილებები.\n\nგთხოვთ მიუთითოთ რა მიმართულება გაინტერესებთ!`
        : `I'd love to! I can dynamically assist you with:\n\n* 📈 **Automated Lead Gen & Outreach:** Tactics to acquire active clients.\n* ⚙️ **Process Architecture:** Sketching triggers and automated outcomes via Proton UI.\n* ⛓️ **Innovation Strategy:** Seamless Web3 tokenization or high-compute setup plans.\n\nTell me a bit more about your current operations!`;
    } else {
      responseText = isKa
        ? `საინტერესო მოთხოვნაა! Proton AI-ს საშუალებით ჩვენ შეგვიძლია აღნიშნული ამოცანა მარტივად დავყოთ შესასრულებელ ეტაპებად.\n\nრეკომენდებულია **"სამუშაო პროცესების" (Processes)** პანელში ახალი ავტომატური ნაკადის შექმნა, რომელიც შესაბამის მონაცემებს დაამუშავებს. შემიძლია დაგეხმაროთ წერილობითი გეგმის შედგენაშიც.`
        : `A fascinating topic! Using our intelligent suite, we can easily modularize this task.\n\nI recommend defining a custom logical sequence in the **Business Processes** workspace to execute this automatically. Would you like me to map out the detailed specifications for that logical flow?`;
    }

    return {
      text: `⚡ **[PRO-SIMULATION MODE]**\n\n${responseText}`,
      metadata: { promptTokenCount: 120, candidatesTokenCount: 250, totalTokenCount: 370, latency: 750 }
    };
  }

  try {
    return await callServerGemini<{ text: string, metadata: GeminiMetadata }>('chatWithPersona', [
      persona, message, history, model, includeMaps, includeSearch, temperature, globalInstruction, appLanguage
    ]);
  } catch (error: any) {
    console.error("Gemini API Client Proxy Error:", error);
    let displayMessage = error.message || String(error);
    
    // Attempt to parse dynamic server-side errors
    try {
      if (displayMessage.startsWith("Error: ")) {
        displayMessage = displayMessage.substring(7);
      }
      const parsed = JSON.parse(displayMessage);
      if (parsed && (parsed.isQuotaError || parsed.isModelError)) {
        displayMessage = appLanguage === 'ka' ? parsed.messageKa : parsed.messageEn;
      }
    } catch (e) {
      // Check for presence of common quota/excess cues in raw string
      const errLower = displayMessage.toLowerCase();
      if (errLower.includes("429") || errLower.includes("quota") || errLower.includes("resource_exhausted")) {
        displayMessage = appLanguage === 'ka'
          ? `ლიმიტის გადაჭარბება (შეცდომა 429): გაზიარებულმა API გასაღებმა მიაღწია კვოტას. გთხოვთ გააქტიუროთ თქვენი საკუთარი Gemini API გასაღები "პარამეტრებიდან" (ზედა მარჯვენა კუთხეში ⚙️) მუშაობის გასაგრძელებლად.`
          : `Quota Exceeded (Error 429): The shared environment API key has reached its limits. Please configure your custom Gemini API Key in "System Settings" (icon in the top-right ⚙️) to resume operations immediately.`;
      }
    }

    return {
      text: displayMessage,
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: 0 } 
    };
  }
}

export async function generateNewPersona(basePersona: Persona, prompt: string): Promise<Persona> {
  if (isSimulatedActive()) {
    await sleep(600);
    return {
      id: "simulated-persona-" + Date.now(),
      name: "Custom Agent",
      nameGe: "პერსონალური ასომატი",
      role: "Simulated Specialist",
      description: "Adaptation based on prompt: " + prompt,
      descriptionGe: "სიმულაციური ადაპტაცია მოთხოვნით: " + prompt,
      avatar: "🤖",
      language: "Mixed",
      systemInstruction: "Simulated instructions based on: " + prompt
    };
  }
  return callServerGemini<Persona>('generateNewPersona', [basePersona, prompt]);
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  if (isSimulatedActive()) {
    await sleep(400);
    return "💡 საუბრის შეჯამება: განხილულია ბიზნეს იდეის განხორციელება, პროცესების ავტომატიზაციისა და მარკეტინგული არხების მოწყობის სტრატეგიები საქართველოში.";
  }
  try {
    return await callServerGemini<string>('summarizeConversation', [history]);
  } catch (error) {
    console.error("summarizeConversation Proxy Error:", error);
    return "Error generating summary.";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }) {
  if (isSimulatedActive()) {
    await sleep(800);
    return `### 📊 ბიზნეს ნაკადის დიაგნოსტიკა და ოპტიმიზაცია
  
**სახელი:** ${workflow.name}
**ამამუშავებელი ტრიგერი:** ${workflow.trigger}
**შესასრულებელი ქმედება:** ${workflow.action}

#### 🎯 ძირითადი რეკომენდაციები:
1. **საიმედოობის კოეფიციენტი:** ტრიგერი მუშაობს უნაკლოდ. რეკომენდებულია მონაცემთა ადგილობრივი ვალიდაციის დამატება.
2. **გამტარუნარიანობა:** მომხმარებელთა მოთხოვნები გადანაწილდება დაყოვნების გარეშე.
3. **შემდეგი ეტაპი:** მზადაა გასაშვებად. (სიმულაციური ანალიზი დასრულებულია წარმატებით)`;
  }
  try {
    return await callServerGemini<string>('analyzeWorkflow', [workflow]);
  } catch (error) {
    console.error("analyzeWorkflow Proxy Error:", error);
    return "Error analyzing workflow.";
  }
}

export async function generatePersonaAvatar(persona: Persona) {
  if (isSimulatedActive()) {
    return persona.avatar || "🤖";
  }
  return callServerGemini<string>('generatePersonaAvatar', [persona]);
}

export async function generateOrEditImage(prompt: string, imageBase64?: string) {
  if (isSimulatedActive()) {
    await sleep(1000);
    // Return a beautiful dynamic colored SVG representation encoded as Data URI
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
      <text x="200" y="320" fill="#00f2ff" font-family="monospace" font-size="12" letter-spacing="2" text-anchor="middle" opacity="0.8">PROTON COMPUTE LAYER</text>
      <text x="200" y="340" fill="#a4b3c6" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" opacity="0.6">SIMULATED ARTWORK FOR: ${prompt.toUpperCase().substring(0, 30)}...</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  return callServerGemini<string>('generateOrEditImage', [prompt, imageBase64]);
}

export async function generateSpeech(text: string, voiceName: string = 'Kore') {
  if (isSimulatedActive()) {
    await sleep(500);
    return "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  }
  return callServerGemini<string>('generateSpeech', [text, voiceName]);
}

export async function translateText(
  text: string,
  sourceRole: 'Visitor' | 'Creative',
  targetLanguage: 'Georgian' | 'English',
  systemInstruction: string
): Promise<string> {
  if (isSimulatedActive()) {
    await sleep(500);
    const textLower = text.toLowerCase();
    if (targetLanguage === 'Georgian') {
      if (textLower.includes("hello") || textLower.includes("hi")) return "გამარჯობა, სასიამოვნოა თქვენთან შეხვედრა!";
      if (textLower.includes("how much") || textLower.includes("price")) return "რა ღირს ეს მომსახურება/პროდუქტი?";
      if (textLower.includes("thank")) return "დიდი მადლობა დახმარებისთვის!";
      return `[თარგმანი]: ${text} (სიმულაციური თარგმანი ქართულად)`;
    } else {
      if (textLower.includes("გამარჯობა")) return "Hello, nice to meet you!";
      if (textLower.includes("მადლობა")) return "Thank you very much!";
      if (textLower.includes("ფასი") || textLower.includes("რა ღირს")) return "How much does this cost?";
      return `[Translated]: ${text} (Simulated translation to English)`;
    }
  }
  return callServerGemini<string>('translateText', [text, sourceRole, targetLanguage, systemInstruction]);
}

export async function architectTask(project: string, temperature: number = 0.9): Promise<{ data: TaskPlan, metadata: GeminiMetadata }> {
  if (isSimulatedActive()) {
    await sleep(700);
    const materials = [
      { item: "Proton Cloud Node", cost: "0 GEL (Free Tier Active)" },
      { item: "Integration Connectors", cost: "0 GEL (Local Buffer)" }
    ];
    return {
      data: {
        materials,
        complexity: "Optimal / Adaptive",
        estimatedTime: "1-2 Hours (Automated Delivery)",
        firstSteps: [
          "Validate structural triggers in the workflow workspace.",
          "Activate local simulation buffer for real-time sandbox testing.",
          "Connect data targets to verify response capture."
        ]
      },
      metadata: { promptTokenCount: 150, candidatesTokenCount: 180, totalTokenCount: 330, latency: 700 }
    };
  }
  return callServerGemini<{ data: TaskPlan, metadata: GeminiMetadata }>('architectTask', [project, temperature]);
}


