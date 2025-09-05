// deno-lint-ignore-file no-explicit-any

import { config } from "../utils/config.ts";

const getBaseHeaders = () => {
  return {
    Authorization: `Basic ${
      btoa(`${config.jira_username}@check24.de:${config.jira_token}`)
    }`,
  };
};

const cleanupString = (str: string): string => {
  // Remove newlines
  str = str.replace(/\n/g, " ");

  // Remove Confluence-specific formatting (e.g., h2., !, smart-link)
  str = str.replace(/h2\.\s*/g, "");
  str = str.replace(/\*\*?\s*/g, "");
  str = str.replace(/\[\S+\|\S+\]/g, "");
  str = str.replace(/!\S+\|.*?\!/g, "");

  // Remove excess whitespace
  str = str.replace(/\s+/g, " ");

  return str.trim();
};

export const getTicketStatus = async (ticket: string): Promise<string> => {
  const response = await fetch(
    `${config.jira_base_url}/rest/api/2/issue/${ticket}`,
    {
      method: "GET",
      headers: {
        ...getBaseHeaders(),
        "Accept": "application/json",
      },
    },
  );

  if (!response.ok) {
    return "";
  }

  const data: any = (await response.json()) as any;
  return cleanupString(data.fields.status.name);
};

export const getIssueDescription = async (ticket: string): Promise<string> => {
  if (ticket.includes("/")) {
    ticket = ticket.split("/").at(-1)!;
  }
  const response = await fetch(
    `${config.jira_base_url}/rest/api/2/issue/${ticket}`,
    {
      method: "GET",
      headers: {
        ...getBaseHeaders(),
        "Accept": "application/json",
      },
    },
  );

  if (!response.ok) return "";

  const data: any = (await response.json()) as any;
  return cleanupString(data.fields.description);
};

export const getTicketHeading = async (ticket: string): Promise<string> => {
  const response = await fetch(
    `${config.jira_base_url}/rest/api/2/issue/${ticket}`,
    {
      method: "GET",
      headers: {
        ...getBaseHeaders(),
        "Accept": "application/json",
      },
    },
  );

  if (!response.ok) return "";

  const data: any = (await response.json()) as any;

  return data.fields.summary;
};
