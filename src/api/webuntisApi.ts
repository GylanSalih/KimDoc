// Server-side WebUntis API using the official library
import { WebUntis } from 'webuntis';

// Types for our application
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

// Convert WebUntis date format to our format
const convertWebUntisDate = (webuntisDate: number): number => {
  const year = Math.floor(webuntisDate / 10000);
  const month = Math.floor((webuntisDate % 10000) / 100);
  const day = webuntisDate % 100;
  return year * 10000 + month * 100 + day;
};

// Convert WebUntis time format to our format
const convertWebUntisTime = (webuntisTime: number): number => {
  const hour = Math.floor(webuntisTime / 100);
  const minute = webuntisTime % 100;
  return hour * 100 + minute;
};

// WebUntis API class for server-side use
class WebUntisApi {
  private untis: WebUntis | null = null;
  private isLoggedIn = false;

  constructor(
    private school: string,
    private username: string,
    private password: string,
    private server: string
  ) {
    this.initializeWebUntis();
  }

  private initializeWebUntis() {
    this.untis = new WebUntis(this.school, this.username, this.password, this.server);
  }

  async login(): Promise<boolean> {
    if (!this.untis) {
      throw new Error('WebUntis not initialized');
    }

    try {
      console.log('🔑 Logging into WebUntis...');
      await this.untis.login();
      this.isLoggedIn = true;
      console.log('✅ WebUntis login successful!');
      return true;
    } catch (error) {
      console.error('❌ WebUntis login failed:', error);
      this.isLoggedIn = false;
      throw new Error(`WebUntis login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async logout(): Promise<void> {
    if (this.untis && this.isLoggedIn) {
      try {
        await this.untis.logout();
        this.isLoggedIn = false;
        console.log('✅ WebUntis logout successful!');
      } catch (error) {
        console.error('❌ WebUntis logout failed:', error);
      }
    }
  }

  async getTimetableForWeek(weekStart: Date): Promise<Map<number, Period[]>> {
    if (!this.untis || !this.isLoggedIn) {
      throw new Error('Not logged in to WebUntis');
    }

    try {
      console.log('📅 Fetching timetable for week...');
      
      const timetable = await this.untis.getOwnTimetableForWeek(weekStart);
      
      const days = new Map<number, Period[]>();
      
      for (const lesson of timetable) {
        const date = convertWebUntisDate(lesson.date);
        const startTime = convertWebUntisTime(lesson.startTime);
        const endTime = convertWebUntisTime(lesson.endTime);
        
        const period: Period = {
          date,
          startTime,
          endTime,
          content: lesson.subjects?.[0]?.element?.name || 'Unknown Subject'
        };

        if (days.has(date)) {
          days.get(date)!.push(period);
        } else {
          days.set(date, [period]);
        }
      }

      console.log(`✅ Retrieved ${timetable.length} lessons for the week`);
      return days;
    } catch (error) {
      console.error('❌ Failed to fetch timetable:', error);
      throw new Error(`Failed to fetch timetable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTimetableForToday(): Promise<Period[]> {
    if (!this.untis || !this.isLoggedIn) {
      throw new Error('Not logged in to WebUntis');
    }

    try {
      console.log('📅 Fetching today\'s timetable...');
      
      const timetable = await this.untis.getOwnTimetableForToday();
      
      const periods: Period[] = timetable.map(lesson => {
        const date = convertWebUntisDate(lesson.date);
        const startTime = convertWebUntisTime(lesson.startTime);
        const endTime = convertWebUntisTime(lesson.endTime);
        
        return {
          date,
          startTime,
          endTime,
          content: lesson.su?.[0]?.name || 'Unknown Subject'
        };
      });

      console.log(`✅ Retrieved ${periods.length} lessons for today`);
      return periods;
    } catch (error) {
      console.error('❌ Failed to fetch today\'s timetable:', error);
      throw new Error(`Failed to fetch today's timetable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAbsences(startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.untis || !this.isLoggedIn) {
      throw new Error('Not logged in to WebUntis');
    }

    try {
      console.log('📋 Fetching absences...');
      
      const absencesData = await this.untis.getAbsentLesson(startDate, endDate);
      
      console.log(`✅ Retrieved ${absencesData.absences.length} absences`);
      return absencesData.absences;
    } catch (error) {
      console.error('❌ Failed to fetch absences:', error);
      return [];
    }
  }

  async getAllWebUntisData(weekStart?: Date): Promise<WebUntisAllData> {
    console.log('📚 Starting WebUntis data collection with official library...');
    
    if (!this.isLoggedIn) {
      await this.login();
    }
    
    const result: WebUntisAllData = {
      userInfo: {
        id: 1,
        name: this.username,
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

export { WebUntisApi };
