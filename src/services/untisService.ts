import { config } from '../utils/config';

// Types
export interface Auth {
  cookie: string;
  token: string;
  baseUrl: string;
  school?: {
    name: string;
    server: string;
    loginName: string;
    address: string;
    sessionId: string;
  };
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
  timetable: WebUntisLesson[];
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

// Removed unused formatDate function

const formatDateToString = (date: Date): string => {
  return date.toLocaleDateString('de-DE');
};

// Removed unused formatDateForWebUntis function

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

// Simple direct login authentication (like manual login)
export const auth = async (): Promise<Auth> => {
  console.log('🌐 WebUntis Direct Login Authentication');
  
  if (!config.untis_username || !config.untis_password) {
    throw new Error('WebUntis-Benutzername oder Passwort fehlt in der config.json');
  }

  console.log(`🔑 Direct login for user: ${config.untis_username}`);
  
  try {
    // Direct authentication to the known Heinrich-Hertz-Schule endpoint
    const authUrl = 'https://ajax.webuntis.com/WebUntis/jsonrpc.do?school=heinrich-hertz-Schule';
    
    console.log(`🏫 Using direct auth URL: ${authUrl}`);
    
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WebUntis-App/1.0',
      },
      body: JSON.stringify({
        id: 'auth',
        method: 'authenticate',
        params: {
          user: config.untis_username,
          password: config.untis_password,
          client: 'DENO'
        },
        jsonrpc: '2.0'
      })
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication request failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    console.log('🔐 Auth response:', authData);

    if (authData.error) {
      throw new Error(`Authentication failed: ${authData.error.message}`);
    }

    if (!authData.result?.sessionId) {
      throw new Error('No session ID received from authentication');
    }

    console.log('✅ Direct authentication successful!');
    
    return {
      cookie: `JSESSIONID=${authData.result.sessionId}`,
      token: authData.result.sessionId,
      baseUrl: 'https://ajax.webuntis.com/WebUntis',
      school: {
        name: 'Städt. Heinrich-Hertz-Schule',
        server: 'ajax.webuntis.com',
        loginName: 'heinrich-hertz-Schule',
        address: '40225, Düsseldorf, Redinghovenstraße 16',
        sessionId: authData.result.sessionId
      }
    };

  } catch (error) {
    console.error('❌ WebUntis direct authentication failed:', error);
    throw new Error(`WebUntis-Authentifizierung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
};

// Helper function to get element ID (browser-style)
const getElementIdBrowser = async (auth: Auth): Promise<number> => {
  console.log('🔍 Getting element ID via browser API...');
  const today = new Date();
  const dateString = today.toLocaleDateString('de-DE').split('.').reverse().join('-');
  
  const response = await fetch(`https://ajax.webuntis.com/WebUntis/api/public/timetable/weekly/pageconfig?type=5&date=${dateString}&isMyTimetableSelected=true`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Not?A_Brand";v="99", "Chromium";v="130"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'cookie': auth.cookie,
      'Referer': 'https://ajax.webuntis.com/WebUntis/embedded.do?showSidebar=false',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get element ID: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const elementId = json?.data?.elements?.[0]?.id;
  
  if (!elementId) {
    throw new Error('Could not find element ID in response');
  }

  console.log(`✅ Element ID found: ${elementId}`);
  return elementId;
};

// Helper function to get timetable data (browser-style)
const getTimeTableDataBrowser = async (auth: Auth, weekStart: Date): Promise<any[]> => {
  console.log('📅 Getting timetable data via browser API...');
  const elementId = await getElementIdBrowser(auth);
  const dateString = weekStart.toISOString().split('T')[0];
  
  const response = await fetch(`https://ajax.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=5&elementId=${elementId}&date=${dateString}&formatId=5`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Not?A_Brand";v="99", "Chromium";v="130"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'cookie': auth.cookie,
      'Referer': 'https://ajax.webuntis.com/WebUntis/embedded.do?showSidebar=false',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get timetable data: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const periods = json?.data?.result?.data?.elementPeriods?.[elementId] || [];
  
  console.log(`✅ Retrieved ${periods.length} timetable periods`);
  return periods;
};

// Mobile JSON-RPC helper function
const makeWebUntisCall = async (auth: Auth, method: string, params: any = {}): Promise<any> => {
  const response = await fetch(`${auth.baseUrl}/jsonrpc.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'WebUntis-App/1.0',
      'Cookie': auth.cookie
    },
    body: JSON.stringify({
      id: Date.now().toString(),
      method: method,
      params: params,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`WebUntis API request failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`WebUntis API Error: ${data.error.message}`);
  }

  return data.result;
};

// Mobile API data collection (CORS-friendly)
export const getAllWebUntisData = async (): Promise<WebUntisAllData> => {
  console.log('📚 Starting mobile API WebUntis data collection...');
  
  // Get authentication using mobile API
  const authData = await auth();
  
  // Prepare result object
  const result: WebUntisAllData = {
    userInfo: {
      id: 1,
      name: config.untis_username || 'Student',
      type: 'student',
      rights: ['VIEW_TIMETABLE']
    },
    timetable: [],
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
    // Get current week's dates
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    const startDate = monday.getFullYear() * 10000 + (monday.getMonth() + 1) * 100 + monday.getDate();
    const endDate = sunday.getFullYear() * 10000 + (sunday.getMonth() + 1) * 100 + sunday.getDate();

    console.log(`📅 Fetching timetable from ${startDate} to ${endDate}...`);

    // Get user info first to get student ID
    let studentId = 0;
    try {
      const userInfo = await makeWebUntisCall(authData, 'getCurrentSchoolyear');
      console.log('📋 Current school year:', userInfo);
    } catch (error) {
      console.log('⚠️ Could not get user info, using default student ID');
    }

    // Get timetable using mobile API
    try {
      const timetableData = await makeWebUntisCall(authData, 'getTimetable', {
        options: {
          startDate: startDate,
          endDate: endDate,
          showBooking: true,
          showInfo: true,
          showSubstText: true,
          showLsText: true,
          showStudentgroup: true,
          klasseFields: ['id', 'name', 'longname'],
          roomFields: ['id', 'name', 'longname'],
          subjectFields: ['id', 'name', 'longname'],
          teacherFields: ['id', 'name', 'longname']
        }
      });

      console.log(`📚 Raw timetable data:`, timetableData);

      // Convert to our format
      if (Array.isArray(timetableData)) {
        result.timetable = timetableData.map((lesson: any) => ({
          id: lesson.id || 0,
          date: lesson.date || 0,
          startTime: lesson.startTime || 0,
          endTime: lesson.endTime || 0,
          subject: lesson.su?.[0]?.longname || lesson.su?.[0]?.name || 'Unbekannt',
          teacher: lesson.te?.[0]?.longname || lesson.te?.[0]?.name || 'Unbekannt',
          room: lesson.ro?.[0]?.longname || lesson.ro?.[0]?.name || 'Unbekannt',
          info: lesson.info || '',
          code: lesson.code || 'regular'
        }));
      }

      console.log(`✅ Retrieved ${result.timetable.length} timetable entries`);

    } catch (error) {
      console.error('⚠️ Could not fetch timetable:', error);
    }

    // Extract unique teachers and subjects
    const teacherSet = new Set<string>();
    const subjectSet = new Set<string>();

    result.timetable.forEach(lesson => {
      if (lesson.teacher && lesson.teacher !== 'Unbekannt') {
        teacherSet.add(lesson.teacher);
      }
      if (lesson.subject && lesson.subject !== 'Unbekannt') {
        subjectSet.add(lesson.subject);
      }
    });

    result.teachers = Array.from(teacherSet).map((name, index) => ({
      id: index + 1,
      name: name,
      shortName: name.split(' ').map(n => n[0]).join(''),
      email: ''
    }));

    result.subjects = Array.from(subjectSet).map((name, index) => ({
      id: index + 1,
      name: name,
      shortName: name.substring(0, 3).toUpperCase(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    }));

    // Try to get homework (optional)
    try {
      const homeworkData = await makeWebUntisCall(authData, 'getHomework', {
        startDate: startDate,
        endDate: endDate
      });
      
      if (Array.isArray(homeworkData)) {
        result.homework = homeworkData.map((hw: any) => ({
          id: hw.id || 0,
          lessonId: hw.lessonId || 0,
          date: hw.date || 0,
          dueDate: hw.dueDate || 0,
          subject: hw.subject || 'Unbekannt',
          teacher: hw.teacher || 'Unbekannt',
          text: hw.text || '',
          remark: hw.remark || '',
          completed: hw.completed || false
        }));
      }
      console.log(`✅ Retrieved ${result.homework.length} homework entries`);
    } catch (error) {
      console.log('⚠️ Could not fetch homework (might not be available):', error);
    }

    // Update summary
    result.summary = {
      totalLessons: result.timetable.length,
      totalHomework: result.homework.length,
      totalExams: result.exams.length,
      weekRange: `${formatDateToString(monday)} - ${formatDateToString(sunday)}`,
      lastUpdated: new Date().toISOString()
    };

    console.log('🎉 Mobile API WebUntis data collection completed successfully!');
    console.log(`📊 Summary: ${result.summary.totalLessons} Stunden, ${result.teachers.length} Lehrer, ${result.subjects.length} Fächer`);
    
    return result;

  } catch (error) {
    console.error('❌ Error during mobile API WebUntis data collection:', error);
    throw new Error(`Fehler beim Abrufen der WebUntis-Daten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
};

// Additional functions that your colleague might have (optional)
export const getTimeTable = async (
  auth: Auth,
  weekStart: Date,
): Promise<Map<number, Period[]> | null> => {
  try {
    const periods = await getTimeTableDataBrowser(auth, weekStart);
    const days = new Map();
    
    if (!periods || periods.length === 0) {
      return null;
    }
    
    for (const period of periods) {
      if (days.has(period.date)) {
        days.set(period.date, [...days.get(period.date), period]);
      } else {
        days.set(period.date, [period]);
      }
    }
    
    return days;
  } catch (error) {
    console.error('Error in getTimeTable:', error);
    return null;
  }
};

export const getPeriodContent = async (
  auth: Auth,
  period: Period,
): Promise<PeriodInfo | null> => {
  try {
    const elementId = await getElementIdBrowser(auth);
    const response = await fetch(
      `https://ajax.webuntis.com/WebUntis/api/rest/view/v2/calendar-entry/detail?elementId=${elementId}&elementType=5&endDateTime=${
        encodeURI(formatDateTime(period.date, period.endTime))
      }&homeworkOption=DUE&startDateTime=${
        encodeURI(formatDateTime(period.date, period.startTime))
      }`,
      {
        "headers": {
          "accept": "application/json, text/plain, */*",
          "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "authorization": `Bearer ${auth.token}`,
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "priority": "u=1, i",
          "sec-ch-ua": '"Not?A_Brand";v="99", "Chromium";v="130"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-webuntis-api-school-year-id": "16",
          "cookie": auth.cookie,
          "Referer": "https://ajax.webuntis.com/",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
        "body": null,
        "method": "GET",
      },
    );
    
    const json = await response.json();
    if (!json.calendarEntries || json.calendarEntries.length === 0) return null;
    
    if (json.calendarEntries[0].teachingContent) {
      return {
        content: json.calendarEntries[0].teachingContent,
        name: `${json.calendarEntries[0]?.subject?.shortName ?? "-"} - ${
          json.calendarEntries[0]?.teachers[0]?.longName ?? "-"
        }`,
        date: formatDateTime(period.date, period.startTime),
        minutesTaken: getMinutesBetweenTimes(
          period.startTime,
          period.endTime,
        ),
        weekday: getWeekdayName(period.date),
      };
    }
    
    for (const entry of json.calendarEntries) {
      if (!entry.teachingContent) {
        continue;
      }
      return {
        content: entry.teachingContent,
        name: `${entry?.subject?.shortName ?? "-"} - ${
          entry?.teachers[0]?.longName ?? ""
        }`,
        date: formatDateTime(period.date, period.startTime),
        minutesTaken: getMinutesBetweenTimes(
          period.startTime,
          period.endTime,
        ),
        weekday: getWeekdayName(period.date),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in getPeriodContent:', error);
    return null;
  }
};