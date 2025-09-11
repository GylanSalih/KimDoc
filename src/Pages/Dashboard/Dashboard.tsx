import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Settings, Zap, CheckCircle, XCircle, Loader, Brain, BookOpen } from 'lucide-react';
import './Dashboard.scss';
import { 
  getStartOfWeek,
  getEndOfWeek,
  formatDateGerman
} from '../../utils/dateUtils';
import { auth, getAllWebUntisData, getAbsences, type Auth, type PeriodInfo } from '../../services/webuntisOfficial';
import { logineoService, generateAssignmentOverview } from '../../services/logineoService';
import BerichtsheftGenerator from '../../components/BerichtsheftGenerator/BerichtsheftGenerator';
// Temporarily disabled problematic imports
// import { getAbsences, type AbsenceData } from '../../services/absence';
// import { getCommitsForUser, getPullrequestsForUser, getUser } from '../../services/bitbucket';
// import type { User as BitbucketUser } from '../../types/bitbucket';
// import { getTicketHeading } from '../../services/jira';
import { config, loadConfig } from '../../utils/config';
// import type { TimeRange } from '../../types/time';
import { generateAIContent, testAIConnection } from '../../services/aiService';
import { logineoStorage } from '../../utils/logineoStorage';

interface WeekBlock {
  id: number;
  startDate: Date;
  endDate: Date;
  isSelected: boolean;
  untisData?: PeriodInfo[];
  // Temporarily disabled other data types
  // absenceData?: AbsenceData;
  // bitbucketData?: {
  //   commits: any[];
  //   pullRequests: any[];
  // };
  // jiraData?: {
  //   tickets: any[];
  // };
}

const Dashboard: React.FC = () => {
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const [textareaValue, setTextareaValue] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [apiSettings, setApiSettings] = useState({
    // Temporarily disabled problematic APIs
    // jira: { enabled: false, url: '', token: '', username: '' },
    // bitbucket: { enabled: false, username: '', appPassword: '', repos: [] as string[] },
    untis: { enabled: false, username: '', password: '' },
    logineo: { enabled: false },
    // absence: { enabled: false, id: '', apikey: '' },
    // azubiheft: { enabled: false, username: '', password: '' },
    ai: { enabled: false, method: 'groq', openaiKey: '', groqKey: '', ollamaModel: 'llama-3.1-8b-instant' }
  });
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'disconnected' | 'connecting' | 'connected' | 'error'>>({
    untis: 'disconnected',
    logineo: 'disconnected',
    ai: 'disconnected'
    // Temporarily disabled other connection statuses
    // jira: 'disconnected',
    // bitbucket: 'disconnected',
    // absence: 'disconnected',
    // azubiheft: 'disconnected'
  });
  const [connectionMessages, setConnectionMessages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  // Temporarily disabled problematic state
  // const [bitbucketUser, setBitbucketUser] = useState<BitbucketUser | null>(null);
  const [untisAuth, setUntisAuth] = useState<Auth | null>(null);

  // Load config and check for stored Logineo credentials on component mount
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const loadedConfig = await loadConfig();
        if (loadedConfig) {
          // Update API settings with loaded config (only available services)
          setApiSettings(prev => ({
            ...prev,
            untis: {
              ...prev.untis,
              username: loadedConfig.untis_username || '',
              password: loadedConfig.untis_password || ''
            },
            ai: {
              ...prev.ai,
              method: loadedConfig.ai_method || 'groq',
              openaiKey: loadedConfig.openai_key || '',
              groqKey: loadedConfig.groq_key || '',
              ollamaModel: loadedConfig.ollama_model || 'llama-3.1-8b-instant'
            }
          }));
        }

        // Note: Logineo connection restoration is handled in the separate useEffect below
      } catch (error) {
        console.error('Failed to load config:', error);
        // Continue with default settings if config loading fails
      }
    };
    
    initializeConfig();
  }, []);

  // Sync Logineo enabled status with localStorage (only after initial load)
  useEffect(() => {
    // Only sync if we have stored credentials and the component has been initialized
    const storedCredentials = logineoStorage.loadCredentials();
    if (storedCredentials && storedCredentials.isLoggedIn && apiSettings.logineo.enabled !== undefined) {
      logineoStorage.setEnabled(apiSettings.logineo.enabled);
    }
  }, [apiSettings.logineo.enabled]);

  // Generate available months (next 3 years until August 2028)
  const availableMonths = useMemo(() => {
    const months = [];
    const today = new Date();
    const endDate = new Date(2028, 7, 31); // August 2028
    
    let currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
    
    while (currentDate <= endDate) {
      months.push(new Date(currentDate));
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  }, []);

  // Generate weeks for selected month
  const weeks = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const weeks: WeekBlock[] = [];
    let weekId = 0;
    
    // Start from the Monday of the first week that contains the first day of the month
    const startOfFirstWeek = getStartOfWeek(firstDay);
    
    // Get the Friday of the last week that contains the last day of the month
    const endOfLastWeek = getEndOfWeek(lastDay);
    
    let currentDate = new Date(startOfFirstWeek);
    while (currentDate <= endOfLastWeek) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekStart.getDate() + 4); // Friday is 4 days after Monday
      
      weeks.push({
        id: weekId++,
        startDate: new Date(weekStart),
        endDate: new Date(weekEnd),
        isSelected: false
      });
      
      currentDate.setDate(currentDate.getDate() + 7); // Move to next week
    }
    
    return weeks;
  }, [selectedMonth]);

  const handleWeekClick = (weekId: number) => {
    const newSelectedWeeks = new Set(selectedWeeks);
    if (newSelectedWeeks.has(weekId)) {
      newSelectedWeeks.delete(weekId);
    } else {
      newSelectedWeeks.add(weekId);
    }
    setSelectedWeeks(newSelectedWeeks);
  };

  const handleGenerate = async () => {
    if (selectedWeeks.size === 0) return;
    
    setIsGenerating(true);
    setGenerationProgress('Starte Generierung...');
    
    const selectedWeeksData = weeks.filter(week => selectedWeeks.has(week.id));
    let reportText = `Ausgewählte Wochen für Berichtsheft:\n`;
    
    try {
      for (const week of selectedWeeksData) {
        setGenerationProgress(`Verarbeite Woche ${week.id + 1}...`);
        reportText += `\nWoche ${week.id + 1}: ${formatDateGerman(week.startDate)} - ${formatDateGerman(week.endDate)}\n`;
        
        // TimeRange for potential future use with other APIs
        // const timeRange: TimeRange = {
        //   from: week.startDate,
        //   to: week.endDate
        // };
        
                  // Fetch comprehensive WebUntis data if connected
        if (connectionStatus.untis === 'connected' && untisAuth) {
          setGenerationProgress(`Lade alle WebUntis-Daten für Woche ${week.id + 1}...`);
          reportText += `📚 WebUntis-Daten für Woche ${week.id + 1}:\n`;
          
          try {
            console.log(`Loading comprehensive WebUntis data for week ${week.id + 1} starting ${week.startDate.toISOString()}`);
            
            // Use the comprehensive API approach
            const webUntisData = await getAllWebUntisData(untisAuth, week.startDate);
            
            // 1. User Info
            if (webUntisData.userInfo) {
              const user = webUntisData.userInfo;
              reportText += `  👤 Schüler: ${user.name || 'Unbekannt'}\n`;
              reportText += `  🏫 Klasse: Unbekannt\n`;
            } else {
              reportText += `  👤 Schüler: Benutzerdaten nicht verfügbar\n`;
              reportText += `  🏫 Klasse: Klassendaten nicht verfügbar\n`;
            }
            
            // 2. Timetable
            if (webUntisData.timetable && webUntisData.timetable.size > 0) {
              console.log(`Found ${webUntisData.timetable.size} days with periods`);
              const allPeriods: PeriodInfo[] = [];
              
              // Process all periods from the timetable
              for (const [date, periods] of webUntisData.timetable) {
                console.log(`Processing ${periods.length} periods for date ${date}`);
                for (const period of periods) {
                  // Create period info from the detailed period data
                  const formatDateTime = (date: number, time: number): string => {
                    const year = Math.floor(date / 10000);
                    const month = Math.floor((date % 10000) / 100);
                    const day = date % 100;
                    const hour = Math.floor(time / 100);
                    const minute = time % 100;
                    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
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
                    const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
                    return weekdays[date.getDay()] || "Unbekannt";
                  };
                  
                  // Use detailed info if available, otherwise fallback to basic info
                  const subject = (period as any).subject || 'Unbekannt';
                  const teacher = (period as any).teacher || 'Unbekannt';
                  const room = (period as any).room || 'Unbekannt';
                  const code = (period as any).code || 'regular';
                  const content = (period as any).content || period.content || 'Unterrichtsinhalt nicht verfügbar';
                  
                  // Create a descriptive name based on available info
                  let name = '';
                  if (subject !== 'Unbekannt' && teacher !== 'Unbekannt') {
                    name = `${subject} - ${teacher}`;
                  } else if (subject !== 'Unbekannt') {
                    name = subject;
                  } else {
                    name = `Stunde ${Math.floor(period.startTime / 100)}:${(period.startTime % 100).toString().padStart(2, '0')}`;
                  }
                  
                  // Add room info if available
                  if (room !== 'Unbekannt') {
                    name += ` (${room})`;
                  }
                  
                  // Add code info for special cases (entfall, etc.)
                  if (code !== 'regular') {
                    name += ` [${code}]`;
                  }
                  
                  const periodInfo: PeriodInfo = {
                    content: content,
                    name: name,
                    date: formatDateTime(period.date, period.startTime),
                    minutesTaken: getMinutesBetweenTimes(period.startTime, period.endTime),
                    weekday: getWeekdayName(period.date)
                  };
                  
                  allPeriods.push(periodInfo);
                  console.log(`Added period: ${periodInfo.name}`);
                }
              }
              
              if (allPeriods.length > 0) {
                console.log(`Total periods processed: ${allPeriods.length}`);
                const groupedByDay = allPeriods.reduce((acc, info) => {
                  const day = info.weekday;
                  if (!acc[day]) acc[day] = [];
                  acc[day]!.push(info);
                  return acc;
                }, {} as Record<string, PeriodInfo[]>);
                
                // Focus on important info: teachers, cancellations, absences
                const importantInfo = [];
                const cancellations = [];
                const teachers = new Set();
                
                Object.entries(groupedByDay).forEach(([day, periods]) => {
                  periods.forEach(period => {
                    const startTime = period.date && period.date.includes('T') ? period.date.split('T')[1]?.substring(0, 5) : 'Unbekannt';
                    
                    // Extract teacher info
                    if (period.name.includes(' - ')) {
                      const teacher = period.name.split(' - ')[1]?.split(' (')[0];
                      if (teacher && teacher !== 'Unbekannt') {
                        teachers.add(teacher);
                      }
                    }
                    
                    // Check for cancellations/entfall - be more comprehensive
                    const isCancellation = period.name.toLowerCase().includes('entfall') || 
                                         period.name.toLowerCase().includes('cancelled') || 
                                         period.name.toLowerCase().includes('ausfall') ||
                                         period.name.toLowerCase().includes('fällt aus') ||
                                         (period as any).code === 'cancelled' ||
                                         (period as any).code === 'entfall';
                    
                    const isSubstitution = period.name.toLowerCase().includes('vertretung') || 
                                         period.name.toLowerCase().includes('substitution') ||
                                         period.name.toLowerCase().includes('vertr.') ||
                                         (period as any).code === 'substitution' ||
                                         (period as any).code === 'vertretung';
                    
                    if (isCancellation) {
                      cancellations.push(`${day} ${startTime}: ${period.name}`);
                    }
                    
                    if (isSubstitution) {
                      importantInfo.push(`${day} ${startTime}: ${period.name}`);
                    }
                    
                    // Also check for other important codes
                    if ((period as any).code && (period as any).code !== 'regular') {
                      importantInfo.push(`${day} ${startTime}: ${period.name} [${(period as any).code}]`);
                    }
                  });
                });
                
                reportText += `  📅 Stundenplan (${allPeriods.length} Stunden):\n`;
                
                // Show teachers
                if (teachers.size > 0) {
                  reportText += `    👨‍🏫 Lehrer: ${Array.from(teachers).join(', ')}\n`;
                }
                
                // Show cancellations/entfall
                if (cancellations.length > 0) {
                  reportText += `    ❌ Entfälle/Vertretungen:\n`;
                  cancellations.forEach(cancellation => {
                    reportText += `      - ${cancellation}\n`;
                  });
                } else {
                  reportText += `    ❌ Entfälle: Keine für diese Woche\n`;
                }
                
                // Show other important info
                if (importantInfo.length > 0) {
                  reportText += `    ⚠️ Wichtige Änderungen:\n`;
                  importantInfo.forEach(info => {
                    reportText += `      - ${info}\n`;
                  });
                }
              } else {
                reportText += `    📅 Stundenplan: Keine Stunden gefunden\n`;
              }
            } else {
              reportText += `    📅 Stundenplan: Keine Daten für diese Woche verfügbar\n`;
            }
            
            // 3. Homework
            if (webUntisData.homework && webUntisData.homework.length > 0) {
              reportText += `  📝 Hausaufgaben (${webUntisData.homework.length}):\n`;
              webUntisData.homework.forEach((hw: any) => {
                const dueDate = hw.dueDate ? new Date(hw.dueDate).toLocaleDateString('de-DE') : 'Unbekannt';
                reportText += `    - ${hw.subject || 'Unbekanntes Fach'}: ${hw.text || hw.description || 'Keine Beschreibung'} (Fällig: ${dueDate})\n`;
              });
            } else {
              reportText += `    📝 Hausaufgaben: Keine für diese Woche\n`;
            }
            
            // 4. Exams
            if (webUntisData.exams && webUntisData.exams.length > 0) {
              reportText += `  📋 Prüfungen (${webUntisData.exams.length}):\n`;
              webUntisData.exams.forEach((exam: any) => {
                const examDate = exam.date ? new Date(exam.date).toLocaleDateString('de-DE') : 'Unbekannt';
                reportText += `    - ${exam.subject || 'Unbekanntes Fach'}: ${exam.text || exam.description || 'Keine Beschreibung'} (Datum: ${examDate})\n`;
              });
            } else {
              reportText += `    📋 Prüfungen: Keine für diese Woche\n`;
            }
            
            // 5. Absences
            try {
              const absences = await getAbsences(untisAuth, week.startDate, week.endDate);
              if (absences && absences.length > 0) {
                reportText += `    🚫 Abwesenheiten (${absences.length}):\n`;
                absences.forEach((absence: any) => {
                  const absenceDate = absence.date ? new Date(absence.date).toLocaleDateString('de-DE') : 'Unbekannt';
                  const reason = absence.reason || absence.text || 'Kein Grund angegeben';
                  const type = absence.type || 'Abwesenheit';
                  reportText += `      - ${absenceDate}: ${type} - ${reason}\n`;
                });
              } else {
                reportText += `    🚫 Abwesenheiten: Keine für diese Woche\n`;
              }
            } catch (error) {
              console.error('Error loading absences:', error);
              reportText += `    🚫 Abwesenheiten: Fehler beim Laden\n`;
            }
            
            // Show status indicator
            reportText += `  ℹ️ Datenquelle: WebUntis (ajax.webuntis.com)\n`;
            
          } catch (error) {
            console.error('Error loading comprehensive WebUntis data:', error);
            reportText += `    ❌ Fehler beim Laden der WebUntis-Daten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}\n`;
            reportText += `    💡 Tipp: Überprüfe deine WebUntis-Anmeldedaten in der config.json\n`;
          }
        } else {
          reportText += `📚 WebUntis-Daten: ⚠️ WebUntis nicht verbunden\n`;
          reportText += `    💡 Aktiviere WebUntis in den API-Einstellungen und verbinde dich\n`;
        }

        // Fetch Logineo/Moodle data if connected and enabled
        if (connectionStatus.logineo === 'connected' && apiSettings.logineo.enabled) {
          setGenerationProgress(`Lade Logineo/Moodle-Daten für Woche ${week.id + 1}...`);
          reportText += `\n🎓 Logineo/Moodle-Daten für Woche ${week.id + 1}:\n`;
          
          try {
            console.log(`Loading Logineo/Moodle data for week ${week.id + 1} starting ${week.startDate.toISOString()}`);
            
            const credentials = {
              username: config.logineo_username || '',
              password: config.logineo_password || '',
              baseUrl: config.logineo_base_url || 'https://188086.logineonrw-lms.de'
            };

            const logineoData = await logineoService.getAllLogineoData(credentials);
            
            // Filter data for current week
            const weekStart = week.startDate;
            const weekEnd = week.endDate;
            const weekStartTime = weekStart.getTime();
            const weekEndTime = weekEnd.getTime();
            
            // 1. Course Summary
            if (logineoData.courses.length > 0) {
              reportText += `  📚 Kurse (${logineoData.courses.length}):\n`;
              logineoData.courses.slice(0, 5).forEach(course => {
                const compactName = logineoService.compactCourseName(course);
                reportText += `    • ${compactName}\n`;
              });
              if (logineoData.courses.length > 5) {
                reportText += `    • ... und ${logineoData.courses.length - 5} weitere\n`;
              }
            }
            
            // 2. Current Week Assignments (due this week)
            const weekAssignments = logineoData.assignments.filter(assignment => {
              if (!assignment.duedate) return false;
              const dueDate = assignment.duedate * 1000; // Convert to milliseconds
              return dueDate >= weekStartTime && dueDate <= weekEndTime;
            });
            
            if (weekAssignments.length > 0) {
              reportText += `  📝 Aufgaben in dieser Woche (${weekAssignments.length}):\n`;
              weekAssignments.forEach(assignment => {
                const dueDate = assignment.duedate ? new Date(assignment.duedate * 1000).toLocaleDateString('de-DE') : 'Kein Termin';
                const status = logineoService.getAssignmentStatus(assignment);
                const compactCourseName = logineoService.compactCourseName(assignment.course);
                reportText += `    • ${assignment.name} - ${status}\n`;
                reportText += `      📅 Abgabe: ${dueDate} | Kurs: ${compactCourseName}\n`;
              });
            } else {
              reportText += `    📝 Aufgaben: Keine fälligen Aufgaben diese Woche\n`;
            }
            
            // 3. Assignment Overview (all assignments with status)
            if (logineoData.assignments.length > 0) {
              reportText += `  📋 Aufgaben-Übersicht (${logineoData.assignments.length}):\n`;
              const overview = generateAssignmentOverview(logineoData.assignments);
              // Clean up the overview text for report
              const cleanOverview = overview
                .replace(/# 📚 Alle Upload-Hausaufgaben im Überblick\n\n/g, '')
                .replace(/\*\*/g, '')
                .replace(/`/g, '')
                .split('\n')
                .filter(line => line.trim())
                .slice(0, 8) // Limit to first 8 assignments
                .join('\n');
              reportText += cleanOverview;
              if (logineoData.assignments.length > 8) {
                reportText += `\n    • ... und ${logineoData.assignments.length - 8} weitere Aufgaben\n`;
              }
            } else {
              reportText += `    📋 Aufgaben: Keine Aufgaben gefunden\n`;
            }
            
            // Show status indicator
            reportText += `  ℹ️ Datenquelle: Logineo/Moodle (${credentials.username})\n`;
            
          } catch (error) {
            console.error('Error loading Logineo/Moodle data:', error);
            reportText += `    ❌ Fehler beim Laden der Logineo-Daten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}\n`;
            reportText += `    💡 Tipp: Überprüfe deine Logineo-Anmeldedaten in der config.json\n`;
          }
        } else {
          reportText += `\n🎓 Logineo/Moodle-Daten: ⚠️ Logineo nicht verbunden\n`;
          reportText += `    💡 Verbinde dich mit Logineo/Moodle in den API-Einstellungen\n`;
        }
        
        // Temporarily disabled other data fetching
        // Fetch Absence data if connected
        // if (connectionStatus.absence === 'connected') {
        //   setGenerationProgress(`Lade Abwesenheits-Daten für Woche ${week.id + 1}...`);
        //   try {
        //     const [absenceData] = await getAbsences(timeRange);
        //     if (absenceData.absences.length > 0 || absenceData.holidays.length > 0) {
        //       reportText += `📅 Abwesenheiten:\n`;
        //       absenceData.absences.forEach((absence: any) => {
        //         const date = new Date(absence.date);
        //         reportText += `  ${date.toLocaleDateString('de-DE')}: ${absence.reason}\n`;
        //       });
        //       absenceData.holidays.forEach((holiday: any) => {
        //         const date = new Date(holiday.date);
        //         reportText += `  ${date.toLocaleDateString('de-DE')}: ${holiday.reason}\n`;
        //       });
        //     }
        //   } catch (error) {
        //     reportText += `    Fehler beim Laden der Abwesenheits-Daten\n`;
        //   }
        // }
        
        // Fetch Bitbucket data if connected
        // if (connectionStatus.bitbucket === 'connected' && bitbucketUser) {
        //   setGenerationProgress(`Lade Git-Aktivitäten für Woche ${week.id + 1}...`);
        //   try {
        //     const commits = await getCommitsForUser(bitbucketUser.uuid!, timeRange);
        //     const pullRequests = await getPullrequestsForUser(bitbucketUser.uuid!, timeRange);
        //     
        //     if (commits.length > 0 || pullRequests.length > 0) {
        //       reportText += `💻 Git-Aktivitäten:\n`;
        //       if (commits.length > 0) {
        //         reportText += `  Commits: ${commits.length}\n`;
        //       }
        //       if (pullRequests.length > 0) {
        //         reportText += `  Pull Requests: ${pullRequests.length}\n`;
        //       }
        //     }
        //   } catch (error) {
        //     reportText += `    Fehler beim Laden der Git-Daten\n`;
        //   }
        // }
        
        reportText += `\n`;
      }
      
      // Generate AI content if enabled
      if (apiSettings.ai.enabled) {
        
        try {
          const aiResponse = await generateAIContent({
            method: apiSettings.ai.method as 'gpt' | 'ollama' | 'groq',
            model: apiSettings.ai.ollamaModel,
            prompt: config.ai_prompt || `Du bist ein Experte für Berichtsheft-Einträge in der Ausbildung. 
Analysiere die folgenden WebUntis-Daten (Stundenplan, Hausaufgaben, Prüfungen, Abwesenheiten) und erstelle 2-3 detaillierte, berufsrelevante Berichtsheft-Einträge.

WICHTIGE REGELN:
- Schreibe in der Ich-Form (z.B. "Ich habe...", "Ich konnte...", "Ich lernte...")
- Verwende berufliche Fachbegriffe und technische Terminologie
- Sei spezifisch über Lerninhalte, Fähigkeiten und praktische Anwendungen
- Jeder Eintrag sollte 1-2 Sätze lang sein
- Fokussiere auf konkrete Lernerfolge und berufliche Kompetenzen
- Berücksichtige alle verfügbaren Daten: Unterrichtsinhalte, Hausaufgaben, Prüfungen
- Verwende realistische und professionelle Formulierungen

WebUntis-Daten:
{DESCRIPTION}

Erstelle jetzt 2-3 professionelle Berichtsheft-Einträge basierend auf den tatsächlichen Unterrichtsinhalten und Aktivitäten:`,
            data: reportText
          });
          
          if (aiResponse.success && aiResponse.content) {
            reportText += aiResponse.content + '\n';
          } else {
            reportText += `❌ KI-Generierung fehlgeschlagen: ${aiResponse.error}\n`;
            reportText += `- [Manuelle Eingabe erforderlich]\n`;
          }
        } catch (error) {
          reportText += `❌ KI-Fehler: ${error}\n`;
          reportText += `- [Manuelle Eingabe erforderlich]\n`;
        }
      }
      
    } catch (error) {
      reportText += `\n❌ Fehler bei der Generierung: ${error}\n`;
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
    
    setTextareaValue(reportText);
  };

  const formatDate = (date: Date) => {
    return date.getDate().toString();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const handleMonthSelect = (month: Date) => {
    setSelectedMonth(month);
    setShowMonthSelector(false);
    setSelectedWeeks(new Set()); // Clear selected weeks when changing month
  };

  // WebUntis connection functions
  const handleUntisConnect = async () => {
    if (!apiSettings.untis.username || !apiSettings.untis.password) {
      setConnectionStatus(prev => ({ ...prev, untis: 'error' }));
      setConnectionMessages(prev => ({ ...prev, untis: 'WebUntis-Daten nicht in config.json konfiguriert' }));
      return;
    }

    setConnectionStatus(prev => ({ ...prev, untis: 'connecting' }));
    setConnectionMessages(prev => ({ ...prev, untis: 'Verbinde mit WebUntis...' }));

    try {
      const authResult = await auth();
      setUntisAuth(authResult);
      setConnectionStatus(prev => ({ ...prev, untis: 'connected' }));
      setConnectionMessages(prev => ({ ...prev, untis: 'Erfolgreich verbunden!' }));
    } catch (error) {
      console.error('WebUntis connection error:', error);
      setConnectionStatus(prev => ({ ...prev, untis: 'error' }));
      setConnectionMessages(prev => ({ ...prev, untis: `Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` }));
    }
  };

  const handleUntisDisconnect = async () => {
    setUntisAuth(null);
    setConnectionStatus(prev => ({ ...prev, untis: 'disconnected' }));
    setConnectionMessages(prev => ({ ...prev, untis: '' }));
  };


  // Check for existing Logineo connection on component mount
  useEffect(() => {
    const checkExistingConnection = () => {
      const storedCredentials = logineoStorage.loadCredentials();
      if (storedCredentials && storedCredentials.isLoggedIn) {
        // Set toggle state first
        setApiSettings(prev => ({
          ...prev,
          logineo: { ...prev.logineo, enabled: storedCredentials.enabled }
        }));
        
        if (storedCredentials.enabled) {
          setConnectionStatus(prev => ({ ...prev, logineo: 'connected' }));
          setConnectionMessages(prev => ({ 
            ...prev, 
            logineo: `Verbindung wiederhergestellt (${storedCredentials.username})` 
          }));
          console.log('✅ Logineo connection restored, toggle enabled:', storedCredentials.enabled);
        } else {
          setConnectionStatus(prev => ({ ...prev, logineo: 'disconnected' }));
          setConnectionMessages(prev => ({ 
            ...prev, 
            logineo: 'Logineo ist deaktiviert' 
          }));
          console.log('⚠️ Logineo is disabled in localStorage');
        }
      }
    };
    
    checkExistingConnection();
  }, []);

  // Logineo/Moodle connection functions
  const handleLogineoConnect = async () => {
    if (!apiSettings.logineo.enabled) {
      setConnectionStatus(prev => ({ ...prev, logineo: 'disconnected' }));
      setConnectionMessages(prev => ({ ...prev, logineo: 'Logineo ist deaktiviert' }));
      return;
    }

    setConnectionStatus(prev => ({ ...prev, logineo: 'connecting' }));
    setConnectionMessages(prev => ({ ...prev, logineo: 'Verbinde mit Logineo/Moodle...' }));
    
    // Debug: Log current config values
    console.log('🔍 Debug - Config values:', {
      logineo_username: config.logineo_username,
      logineo_password: config.logineo_password ? '***GESETZT***' : 'NICHT GESETZT',
      full_config: config
    });
    
    try {
      // Test connection with new service
      const credentials = {
        username: config.logineo_username || '',
        password: config.logineo_password || '',
        baseUrl: config.logineo_base_url || 'https://188086.logineonrw-lms.de'
      };

      const isConnected = await logineoService.testConnection(credentials);
      if (!isConnected) {
        throw new Error('Verbindungstest fehlgeschlagen');
      }

      const logineoData = await logineoService.getAllLogineoData(credentials);
      
      // Save credentials to localStorage for future auto-login
      logineoStorage.saveCredentials(credentials, apiSettings.logineo.enabled);
      console.log('💾 Saved Logineo credentials with enabled status:', apiSettings.logineo.enabled);
      
      setConnectionStatus(prev => ({ ...prev, logineo: 'connected' }));
      setConnectionMessages(prev => ({ 
        ...prev, 
        logineo: `Erfolgreich verbunden! ${logineoData.courses.length} Kurse, ${logineoData.assignments.length} Aufgaben gefunden` 
      }));
      console.log('📚 Logineo Data:', logineoData);
    } catch (error) {
      console.error('Logineo connection error:', error);
      setConnectionStatus(prev => ({ ...prev, logineo: 'error' }));
      setConnectionMessages(prev => ({ 
        ...prev, 
        logineo: `Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` 
      }));
    }
  };

  const handleLogineoDisconnect = async () => {
    // Clear stored credentials when disconnecting
    logineoStorage.clearCredentials();
    setConnectionStatus(prev => ({ ...prev, logineo: 'disconnected' }));
    setConnectionMessages(prev => ({ ...prev, logineo: '' }));
  };

  // AI connection test function
  const handleAITest = async () => {
    if (!apiSettings.ai.openaiKey && apiSettings.ai.method === 'gpt') {
      alert('Bitte gib deinen OpenAI API Key ein!');
      return;
    }
    if (!apiSettings.ai.groqKey && apiSettings.ai.method === 'groq') {
      alert('Bitte gib deinen Groq API Key ein! Gehe zu https://console.groq.com/keys um einen kostenlosen Key zu holen.');
      return;
    }

    setGenerationProgress('Teste KI-Verbindung...');
    setConnectionStatus(prev => ({ ...prev, ai: 'connecting' }));
    setConnectionMessages(prev => ({ ...prev, ai: 'Teste KI-Verbindung...' }));
    
    try {
      const testResult = await testAIConnection(
        apiSettings.ai.method as 'gpt' | 'ollama' | 'groq',
        apiSettings.ai.ollamaModel
      );
      
      if (testResult.success) {
        setConnectionStatus(prev => ({ ...prev, ai: 'connected' }));
        setConnectionMessages(prev => ({ ...prev, ai: 'KI-Verbindung erfolgreich!' }));
        alert('✅ KI-Verbindung erfolgreich!');
      } else {
        setConnectionStatus(prev => ({ ...prev, ai: 'error' }));
        setConnectionMessages(prev => ({ ...prev, ai: `Verbindung fehlgeschlagen: ${testResult.error}` }));
        alert(`❌ KI-Verbindung fehlgeschlagen: ${testResult.error}`);
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, ai: 'error' }));
      setConnectionMessages(prev => ({ ...prev, ai: `Test fehlgeschlagen: ${error}` }));
      alert(`❌ KI-Test fehlgeschlagen: ${error}`);
    } finally {
      setGenerationProgress('');
    }
  };

  // AI disconnect function
  const handleAIDisconnect = async () => {
    setConnectionStatus(prev => ({ ...prev, ai: 'disconnected' }));
    setConnectionMessages(prev => ({ ...prev, ai: '' }));
  };

  // Temporarily disabled problematic connection functions
  // Bitbucket connection functions
  // const handleBitbucketConnect = async () => {
  //   if (!apiSettings.bitbucket.username || !apiSettings.bitbucket.appPassword) {
  //     setConnectionStatus(prev => ({ ...prev, bitbucket: 'error' }));
  //     setConnectionMessages(prev => ({ ...prev, bitbucket: 'Bitte Benutzername und App-Passwort ausfüllen' }));
  //     return;
  //   }

  //   setConnectionStatus(prev => ({ ...prev, bitbucket: 'connecting' }));
  //   setConnectionMessages(prev => ({ ...prev, bitbucket: 'Verbinde mit Bitbucket...' }));

  //   try {
  //     const user = await getUser();
  //     setBitbucketUser(user);
  //     setConnectionStatus(prev => ({ ...prev, bitbucket: 'connected' }));
  //     setConnectionMessages(prev => ({ ...prev, bitbucket: 'Erfolgreich verbunden!' }));
  //   } catch (error) {
  //     setConnectionStatus(prev => ({ ...prev, bitbucket: 'error' }));
  //     setConnectionMessages(prev => ({ ...prev, bitbucket: 'Verbindung fehlgeschlagen' }));
  //   }
  // };

  // const handleBitbucketDisconnect = async () => {
  //   setBitbucketUser(null);
  //   setConnectionStatus(prev => ({ ...prev, bitbucket: 'disconnected' }));
  //   setConnectionMessages(prev => ({ ...prev, bitbucket: '' }));
  // };

  // Jira connection functions
  // const handleJiraConnect = async () => {
  //   if (!apiSettings.jira.url || !apiSettings.jira.username || !apiSettings.jira.token) {
  //     setConnectionStatus(prev => ({ ...prev, jira: 'error' }));
  //     setConnectionMessages(prev => ({ ...prev, jira: 'Bitte URL, Benutzername und Token ausfüllen' }));
  //     return;
  //   }

  //   setConnectionStatus(prev => ({ ...prev, jira: 'connecting' }));
  //   setConnectionMessages(prev => ({ ...prev, jira: 'Teste Jira-Verbindung...' }));

  //   try {
  //     // Test connection by trying to get a ticket
  //     await getTicketHeading('TEST-1');
  //     setConnectionStatus(prev => ({ ...prev, jira: 'connected' }));
  //     setConnectionMessages(prev => ({ ...prev, jira: 'Erfolgreich verbunden!' }));
  //   } catch (error) {
  //     setConnectionStatus(prev => ({ ...prev, jira: 'error' }));
  //     setConnectionMessages(prev => ({ ...prev, jira: 'Verbindung fehlgeschlagen' }));
  //   }
  // };

  // const handleJiraDisconnect = async () => {
  //   setConnectionStatus(prev => ({ ...prev, jira: 'disconnected' }));
  //   setConnectionMessages(prev => ({ ...prev, jira: '' }));
  // };

  return (
    <div className="pageOne">
      <div className="container">
        {/* Header */}
        <div className="header">
          <Link to="/" className="backButton">
            <ArrowLeft size={20} />
            Back to Home
          </Link>
          <h1>Berichtsheft Helper</h1>
          <p>Automatische Generierung von Berichtsheft-Einträgen mit KI</p>
        </div>

        {/* API Integration Settings */}
        <div className="apiSection">
          <div className="sectionHeader">
            <Settings size={24} />
            <h2>API Integrationen</h2>
          </div>
          
          <div className="apiGrid">
            {/* Temporarily disabled problematic API cards */}
            {/* <div className="apiCard">
              <div className="apiHeader">
                <div className="apiIcon"><Bug size={20} /></div>
                <h3>Jira</h3>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={apiSettings.jira.enabled}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      jira: { ...prev.jira, enabled: e.target.checked }
                    }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              {apiSettings.jira.enabled && (
                <div className="apiFields">
                  <input 
                    type="text" 
                    placeholder="Jira URL" 
                    value={apiSettings.jira.url}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      jira: { ...prev.jira, url: e.target.value }
                    }))}
                  />
                  <input 
                    type="text" 
                    placeholder="Benutzername" 
                    value={apiSettings.jira.username}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      jira: { ...prev.jira, username: e.target.value }
                    }))}
                  />
                  <input 
                    type="password" 
                    placeholder="API Token" 
                    value={apiSettings.jira.token}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      jira: { ...prev.jira, token: e.target.value }
                    }))}
                  />
                  
                  <div className="connectionStatus">
                    {connectionStatus.jira === 'connecting' && (
                      <div className="statusMessage">
                        <Loader size={16} className="spinning" />
                        {connectionMessages.jira}
                      </div>
                    )}
                    {connectionStatus.jira === 'connected' && (
                      <div className="statusMessage">
                        <CheckCircle size={16} className="success" />
                        {connectionMessages.jira}
                      </div>
                    )}
                    {connectionStatus.jira === 'error' && (
                      <div className="statusMessage">
                        <XCircle size={16} className="error" />
                        {connectionMessages.jira}
                      </div>
                    )}
                  </div>

                  <div className="connectionButtons">
                    {connectionStatus.jira === 'connected' ? (
                      <button 
                        className="disconnectButton"
                        onClick={handleJiraDisconnect}
                      >
                        Trennen
                      </button>
                    ) : (
                      <button 
                        className="connectButton"
                        onClick={handleJiraConnect}
                        disabled={connectionStatus.jira === 'connecting'}
                      >
                        {connectionStatus.jira === 'connecting' ? (
                          <>
                            <Loader size={16} className="spinning" />
                            Verbinde...
                          </>
                        ) : (
                          'Verbinden'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="apiCard">
              <div className="apiHeader">
                <div className="apiIcon"><GitBranch size={20} /></div>
                <h3>Bitbucket</h3>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={apiSettings.bitbucket.enabled}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      bitbucket: { ...prev.bitbucket, enabled: e.target.checked }
                    }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              {apiSettings.bitbucket.enabled && (
                <div className="apiFields">
                  <input 
                    type="text" 
                    placeholder="Benutzername" 
                    value={apiSettings.bitbucket.username}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      bitbucket: { ...prev.bitbucket, username: e.target.value }
                    }))}
                  />
                  <input 
                    type="password" 
                    placeholder="App-Passwort" 
                    value={apiSettings.bitbucket.appPassword}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      bitbucket: { ...prev.bitbucket, appPassword: e.target.value }
                    }))}
                  />
                  
                  <div className="connectionStatus">
                    {connectionStatus.bitbucket === 'connecting' && (
                      <div className="statusMessage">
                        <Loader size={16} className="spinning" />
                        {connectionMessages.bitbucket}
                      </div>
                    )}
                    {connectionStatus.bitbucket === 'connected' && (
                      <div className="statusMessage">
                        <CheckCircle size={16} className="success" />
                        {connectionMessages.bitbucket}
                      </div>
                    )}
                    {connectionStatus.bitbucket === 'error' && (
                      <div className="statusMessage">
                        <XCircle size={16} className="error" />
                        {connectionMessages.bitbucket}
                      </div>
                    )}
                  </div>

                  
                  <div className="connectionButtons">
                    {connectionStatus.bitbucket === 'connected' ? (
                      <button 
                        className="disconnectButton"
                        onClick={handleBitbucketDisconnect}
                      >
                        Trennen
                      </button>
                    ) : (
                      <button 
                        className="connectButton"
                        onClick={handleBitbucketConnect}
                        disabled={connectionStatus.bitbucket === 'connecting'}
                      >
                        {connectionStatus.bitbucket === 'connecting' ? (
                          <>
                            <Loader size={16} className="spinning" />
                            Verbinde...
                          </>
                        ) : (
                          'Verbinden'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div> */}

            <div className="apiCard">
              <div className="apiHeader">
                <div className="apiIcon">📚</div>
                <h3>WebUntis</h3>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={apiSettings.untis.enabled}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      untis: { ...prev.untis, enabled: e.target.checked }
                    }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              {apiSettings.untis.enabled && (
                <div className="apiFields">
                  <div className="helpText">
                    <strong>WebUntis-Verbindung:</strong><br/>
                    • <strong>Benutzername:</strong> {apiSettings.untis.username || 'Nicht konfiguriert'}<br/>
                    • <strong>Passwort:</strong> {apiSettings.untis.password ? '••••••••' : 'Nicht konfiguriert'}<br/>
                    • <strong>Schulname:</strong> Städt. Heinrich-Hertz-Schule Düsseldorf
                  </div>
                  
                  {/* Connection Status */}
                  <div className="connectionStatus">
                    {connectionStatus.untis === 'connecting' && (
                      <div className="statusMessage">
                        <Loader size={16} className="spinning" />
                        {connectionMessages.untis}
                      </div>
                    )}
                    {connectionStatus.untis === 'connected' && (
                      <div className="statusMessage">
                        <CheckCircle size={16} className="success" />
                        {connectionMessages.untis}
                      </div>
                    )}
                    {connectionStatus.untis === 'error' && (
                      <div className="statusMessage">
                        <XCircle size={16} className="error" />
                        {connectionMessages.untis}
                      </div>
                    )}
                  </div>

                  {/* Connection Buttons */}
                  <div className="connectionButtons">
                    {connectionStatus.untis === 'connected' ? (
                      <button 
                        className="disconnectButton"
                        onClick={handleUntisDisconnect}
                      >
                        Trennen
                      </button>
                    ) : (
                      <button 
                        className="connectButton"
                        onClick={handleUntisConnect}
                        disabled={connectionStatus.untis === 'connecting'}
                      >
                        {connectionStatus.untis === 'connecting' ? (
                          <>
                            <Loader size={16} className="spinning" />
                            Verbinde...
                          </>
                        ) : (
                          'Verbinden'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="apiCard">
              <div className="apiHeader">
                <div className="apiIcon"><FileText size={20} /></div>
                <h3>Logineo/Moodle</h3>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={apiSettings.logineo.enabled}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      logineo: { ...prev.logineo, enabled: e.target.checked }
                    }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              {apiSettings.logineo.enabled && (
                <div className="apiFields">
                <div className="helpText">
                  <strong>Logineo/Moodle-Verbindung:</strong><br/>
                  • <strong>Benutzername:</strong> {logineoStorage.isLoggedIn() ? 'Gespeichert in localStorage' : (config.logineo_username || 'Nicht konfiguriert')}<br/>
                  • <strong>Passwort:</strong> {logineoStorage.isLoggedIn() ? '•••••••• (gespeichert)' : (config.logineo_password ? '••••••••' : 'Nicht konfiguriert')}<br/>
                  • <strong>URL:</strong> https://188086.logineonrw-lms.de<br/>
                  {logineoStorage.isLoggedIn() && (
                    <span style={{color: '#10b981', fontSize: '0.9em'}}>
                      ✅ Anmeldedaten werden automatisch gespeichert
                    </span>
                  )}
                </div>
                
                {/* Quick Access to Assignments */}
                {connectionStatus.logineo === 'connected' && apiSettings.logineo.enabled && (
                  <div className="quickActions">
                    <Link to="/logineo" className="assignments-link">
                      <BookOpen size={16} />
                      Aufgaben-Übersicht öffnen
                    </Link>
                  </div>
                )}
                
                {/* Connection Status */}
                <div className="connectionStatus">
                  {connectionStatus.logineo === 'connecting' && (
                    <div className="statusMessage">
                      <Loader size={16} className="spinning" />
                      <span>Verbinde mit Logineo/Moodle...</span>
                    </div>
                  )}
                  {connectionStatus.logineo === 'connected' && (
                    <div className="statusMessage success">
                      <CheckCircle size={16} />
                      <span>{connectionMessages.logineo}</span>
                    </div>
                  )}
                  {connectionStatus.logineo === 'error' && (
                    <div className="statusMessage error">
                      <XCircle size={16} />
                      <span>{connectionMessages.logineo}</span>
                    </div>
                  )}
                </div>

                {/* Connection Button */}
                <div className="connectionButton">
                  {connectionStatus.logineo === 'connected' ? (
                    <button 
                      className="disconnectButton"
                      onClick={handleLogineoDisconnect}
                    >
                      <XCircle size={16} />
                      Trennen
                    </button>
                  ) : (
                    <button 
                      className="connectButton"
                      onClick={handleLogineoConnect}
                      disabled={connectionStatus.logineo === 'connecting'}
                    >
                      {connectionStatus.logineo === 'connecting' ? (
                        <>
                          <Loader size={16} className="spinning" />
                          Verbinde...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Verbinden
                        </>
                      )}
                    </button>
                  )}
                </div>
                </div>
              )}
            </div>

            <div className="apiCard">
              <div className="apiHeader">
                <div className="apiIcon"><Brain size={20} /></div>
                <h3>KI-Integration</h3>
                <label className="toggle">
                  <input 
                    type="checkbox" 
                    checked={apiSettings.ai.enabled}
                    onChange={(e) => setApiSettings(prev => ({
                      ...prev,
                      ai: { ...prev.ai, enabled: e.target.checked }
                    }))}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              {apiSettings.ai.enabled && (
                <div className="apiFields">
                  <div className="helpText">
                    <strong>KI-Konfiguration:</strong><br/>
                    • <strong>Methode:</strong> {
                      apiSettings.ai.method === 'gpt' ? 'OpenAI GPT-3.5' : 
                      apiSettings.ai.method === 'groq' ? 'Groq (Kostenlos & Schnell)' : 
                      'Ollama (Lokal)'
                    }<br/>
                    • <strong>API Key:</strong> {
                      apiSettings.ai.method === 'gpt' ? (apiSettings.ai.openaiKey ? '••••••••••••••••' : 'Nicht konfiguriert') :
                      apiSettings.ai.method === 'groq' ? (apiSettings.ai.groqKey ? '••••••••••••••••' : 'Nicht konfiguriert') :
                      'Nicht benötigt (lokal)'
                    }<br/>
                    • <strong>Model:</strong> {apiSettings.ai.ollamaModel || 'llama-3.1-8b-instant'}
                  </div>
                  
                  <div className="helpText">
                    <strong>KI-Methoden:</strong><br/>
                    • <strong>Groq:</strong> 🆓 Kostenlos, schnell, cloud-basiert (Empfohlen)<br/>
                    • <strong>OpenAI GPT:</strong> Bezahlt, sehr gut, cloud-basiert<br/>
                    • <strong>Ollama:</strong> Kostenlos, läuft lokal auf deinem PC
                  </div>
                  
                  {/* Connection Status */}
                  <div className="connectionStatus">
                    {connectionStatus.ai === 'connecting' && (
                      <div className="statusMessage">
                        <Loader size={16} className="spinning" />
                        {connectionMessages.ai}
                      </div>
                    )}
                    {connectionStatus.ai === 'connected' && (
                      <div className="statusMessage">
                        <CheckCircle size={16} className="success" />
                        {connectionMessages.ai}
                      </div>
                    )}
                    {connectionStatus.ai === 'error' && (
                      <div className="statusMessage">
                        <XCircle size={16} className="error" />
                        {connectionMessages.ai}
                      </div>
                    )}
                  </div>

                  {/* Connection Buttons */}
                  <div className="connectionButtons">
                    {connectionStatus.ai === 'connected' ? (
                      <button 
                        className="disconnectButton"
                        onClick={handleAIDisconnect}
                        style={{ marginTop: '10px' }}
                      >
                        Trennen
                      </button>
                    ) : (
                      <button 
                        className="connectButton"
                        onClick={handleAITest}
                        disabled={connectionStatus.ai === 'connecting'}
                        style={{ marginTop: '10px' }}
                      >
                        {connectionStatus.ai === 'connecting' ? (
                          <>
                            <Loader size={16} className="spinning" />
                            Teste...
                          </>
                        ) : (
                          '🧪 KI-Verbindung testen'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="calendar">
          <div className="calendarHeader">
            <Calendar size={24} />
            <h2>Wochenauswahl - {formatMonthYear(selectedMonth)}</h2>
            <button 
              className="monthSelectorButton"
              onClick={() => setShowMonthSelector(!showMonthSelector)}
            >
              📅 Monat wählen
            </button>
          </div>
          
          {/* Month Selector */}
          {showMonthSelector && (
            <div className="monthSelector">
              <div className="monthGrid">
                {availableMonths.map((month, index) => (
                  <button
                    key={index}
                    className={`monthButton ${month.getTime() === selectedMonth.getTime() ? 'selectedMonth' : ''}`}
                    onClick={() => handleMonthSelect(month)}
                  >
                    {formatMonthYear(month)}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Week Blocks */}
          <div className="weekBlocks">
            {weeks.map((week) => (
              <div
                key={week.id}
                className={`weekBlock ${selectedWeeks.has(week.id) ? 'selected' : ''}`}
                onClick={() => handleWeekClick(week.id)}
              >
                <div className="weekHeader">
                  <div className="weekNumber">Woche {week.id + 1}</div>
                  <div className="weekDates">
                    {formatDate(week.startDate)} - {formatDate(week.endDate)}
                  </div>
                </div>
                    <div className="weekDays">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((day) => (
                    <div key={day} className="dayCell">
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div className="generateSection">
          <button 
            className="generateButton"
            onClick={handleGenerate}
            disabled={selectedWeeks.size === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader size={20} className="spinning" />
                {generationProgress || 'Generiere...'}
              </>
            ) : (
              <>
                <Zap size={20} />
                Berichtsheft generieren ({selectedWeeks.size} Wochen)
              </>
            )}
          </button>
          
          {isGenerating && generationProgress && (
            <div className="progressMessage">
              {generationProgress}
            </div>
          )}
        </div>

        {/* Berichtsheft Generator */}
        <BerichtsheftGenerator 
          onTextGenerated={(text) => setTextareaValue(prev => prev + '\n\n' + text)}
        />

        {/* Text Area */}
        <div className="textareaSection">
          <label htmlFor="resultTextarea" className="textareaLabel">
            <FileText size={20} />
            Generierte Berichtsheft-Einträge:
          </label>
          <textarea
            id="resultTextarea"
            className="textarea"
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
            placeholder="Hier werden die generierten Berichtsheft-Einträge angezeigt..."
            rows={12}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


