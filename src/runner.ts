import { config } from "./util/config.ts";
import { type AbsenceData, getAbsences } from "./api/absence.ts";
import { getWeekNumberForDateAndCookie } from "./api/azubiheft.ts";
import { getCommitsForUser, getPullrequestsForUser } from "./api/bitbucket.ts";
import { getIssueDescription, getTicketHeading } from "./api/jira.ts";
import {
  type Auth,
  auth,
  getPeriodContent,
  getTimeTable,
  type Period,
  type PeriodInfo,
} from "../../BerichtsheftV2_Mika_Repo/berichtsheft-v2/backend/src/api/webuntis.ts";
import type { TimeRange, WeekReport } from "./types/time.ts";
import chalk from "npm:chalk";
import { ticketDescriptionToActivity } from "./util/ollama.ts";
import type { User } from "./types/bitbucket.ts";
import { formatDate } from "./util/date.ts";

interface Data {
  issueDescription: string;
  issueHeading: string;
}

const getTextForSchoolWeek = async (
  days: Map<number, Period[]> | null,
  untisAuth: Auth,
  absences: AbsenceData,
): Promise<string | null> => {
  const allSubjectsInWeek: PeriodInfo[] = [];
  let minutes = 0;

  const keys = days!.keys();

  for (const key of Array.from(keys).sort((a, b) => a - b)) {
    const day = days?.get(key);
    if (!day) continue;
    day.sort((a, b) => a.startTime - b.startTime);
    for (const period of day) {
      const info = await getPeriodContent(untisAuth, period);
      if (info) {
        minutes += info.minutesTaken;
        if (
          allSubjectsInWeek.some((value) => value.content === info.content)
        ) {
          continue;
        }
        allSubjectsInWeek.push(info);
      }
    }
  }

  if (allSubjectsInWeek.length === 0) {
    console.log(chalk.green("Status: No school"));
    return null;
  }

  let text = absences.holidays.map((holiday) => {
    return `${
      (new Date(holiday.date)).toLocaleDateString("de-DE")
    }: ${holiday.reason}\n`;
  }).join("");

  const sickLeaves = absences.absences.filter((absence) => {
    return absence.reason.includes("Krankheit");
  }).map((absence) => {
    return new Date(absence.date).toLocaleDateString("de-DE");
  });

  text += text === "" ? "" : "\n";

  const grouped = allSubjectsInWeek.reduce((acc, info) => {
    (acc[info.weekday] = acc[info.weekday] || []).push(info);
    return acc;
  }, {} as Record<string, PeriodInfo[]>);

  const weekdayOrder = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
  ];
  for (const day of weekdayOrder) {
    if (grouped[day]) {
      text += `--- ${day} ---\n`;
      if (
        sickLeaves.includes(
          new Date(grouped[day][0].date).toLocaleDateString("de-DE"),
        )
      ) {
        text += "(Krank an diesem Tag)\n";
      }

      text += grouped[day].map((info) => {
        return `Fach: ${info.name}\nInhalt: ${info.content}\n`;
      }).join("") + "\n";
    }
  }

  return text;
};

export const getTextForWeek = async (
  user: User,
  week: TimeRange,
  onStatusUpdate?: (msg: string) => void,
): Promise<WeekReport> => {
  if (!user.uuid) {
    onStatusUpdate?.("User uuid missing");
    return {
      finalString: "",
      totalHoursLost: 0,
    };
  }

  const weekNumberAndCookie = await getWeekNumberForDateAndCookie(
    week.from,
    false,
  );
  const weekInfo = `Fetching data for Week from ${formatDate(week.from)} to ${
    formatDate(week.to)
  } Number: [${weekNumberAndCookie.number}]`;
  console.log(weekInfo);
  onStatusUpdate?.(weekInfo);

  const untisAuth = await auth();
  onStatusUpdate?.("Timetable authentication completed.");
  const days = await getTimeTable(untisAuth, week.from);
  onStatusUpdate?.("Timetable fetched.");

  const [absences, isSchool] = await getAbsences({
    from: week.from,
    to: week.to,
  });
  onStatusUpdate?.("Absence data retrieved.");

  if (!days || !isSchool) {
    const noSchool = "No school week detected";
    console.log(chalk.yellow("Status: No school week detected"));
    onStatusUpdate?.(noSchool);
  } else {
    const schoolDetected = `School week detected ${
      isSchool ? "from absence" : ""
    }`;
    console.log(chalk.green(`Status: ${schoolDetected}`));
    onStatusUpdate?.(schoolDetected);
    return {
      finalString: (await getTextForSchoolWeek(days, untisAuth, absences)) ??
        "",
      totalHoursLost: 0,
    };
  }

  const scrapingMsg = `Scraping week number for ${formatDate(week.from)}`;
  console.log(scrapingMsg);
  onStatusUpdate?.(scrapingMsg);

  const allActivity = new Map<string, Data>();
  const commits = await getCommitsForUser(user.uuid, {
    from: week.from,
    to: week.to,
  });
  onStatusUpdate?.(`${commits.length} commits fetched.`);

  for (const commit of commits) {
    const match = commit.rendered.message.raw.match(/([A-Z]+-\d+)/);
    const result = match ? match[0] : null;
    if (!result || allActivity.has(result)) continue;
    const heading = await getTicketHeading(result);
    const description = await getIssueDescription(result);
    allActivity.set(result, {
      issueHeading: heading,
      issueDescription: description,
    });
  }
  onStatusUpdate?.("Processed commit activity.");

  const pullrequests = await getPullrequestsForUser(user.uuid, {
    from: week.from,
    to: week.to,
  });
  onStatusUpdate?.("Pull requests fetched.");

  for (const pullrequest of pullrequests) {
    const match = pullrequest.title?.match(/([A-Z]+-\d+)/);
    const result = match ? match[0] : null;
    if (!result || allActivity.has(result)) continue;
    const heading = await getTicketHeading(result);
    const description = await getIssueDescription(result);
    allActivity.set(result, {
      issueHeading: heading,
      issueDescription: description,
    });
  }
  onStatusUpdate?.("Processed pull request activity.");

  let totalHoursLost = 0;
  let finalString = absences.absences.map((absence) => {
    totalHoursLost += absence.reason.includes("Krankheit") ? 8 : absence.hours;
    return `${(new Date(absence.date)).toLocaleDateString("de-DE")}:${
      absence.hours === 4 ? " 1/2 Tag" : ""
    } ${absence.reason}\n`;
  }).join("");

  finalString += absences.holidays.map((holiday) => {
    totalHoursLost += holiday.halfHoliday ? 4 : 8;
    return `${(new Date(holiday.date)).toLocaleDateString("de-DE")}:${
      holiday.halfHoliday ? " 1/2 Tag" : ""
    } ${holiday.reason}\n`;
  }).join("");

  finalString += finalString === "" ? "" : "\n";

  onStatusUpdate?.("Gathering ticket activity details...");

  if (config.ai_method === "gpt") {
    finalString += (await Promise.all(
      Array.from(allActivity.entries()).map(async ([key, data]) => {
        const activity = await ticketDescriptionToActivity(
          data.issueDescription,
        );
        return `${key}: ${data.issueHeading}\n${activity}\n`;
      }),
    )).join("");
  } else {
    let tmpString = "";
    for (const [key, data] of allActivity.entries()) {
      const activity = await ticketDescriptionToActivity(data.issueDescription);
      tmpString += `${key}: ${data.issueHeading}\n${activity}\n`;
    }
    finalString += tmpString;
  }

  if (finalString === "") {
    const noDataMsg = "No Data";
    console.log(chalk.red(`Status: ${noDataMsg}`));
    onStatusUpdate?.(noDataMsg);
    return {
      finalString: "",
      totalHoursLost: 0,
    };
  }

  const completionMsg = "Completed processing week data.";
  console.log(chalk.green(`Status: ${completionMsg}`));
  onStatusUpdate?.(completionMsg);
  return {
    finalString,
    totalHoursLost,
  };
};
