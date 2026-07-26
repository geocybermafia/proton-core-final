export async function generateTechSpec(title: string, category: string, signal?: AbortSignal): Promise<string> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'generateTechSpec',
        args: [title, category]
      }),
      signal
    });
    if (!response.ok) {
      if (response.status === 429) {
        return "⚠️ Rate limit reached (429 ResourceExhausted). Please wait a moment and try again.";
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      console.log("generateTechSpec request aborted");
      return "";
    }
    console.error("Error generating tech spec:", error);
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return "⚠️ Rate limit reached (429 ResourceExhausted). Please wait a moment and try again.";
    }
    return "";
  }
}

export async function askAssistant(prompt: string, language: 'en' | 'ka' = 'en', signal?: AbortSignal): Promise<string> {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'chatWithPersona',
        args: [
          {
            id: 'assistant',
            name: 'Proton Assistant',
            role: 'AI Assistant',
            description: 'Helper',
            avatar: '⚡',
            systemInstruction: 'You are Proton AI Assistant. Provide helpful, concise advice.'
          },
          prompt,
          [],
          'gemini-3.5-flash',
          false,
          true,
          0.8,
          '',
          language
        ]
      }),
      signal
    });

    if (!response.ok) {
      if (response.status === 429) {
        return language === 'ka'
          ? "⚠️ ლიმიტის გადაჭარბება (429 ResourceExhausted). გთხოვთ დაელოდოთ 1 წუთი."
          : "⚠️ Rate limit reached (429 ResourceExhausted). Please wait 1 minute before trying again.";
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data?.text || "";
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      console.log("askAssistant request aborted");
      return "";
    }
    const errStr = error?.message || String(error);
    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.toLowerCase().includes("quota")) {
      return language === 'ka'
        ? "⚠️ ლიმიტის გადაჭარბება (429 ResourceExhausted). გთხოვთ დაელოდოთ 1 წუთი."
        : "⚠️ Rate limit reached (429 ResourceExhausted). Please wait 1 minute before trying again.";
    }
    console.error("Error in askAssistant:", error);
    return language === 'ka'
      ? "⚠️ შეცდომა ასისტენტთან კავშირისას."
      : "⚠️ Connection error with assistant.";
  }
}

