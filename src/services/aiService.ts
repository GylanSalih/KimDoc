import { config } from '../utils/config';

export interface AIGenerationOptions {
  method: 'ollama' | 'gpt' | 'groq';
  model?: string;
  prompt: string;
  data: string;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Generates AI content using either Ollama (local) or OpenAI GPT
 */
export const generateAIContent = async (options: AIGenerationOptions): Promise<AIResponse> => {
  const { method, model, prompt, data } = options;
  
  try {
    if (method === 'ollama') {
      return await generateWithOllama(prompt, data, model || 'llama3.2');
    } else if (method === 'gpt') {
      return await generateWithOpenAI(prompt, data);
    } else if (method === 'groq') {
      return await generateWithGroq(prompt, data, model || 'llama-3.1-8b-instant');
    } else {
      return {
        success: false,
        error: `Unbekannte AI-Methode: ${method}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `AI-Generierung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    };
  }
};

/**
 * Generate content using Ollama (local AI)
 */
const generateWithOllama = async (prompt: string, data: string, model: string): Promise<AIResponse> => {
  try {
    const fullPrompt = prompt.replace('{DESCRIPTION}', data);
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API Fehler: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.response) {
      return {
        success: true,
        content: result.response.trim()
      };
    } else {
      return {
        success: false,
        error: 'Keine Antwort von Ollama erhalten'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Ollama Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : 'Stelle sicher, dass Ollama läuft (http://localhost:11434)'}`
    };
  }
};

/**
 * Generate content using OpenAI GPT
 */
const generateWithOpenAI = async (prompt: string, data: string): Promise<AIResponse> => {
  try {
    if (!config.openai_key) {
      return {
        success: false,
        error: 'OpenAI API Key ist nicht konfiguriert'
      };
    }

    const fullPrompt = prompt.replace('{DESCRIPTION}', data);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai_key}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API Fehler: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      return {
        success: true,
        content: result.choices[0].message.content.trim()
      };
    } else {
      return {
        success: false,
        error: 'Keine Antwort von OpenAI erhalten'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `OpenAI Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    };
  }
};

/**
 * Generate content using Groq (free, fast, cloud-based)
 */
const generateWithGroq = async (prompt: string, data: string, model: string): Promise<AIResponse> => {
  try {
    if (!config.groq_key) {
      return {
        success: false,
        error: 'Groq API Key ist nicht konfiguriert. Gehe zu https://console.groq.com/keys um einen kostenlosen Key zu holen.'
      };
    }

    const fullPrompt = prompt.replace('{DESCRIPTION}', data);
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groq_key}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq API Fehler: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      return {
        success: true,
        content: result.choices[0].message.content.trim()
      };
    } else {
      return {
        success: false,
        error: 'Keine Antwort von Groq erhalten'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Groq Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
    };
  }
};

/**
 * Test AI connection
 */
export const testAIConnection = async (method: 'ollama' | 'gpt' | 'groq', model?: string): Promise<AIResponse> => {
  const testPrompt = "Antworte nur mit 'Verbindung erfolgreich'";
  const testData = "Test";
  
  return await generateAIContent({
    method,
    model,
    prompt: testPrompt,
    data: testData
  });
};
