import type { TimeRange } from "../types/time.ts";

export const getMidnightDate = (): string => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return midnight.toISOString();
};

export const getLastWeeks = (amount: number): TimeRange[] => {
  const workWeeks: TimeRange[] = [];
  const now = new Date();

  let currentDate = new Date(now);

  currentDate = new Date(Date.UTC(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    currentDate.getUTCDate(),
    0,
    0,
    0,
    0,
  ));

  while (currentDate.getUTCDay() !== 5) {
    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
  }

  currentDate = new Date(Date.UTC(
    currentDate.getUTCFullYear(),
    currentDate.getUTCMonth(),
    currentDate.getUTCDate(),
    22,
    0,
    0,
    0,
  ));

  for (let i = 0; i < amount; i++) {
    const endDate = new Date(currentDate);

    const startDate = new Date(currentDate);
    while (startDate.getUTCDay() !== 1) {
      startDate.setUTCDate(startDate.getUTCDate() - 1);
    }

    startDate.setUTCHours(0, 0, 0, 0);

    workWeeks.push({
      from: new Date(startDate),
      to: new Date(endDate),
    });

    currentDate.setUTCDate(currentDate.getUTCDate() - 7);
  }

  return workWeeks;
};

export const getCurrentWeek = (): TimeRange => {
  const from = new Date();
  from.setDate(from.getDate() + (from.getDay() === 0 ? -6 : 1) - from.getDay());
  from.setHours(from.getHours() + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  return {
    from,
    to,
  };
};

export const getTodaysDate = (): TimeRange => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  return {
    from,
    to,
  };
};

export const formatDate = (date: Date): string => {
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
};

export const formatDateRange = (
  dateStart: Date,
  dateEnd: Date,
  noNewline?: boolean,
): string => {
  return `Woche von${noNewline ? " " : "\n"}${formatDate(dateStart)}${
    noNewline ? " " : "\n"
  }bis${noNewline ? " " : "\n"}${formatDate(dateEnd)}`;
};
