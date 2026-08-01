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
      return "";
    }
    console.error("Error generating tech spec:", error);
    if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return "⚠️ Rate limit reached (429 ResourceExhausted). Please wait a moment and try again.";
    }
    return "";
  }
}

