export interface Config {
  // Temporarily disabled fields
  // bb_app_password?: string;
  // bb_username?: string;
  // bb_repos?: (string)[] | null;
  // jira_token?: string;
  // jira_base_url?: string;
  // jira_username?: string;
  // ah_username?: string;
  // ah_password?: string;
  // absence_id?: string;
  // absence_apikey?: string;
  
  // Active fields
  untis_username: string;
  untis_password: string;
  logineo_username: string;
  logineo_password: string;
  openai_key: string;
  groq_key: string;
  ai_method: string;
  ollama_model?: string;
  ai_prompt: string;
}
