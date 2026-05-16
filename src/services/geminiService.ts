import { GoogleGenAI } from "@google/genai";

let aiInstance: any = null;

function getAi() {
  if (!aiInstance) {
    const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
                   (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateTechSpec(title: string, category: string): Promise<string> {
  try {
    const ai = getAi();
    if (!ai) return "";
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
