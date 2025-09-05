// deno-lint-ignore-file no-explicit-any

import { Commit, Pullrequest, User } from "../types/bitbucket.ts";
import type { TimeRange } from "../types/time.ts";
import { config } from "../utils/config.ts";

const getBaseHeaders = () => {
  return {
    Authorization: `Basic ${
      btoa(`${config.bb_username}:${config.bb_app_password}`)
    }`,
  };
};

export const getUser = async (): Promise<User> => {
  const response = await fetch("https://api.bitbucket.org/2.0/user", {
    headers: getBaseHeaders(),
  });
  const json = await response.json();
  return json as User;
};

export const getPullrequestsForUser = async (
  uuid: string,
  timeRange: TimeRange,
): Promise<Pullrequest[]> => {
  const allPullrequests: Pullrequest[] = [];
  for (const repo of config.bb_repos!) {
    const pullrequests: Pullrequest[] = await getPaginatedResults(
      `https://api.bitbucket.org/2.0/repositories/check24/${repo}/pullrequests/${uuid}?state=OPEN,MERGED&q=updated_on >= ${timeRange.from.toISOString()} AND updated_on <= ${timeRange.to.toISOString()}`,
      timeRange.from,
    );
    allPullrequests.push(...pullrequests);
  }

  return allPullrequests;
};

const getPaginatedResults = async (
  url: string,
  backTo: Date,
): Promise<any[]> => {
  const results: any[] = [];
  let nextUrl: string = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: getBaseHeaders(),
    });
    if (!response.ok) {
      break;
    }
    const data = await response.json();
    results.push(...data.values);
    const date = data.values[data.values.length - 1]?.date ||
      data.values[data.values.length - 1]?.updated_on;
    if (new Date(date) < backTo) {
      break;
    }
    nextUrl = data.next;
  }
  return results;
};

export const getCommitsForUser = async (
  uuid: string,
  timeRange: TimeRange,
): Promise<Commit[]> => {
  let allCommits: Commit[] = [];
  for (const repo of config.bb_repos!) {
    const commits: Commit[] = await getPaginatedResults(
      `https://api.bitbucket.org/2.0/repositories/check24/${repo}/commits?pagelen=100`,
      timeRange.from,
    );
    allCommits.push(...commits);
  }
  allCommits = allCommits.filter((commit) =>
    commit?.author?.user?.uuid === uuid && commit?.date &&
    (new Date(commit.date) > timeRange.from &&
      new Date(commit.date) < timeRange.to)
  );
  return allCommits;
};

const getPullRequestById = async (
  id: number,
  repo: string,
): Promise<Pullrequest> => {
  const url = encodeURI(
    `https://api.bitbucket.org/2.0/repositories/check24/${repo}/pullrequests/${id}`,
  );
  const response = await fetch(
    url,
    {
      headers: getBaseHeaders(),
    },
  );

  const json = await response.json();
  return json as Pullrequest;
};

export const getPullRequestForCommit = async (
  commitId: string,
  repo: string,
): Promise<Pullrequest | null> => {
  const url = encodeURI(
    `https://api.bitbucket.org/2.0/repositories/check24/${repo}/commit/${commitId}/pullrequests?fields=values.id`,
  );
  const response = await fetch(
    url,
    {
      headers: getBaseHeaders(),
    },
  );
  const json = await response.json();
  if (!json?.values?.[0]?.id) {
    return null;
  }

  return await getPullRequestById(json?.values?.[0]?.id, repo);
};
