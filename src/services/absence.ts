import { AbsenceDay, AbsenceIO } from "npm:absence.io";
import { config, loadConfig } from "../utils/config.ts";
import { TimeRange } from "../types/time.ts";

await loadConfig();

interface AbsenceDayEntry extends AbsenceDay {
  reason: string;
  hours: number;
}

export interface AbsenceData {
  holidays: AbsenceDayEntry[];
  absences: AbsenceDayEntry[];
}

const reasonsMap: Record<string, string> = {
  "55c8ac81586cc0ca6dee3e3f": "Berufsschule",
  "54f81e196a72a10300e0f856": "Urlaub",
  "54f81e196a72a10300e0f858": "Krankheit",
};

const absenceIo = new AbsenceIO({
  apiKey: config.absence_apikey,
  apiKeyId: config.absence_id,
});

export const getAbsences = async (
  timeRange: TimeRange,
): Promise<[AbsenceData, boolean]> => {
  const data: AbsenceData = {
    holidays: [],
    absences: [],
  };
  console.log(
    `absences from ${timeRange.from.toISOString()} to ${timeRange.to.toISOString()}`,
  );
  const absences = await absenceIo.api.absence.retrieveAbsences({
    filter: {
      assignedToId: config.absence_id,
      reasonId: {
        // @ts-ignore api can handle...
        "$in": Object.keys(reasonsMap),
      },
    },
    start: timeRange.from.toISOString(),
    end: timeRange.to.toISOString(),
    limit: 100,
    skip: 0,
  });
  for (const absence of absences.data) {
    data.absences = data.absences.concat(
      absence.days.filter((day) =>
        !day.weekend && !day.holiday &&
        new Date(day.date) >= timeRange.from &&
        new Date(day.date) <= timeRange.to
      ).map((day) => {
        return {
          ...day,
          reason: reasonsMap[absence.reasonId] ?? "?",
          // maybe add later: offtime = worktime
          hours: 0,
        };
      }),
    );
    data.holidays = data.holidays.concat(
      absence.days.filter((day) =>
        (!day.weekend && day.holiday) &&
        (new Date(day.date) > timeRange.from &&
          new Date(day.date) < timeRange.to)
      ).map((day) => {
        return {
          ...day,
          reason: "Feiertag",
          hours: day.halfHoliday ? 4 : 8,
        };
      }),
    );
  }

  for (const day of data.absences.concat(data.holidays)) {
    if (day.reason === "Berufsschule") {
      return [data, true];
    }
  }

  return [data, false];
};
