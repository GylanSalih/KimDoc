import { config } from "./config.ts";
import ollama from "npm:ollama";
import OpenAI from "jsr:@openai/openai";
import process from "node:process";

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

const getPrompt = (description: string): string => {
  return config.ai_prompt.replace("{DESCRIPTION}", description);
};

export const ticketDescriptionToActivity = async (
  description: string,
): Promise<string> => {
  if (description === "") {
    return "";
  }
  const prompt = getPrompt(description).replace(/(\r\n|\n|\r)/gm, "")
    .replaceAll('"', "");

  if (config.ai_method === "ollama") {
    console.log(
      `🤖 Using ollama ${config.ollama_model} to generate description with length of ${description.length}...`,
    );
    const message = { role: "user", content: prompt };
    const response = await ollama.chat({
      model: config.ollama_model ?? "llama3.2",
      messages: [message],
      stream: true,
    });
    let fullResponse = "";
    for await (const part of response) {
      fullResponse += part.message.content;
      process.stdout.write(part.message.content);
    }
    return fullResponse;
  } else if (config.ai_method === "gpt") {
    console.log(
      "🤖 Using openai gpt-4o-mini to generate description...",
      description.length,
    );
    const client = new OpenAI({
      apiKey: config.openai_key,
    });

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content ?? "no data";
  }

  throw new Error("Please provide 'ai_method' in config");
};
