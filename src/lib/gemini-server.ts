import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Persona, GeminiMetadata } from "../types";

export interface TaskPlan {
  materials: { item: string; cost: string }[];
  complexity: string;
  estimatedTime: string;
  firstSteps: string[];
}

const aiInstances = new Map<string, GoogleGenAI>();

function getAi(apiKeyOverride?: string) {
  // Respect user-specified custom API key first, then fall back to environment configurations
  const apiKey = apiKeyOverride || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Secure Config Alert: Server-side VITE_GEMINI_API_KEY and GEMINI_API_KEY environment variables are missing.");
    return null;
  }
  
  if (!aiInstances.has(apiKey)) {
    const maskedKey = apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`[CONFIG SECURE MAP ACTIVATION] Initialized Gemini API Key: ${maskedKey} (Length: ${apiKey.length})`);
    
    const instance = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    aiInstances.set(apiKey, instance);
  }
  return aiInstances.get(apiKey)!;
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
  appLanguage: 'en' | 'ka' = 'en',
  apiKeyOverride?: string
): Promise<{ text: string, metadata: GeminiMetadata }> {
  const startTime = performance.now();
  try {
    const tools: any[] = [];
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
    console.error("Gemini API Error in chatWithPersona:", error);
    const endTime = performance.now();
    const errStr = error.message || String(error);
    
    let text = "";
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("limit") || errStr.toLowerCase().includes("resource_exhausted")) {
      text = appLanguage === 'ka'
        ? `⚠️ **კვოტა ამოიწურა / ლიმიტის გადაჭარბება (შეცდომა 429)**
        
გაზიარებულმა ან თქვენმა პერსონალურმა Gemini API გასაღებმა მიაღწია Google-ის მიერ დაწესებულ მოთხოვნების ლიმიტს:
1. **თუ იყენებთ უფასო (Free) API გასაღებს:** Google-ის უფასო ტარიფს აქვს მკაცრი შეზღუდვები (წუთში მაქსიმუმ 15 მოთხოვნა). სწრაფი ან ხშირი გამოყენებისას, განსაკუთრებით თუ საუბრობთ რამდენიმე პერსონასთან ან გამოსცემთ სერვისებს, ეს ლიმიტი მარტივად ივსება.
2. **როგორ მოვაგვაროთ:** 
   * გთხოვთ, **დაელოდოთ 1 წუთი** და სცადოთ ხელახლა.
   * დარწმუნდით, რომ თქვენს Google AI Studio ბილინგზე ჩართულია **"Pay-as-you-go"** ფასიანი გეგმა (რომელიც ასევე გთავაზობთ ფართო უფასო ლიმიტებს სტაბილური მუშაობისთვის).
   * შეამოწმეთ, რომ შეყვანილი API გასაღები ნამდვილად აქტიური და სწორია ზედა მარჯვენა კუთხეში არსებული ⚙️ პარამეტრების პანელიდან.`
        : `⚠️ **Quota Exceeded / Rate Limit Reached (Error 429)**
        
The shared environment key or your personal Gemini API key has exceeded Google's service limits:
1. **If you are using a Free API Key:** Google's Free tier keys have strict rate-limit constraints (typically 15 requests per minute). Rapid or continuous use can exhaust this limit immediately.
2. **How to resolve:**
   * Please **wait 1 minute** before trying your request again.
   * Ensure your Google AI Studio account is upgraded to a **"Pay-as-you-go"** billing plan (which offers much higher rate limits and generous free tiers).
   * Confirm that your custom API key in the System Settings panel (⚙️ icon in the top-right) is active and correct.`;
    } else {
      text = appLanguage === 'ka'
        ? `⚠️ **კავშირის შეცდომა:** სასურველი პასუხის მიღება ვერ მოხერხდა. (${errStr}). გთხოვთ სცადოთ მოგვიანებით.`
        : `⚠️ **Connection Error:** Failed to generate response. (${errStr}). Please try again later.`;
    }

    return { 
      text, 
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: Math.round(endTime - startTime) } 
    };
  }
}

export async function generateNewPersona(basePersona: Persona, prompt: string, apiKeyOverride?: string): Promise<Persona> {
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
  
  const text = response.text ? response.text.replace(/```json|```/g, '') : "{}";
  
  const newPersona = JSON.parse(text);
  newPersona.id = `persona-${Date.now()}`;
  return newPersona;
}

export async function summarizeConversation(history: { role: 'user' | 'model', parts: { text: string }[] }[], apiKeyOverride?: string) {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) return "AI engine not initialized.";
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: "Summarize this conversation in a concise way, highlighting key points and actionable items." }] }
      ],
    });
    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini API Error in summarizeConversation:", error);
    return "Error generating summary.";
  }
}

export async function analyzeWorkflow(workflow: { name: string, trigger: string, action: string }, apiKeyOverride?: string) {
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
    console.error("Gemini API Error in analyzeWorkflow:", error);
    return "Error analyzing workflow.";
  }
}

export async function generatePersonaAvatar(persona: Persona, apiKeyOverride?: string) {
  try {
    const ai = getAi(apiKeyOverride);
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

export async function generateOrEditImage(prompt: string, imageBase64?: string, apiKeyOverride?: string) {
  try {
    const ai = getAi(apiKeyOverride);
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

export async function generateSpeech(text: string, voiceName: string = 'Kore', apiKeyOverride?: string) {
  try {
    const ai = getAi(apiKeyOverride);
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

export async function architectTask(project: string, temperature: number = 0.9, apiKeyOverride?: string): Promise<{ data: TaskPlan, metadata: GeminiMetadata }> {
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
    console.error("Gemini API Error in architectTask:", error);
    const endTime = performance.now();
    throw { 
      error, 
      metadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0, latency: Math.round(endTime - startTime) } 
    };
  }
}

export async function translateText(
  text: string,
  sourceRole: 'Visitor' | 'Creative',
  targetLanguage: 'Georgian' | 'English',
  systemInstruction: string,
  apiKeyOverride?: string
): Promise<string> {
  try {
    const ai = getAi(apiKeyOverride);
    if (!ai) throw new Error("AI engine not initialized (GEMINI_API_KEY is missing on server)");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate this for the ${targetLanguage} speaker. Input from ${sourceRole}: ${text}`,
      config: {
        systemInstruction: systemInstruction
      }
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini API Error in translateText:", error);
    throw error;
  }
}

export async function generateTechSpec(title: string, category: string, apiKeyOverride?: string): Promise<string> {
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
        temperature: 0.7,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error generating tech spec:", error);
    return "";
  }
}

