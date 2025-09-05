/**
 * Date utility functions for calendar operations
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export interface WeekdaySlot {
  id: number;
  date: Date;
  dayName: string;
  isSelected: boolean;
  timeSlots: TimeSlot[];
}

export interface TimeSlot {
  id: string;
  time: string;
  isAvailable: boolean;
  isSelected: boolean;
}

/**
 * Get the start of the week (Monday) for a given date
 */
export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

/**
 * Get the end of the week (Friday) for a given date
 */
export const getEndOfWeek = (date: Date): Date => {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday is 4 days after Monday
  return endOfWeek;
};

/**
 * Check if a date is a weekday (Monday to Friday)
 */
export const isWeekday = (date: Date): boolean => {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
};

/**
 * Get all weekdays in a date range
 */
export const getWeekdaysInRange = (startDate: Date, endDate: Date): Date[] => {
  const weekdays: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWeekday(current)) {
      weekdays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return weekdays;
};

/**
 * Generate weekday slots for a month
 */
export const generateWeekdaySlots = (year: number, month: number): WeekdaySlot[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Get the Monday of the first week that contains the first day of the month
  const startOfFirstWeek = getStartOfWeek(firstDay);
  
  // Get the Friday of the last week that contains the last day of the month
  const endOfLastWeek = getEndOfWeek(lastDay);
  
  const weekdays = getWeekdaysInRange(startOfFirstWeek, endOfLastWeek);
  
  return weekdays.map((date, index) => ({
    id: index,
    date: new Date(date),
    dayName: getDayName(date),
    isSelected: false,
    timeSlots: generateTimeSlots(date)
  }));
};

/**
 * Get German day name for a date
 */
export const getDayName = (date: Date): string => {
  const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return dayNames[date.getDay()];
};

/**
 * Get German month name for a date
 */
export const getMonthName = (date: Date): string => {
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return monthNames[date.getMonth()];
};

/**
 * Generate time slots for a specific date
 */
export const generateTimeSlots = (date: Date): TimeSlot[] => {
  const timeSlots: TimeSlot[] = [];
  const startHour = 8; // 8 AM
  const endHour = 18; // 6 PM
  const slotDuration = 30; // 30 minutes
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minutes = 0; minutes < 60; minutes += slotDuration) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      timeSlots.push({
        id: `${date.toISOString().split('T')[0]}-${timeString}`,
        time: timeString,
        isAvailable: true,
        isSelected: false
      });
    }
  }
  
  return timeSlots;
};

/**
 * Format date to German format (DD.MM.YYYY)
 */
export const formatDateGerman = (date: Date): string => {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Format date to German format with day name (DD.MM.YYYY - DayName)
 */
export const formatDateGermanWithDay = (date: Date): string => {
  const dayName = getDayName(date);
  const dateStr = formatDateGerman(date);
  return `${dateStr} - ${dayName}`;
};

/**
 * Check if a date is in the current month
 */
export const isCurrentMonth = (date: Date, currentDate: Date = new Date()): boolean => {
  return date.getMonth() === currentDate.getMonth() && 
         date.getFullYear() === currentDate.getFullYear();
};

/**
 * Get the number of weekdays in a month
 */
export const getWeekdayCountInMonth = (year: number, month: number): number => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return getWeekdaysInRange(firstDay, lastDay).length;
};

/**
 * Get week number for a date
 */
export const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};
