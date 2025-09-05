// deno-lint-ignore-file
// deno-lint-ignore no-explicit-any

import type { Config } from "../types/config.ts";

export let config: Config = {
  untis_username: "",
  untis_password: "",
  logineo_username: "",
  logineo_password: "",
  ai_method: "groq",
  openai_key: "",
  groq_key: "",
  ollama_model: "llama-3.1-8b-instant",
  ai_prompt: "Schreibe maximal zwei simple Stichpunkte anhand der folgenden Ticket Beschreibung. Die Stichpunkte sollen beinhalten, was in dem Ticket zu tun war. Schreibe in der vergangenheit, aus sicht eines azubis, der das Ticket bearbeitet hat. Lasse füllwörter wie 'Ich habe' und 'habe ich' weg. Beutze keinen Punkt am ende des Stickpunktes. Gebe mir nur die Zwei Stichpunkte im Format '- <1.Stichpunkt>\\n- <2.Stichpunkt>', sonst nichts. Ticket Beschreibung:\n{DESCRIPTION}"
};

export const loadConfig = async () => {
  try {
    // In a React app, we need to fetch the config.json file
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status}`);
    }
    const json: Config = await response.json();
    config = json;
    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    // Return default config if loading fails
    return config;
  }
};

// Simplified config utility for React app
