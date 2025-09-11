import { config, loadConfig } from '../utils/config';

// Types for our application (keeping compatibility with existing code)
export interface Auth {
  cookie: string;
  token: string;
}

export interface Period {
  date: number;
  startTime: number;
  endTime: number;
  content?: string | null;
}

export interface PeriodInfo {
  content: string;
  name: string;
  date: string;
  minutesTaken: number;
  weekday: string;
}

export interface WebUntisUser {
  id: number;
  name: string;
  type: string;
  rights: string[];
}

export interface WebUntisLesson {
  id: number;
  date: number;
  startTime: number;
  endTime: number;
  subject: string;
  teacher: string;
  room: string;
  info: string;
  code: string;
}

export interface WebUntisHomework {
  id: number;
  lessonId: number;
  date: number;
  dueDate: number;
  subject: string;
  teacher: string;
  text: string;
  remark: string;
  completed: boolean;
}

export interface WebUntisExam {
  id: number;
  date: number;
  startTime: number;
  endTime: number;
  subject: string;
  teacher: string;
  name: string;
  info: string;
}

export interface WebUntisTeacher {
  id: number;
  name: string;
  shortName: string;
  email: string;
}

export interface WebUntisSubject {
  id: number;
  name: string;
  shortName: string;
  color: string;
}

export interface WebUntisSummary {
  totalLessons: number;
  totalHomework: number;
  totalExams: number;
  weekRange: string;
  lastUpdated: string;
}

export interface WebUntisAllData {
  userInfo: WebUntisUser | null;
  timetable: Map<number, Period[]>;
  homework: WebUntisHomework[];
  exams: WebUntisExam[];
  teachers: WebUntisTeacher[];
  subjects: WebUntisSubject[];
  summary: WebUntisSummary;
}

// Helper functions
const formatDateTime = (date: number, time: number): string => {
  const year = Math.floor(date / 10000);
  const month = Math.floor((date % 10000) / 100);
  const day = date % 100;
  const hour = Math.floor(time / 100);
  const minute = time % 100;
  const formattedDate = `${year.toString().padStart(4, "0")}-${
    month.toString().padStart(2, "0")
  }-${day.toString().padStart(2, "0")}`;
  const formattedTime = `${hour.toString().padStart(2, "0")}:${
    minute.toString().padStart(2, "0")
  }:00`;
  return `${formattedDate}T${formattedTime}`;
};

const getMinutesBetweenTimes = (startTime: number, endTime: number): number => {
  const startHour = Math.floor(startTime / 100);
  const startMinute = startTime % 100;
  const endHour = Math.floor(endTime / 100);
  const endMinute = endTime % 100;
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  return endTotalMinutes - startTotalMinutes;
};

const getWeekdayName = (dateNumber: number): string => {
  const year = Math.floor(dateNumber / 10000);
  const month = Math.floor((dateNumber % 10000) / 100);
  const day = dateNumber % 100;
  const date = new Date(year, month - 1, day);
  const weekdays = [
    "Sonntag",
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
  ];
  return weekdays[date.getDay()] || "Unbekannt";
};

// Client-side WebUntis service that communicates via proxy
class WebUntisService {
  private isLoggedIn = false;
  private authData: Auth | null = null;

  constructor() {
    // Initialize when needed
  }

  async login(): Promise<boolean> {
    try {
      console.log('🔑 Logging into WebUntis via proxy...');
      
      // Ensure config is loaded
      await loadConfig();

      if (!config.untis_username || !config.untis_password) {
        throw new Error('WebUntis credentials not found in config');
      }

      const response = await fetch('http://localhost:3001/api/webuntis-official/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          school: config.untis_school || 'heinrich-hertz-schule',
          username: config.untis_username,
          password: config.untis_password,
          server: config.untis_server || 'ajax.webuntis.com'
        })
      });

      if (!response.ok) {
        throw new Error(`Login request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Login failed');
      }

      this.authData = {
        cookie: data.sessionId || 'webuntis-session',
        token: data.token || 'webuntis-token'
      };

      this.isLoggedIn = true;
      console.log('✅ WebUntis login successful via proxy!');
      return true;

    } catch (error) {
      console.error('❌ WebUntis login failed:', error);
      this.isLoggedIn = false;
      throw new Error(`WebUntis login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async logout(): Promise<void> {
    if (this.isLoggedIn && this.authData) {
      try {
        const response = await fetch('http://localhost:3001/api/webuntis-official/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.authData.cookie
          })
        });

        if (response.ok) {
          console.log('✅ WebUntis logout successful!');
        }
      } catch (error) {
        console.error('❌ WebUntis logout failed:', error);
      }
    }
    
    this.isLoggedIn = false;
    this.authData = null;
  }

  async getTimetableForWeek(weekStart: Date): Promise<Map<number, Period[]>> {
    if (!this.isLoggedIn || !this.authData) {
      throw new Error('Not logged in to WebUntis');
    }

    try {
      console.log('📅 Fetching timetable for week via proxy...');
      
      const response = await fetch('http://localhost:3001/api/webuntis-official/timetable-week', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.authData.cookie,
          weekStart: weekStart.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Timetable request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch timetable');
      }

      const days = new Map<number, Period[]>();
      
      for (const period of data.periods || []) {
        if (days.has(period.date)) {
          days.get(period.date)!.push(period);
        } else {
          days.set(period.date, [period]);
        }
      }

      console.log(`✅ Retrieved ${data.periods?.length || 0} periods for the week`);
      return days;
    } catch (error) {
      console.error('❌ Failed to fetch timetable:', error);
      throw new Error(`Failed to fetch timetable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTimetableForToday(): Promise<Period[]> {
    if (!this.isLoggedIn || !this.authData) {
      throw new Error('Not logged in to WebUntis');
    }

    try {
      console.log('📅 Fetching today\'s timetable via proxy...');
      
      const response = await fetch('http://localhost:3001/api/webuntis-official/timetable-today', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.authData.cookie
        })
      });

      if (!response.ok) {
        throw new Error(`Timetable request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch today\'s timetable');
      }

      console.log(`✅ Retrieved ${data.periods?.length || 0} periods for today`);
      return data.periods || [];
    } catch (error) {
      console.error('❌ Failed to fetch today\'s timetable:', error);
      throw new Error(`Failed to fetch today's timetable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPeriodContent(period: Period): Promise<PeriodInfo | null> {
    try {
      return {
        content: period.content || 'No content available',
        name: period.content || 'Unknown Subject',
        date: formatDateTime(period.date, period.startTime),
        minutesTaken: getMinutesBetweenTimes(period.startTime, period.endTime),
        weekday: getWeekdayName(period.date),
      };
    } catch (error) {
      console.error('Error in getPeriodContent:', error);
      return null;
    }
  }

  async getAbsences(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.isLoggedIn || !this.authData) {
      throw new Error('Not logged in to WebUntis');
    }

    try {
      console.log('📋 Fetching absences via proxy...');
      
      const response = await fetch('http://localhost:3001/api/webuntis-official/absences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.authData.cookie,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Absences request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        return [];
      }

      console.log(`✅ Retrieved ${data.absences?.length || 0} absences`);
      return data.absences || [];
    } catch (error) {
      console.error('❌ Failed to fetch absences:', error);
      return [];
    }
  }

  async getAllWebUntisData(weekStart?: Date): Promise<WebUntisAllData> {
    console.log('📚 Starting WebUntis data collection via proxy...');
    
    if (!this.isLoggedIn) {
      await this.login();
    }
    
    const result: WebUntisAllData = {
      userInfo: {
        id: 1,
        name: config.untis_username || 'Student',
        type: 'student',
        rights: ['VIEW_TIMETABLE']
      },
      timetable: new Map(),
      homework: [],
      exams: [],
      teachers: [],
      subjects: [],
      summary: {
        totalLessons: 0,
        totalHomework: 0,
        totalExams: 0,
        weekRange: '',
        lastUpdated: new Date().toISOString()
      }
    };

    try {
      const monday = weekStart || (() => {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        return monday;
      })();
      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

      console.log(`📅 Fetching timetable for week ${monday.toLocaleDateString('de-DE')} - ${sunday.toLocaleDateString('de-DE')}...`);

      try {
        const timetableData = await this.getTimetableForWeek(monday);
        result.timetable = timetableData;
        console.log(`✅ Retrieved ${timetableData.size} days with timetable data`);
      } catch (error) {
        console.error('⚠️ Could not fetch timetable:', error);
      }

      try {
        const absences = await this.getAbsences(monday, sunday);
        console.log(`✅ Retrieved ${absences.length} absences`);
      } catch (error) {
        console.error('⚠️ Could not fetch absences:', error);
      }

      const totalLessons = Array.from(result.timetable.values()).reduce((total, periods) => total + periods.length, 0);
      result.summary = {
        totalLessons: totalLessons,
        totalHomework: result.homework.length,
        totalExams: result.exams.length,
        weekRange: `${monday.toLocaleDateString('de-DE')} - ${sunday.toLocaleDateString('de-DE')}`,
        lastUpdated: new Date().toISOString()
      };

      console.log('🎉 WebUntis data collection completed successfully!');
      console.log(`📊 Summary: ${result.summary.totalLessons} Stunden`);
      
      return result;

    } catch (error) {
      console.error('❌ Error during WebUntis data collection:', error);
      throw new Error(`Fehler beim Abrufen der WebUntis-Daten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }
}

// Export singleton instance
export const webUntisService = new WebUntisService();

// Export individual functions for compatibility with existing code
export const auth = async () => {
  await webUntisService.login();
  return { cookie: 'webuntis-session', token: 'webuntis-token' };
};

export const getTimeTable = async (_authData: any, weekStart: Date) => {
  return await webUntisService.getTimetableForWeek(weekStart);
};

export const getAllWebUntisData = async (_authData?: any, weekStart?: Date) => {
  return await webUntisService.getAllWebUntisData(weekStart);
};

export const getPeriodContent = async (_authData: any, period: Period) => {
  return await webUntisService.getPeriodContent(period);
};

export const getAbsences = async (_authData: any, startDate: Date, endDate: Date) => {
  return await webUntisService.getAbsences(startDate, endDate);
};