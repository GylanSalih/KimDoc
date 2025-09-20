import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, Settings, Zap, CheckCircle, XCircle, Loader, Brain, BookOpen } from 'lucide-react';
import './PageOne.scss';
import { 
  getStartOfWeek,
  getEndOfWeek,
  formatDateGerman
} from '../../utils/dateUtils';
import { auth, getAllWebUntisData, type Auth, type PeriodInfo } from '../../services/untisService';
import { logineoService, generateAssignmentOverview } from '../../services/logineoService';
import { config, loadConfig } from '../../utils/config';
import { generateAIContent, testAIConnection } from '../../services/aiService';

interface WeekBlock {
  id: number;
  startDate: Date;
  endDate: Date;
  isSelected: boolean;
  untisData?: PeriodInfo[];
}

const PageOne: React.FC = () => {
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const [textareaValue, setTextareaValue] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [apiSettings, setApiSettings] = useState({
    untis: { enabled: false, username: '', password: '' },
    ai: { enabled: false, method: 'groq', openaiKey: '', groqKey: '', ollamaModel: 'llama-3.1-8b-instant' }
  });
  const [logineoCredentials, setLogineoCredentials] = useState({
    username: '',
    password: ''
  });
  const [logineoLoginMode, setLogineoLoginMode] = useState<'config' | 'manual'>('config');
  const [webuntisCredentials, setWebuntisCredentials] = useState({
    username: '',
    password: '',
    server: ''
  });
  const [webuntisLoginMode, setWebuntisLoginMode] = useState<'config' | 'manual'>('config');
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'disconnected' | 'connecting' | 'connected' | 'error'>>({
    untis: 'disconnected',
    logineo: 'disconnected',
    ai: 'disconnected'
  });
  const [connectionMessages, setConnectionMessages] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [untisAuth, setUntisAuth] = useState<Auth | null>(null);

  // Load config on component mount
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const loadedConfig = await loadConfig();
        if (loadedConfig) {
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
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    
    initializeConfig();
  }, []);

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

  const weeks = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const weeks: WeekBlock[] = [];
    let weekId = 0;
    
    const startOfFirstWeek = getStartOfWeek(firstDay);
    
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
        
        
        if (connectionStatus.untis === 'connected' && untisAuth) {
          setGenerationProgress(`Lade alle WebUntis-Daten für Woche ${week.id + 1}...`);
          reportText += `📚 WebUntis-Daten für Woche ${week.id + 1}:\n`;
          
          try {
            console.log(`Loading comprehensive WebUntis data for week ${week.id + 1} starting ${week.startDate.toISOString()}`);
            
            const webUntisData = await getAllWebUntisData();
            
            if (webUntisData.userInfo) {
              const user = webUntisData.userInfo;
              reportText += `  👤 Schüler: ${user.name || 'Unbekannt'}\n`;
              reportText += `  🏫 Klasse: ${user.type || 'Unbekannt'}\n`;
            } else {
              reportText += `  👤 Schüler: Benutzerdaten nicht verfügbar\n`;
              reportText += `  🏫 Klasse: Klassendaten nicht verfügbar\n`;
            }
            
            if (webUntisData.timetable && webUntisData.timetable.length > 0) {
              console.log(`Found ${webUntisData.timetable.length} periods`);
              const allPeriods: PeriodInfo[] = [];
              
              for (const period of webUntisData.timetable) {
                console.log(`Processing period for date ${period.date}`);
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
                  
                  const periodInfo: PeriodInfo = {
                    content: period.subject || 'Unterrichtsinhalt nicht verfügbar',
                    name: period.subject || `Stunde ${Math.floor(period.startTime / 100)}:${(period.startTime % 100).toString().padStart(2, '0')}`,
                    date: formatDateTime(period.date, period.startTime),
                    minutesTaken: getMinutesBetweenTimes(period.startTime, period.endTime),
                    weekday: getWeekdayName(period.date)
                  };
                  allPeriods.push(periodInfo);
                  console.log(`Added period: ${periodInfo.name}`);
              }
              
              if (allPeriods.length > 0) {
                console.log(`Total periods processed: ${allPeriods.length}`);
                const groupedByDay = allPeriods.reduce((acc, info) => {
                  const day = info.weekday;
                  if (!acc[day]) acc[day] = [];
                  acc[day]!.push(info);
                  return acc;
                }, {} as Record<string, PeriodInfo[]>);
                
                reportText += `  📅 Stundenplan (${allPeriods.length} Stunden):\n`;
                Object.entries(groupedByDay).forEach(([day, periods]) => {
                  reportText += `    ${day} (${periods.length} Stunden):\n`;
                  periods.forEach(period => {
                    const startTime = period.date.includes('T') ? period.date.split('T')[1]?.substring(0, 5) : 'Unbekannt';
                    reportText += `      - ${startTime}: ${period.name}\n`;
                  });
                });
              } else {
                reportText += `    📅 Stundenplan: Keine Stunden gefunden\n`;
              }
            } else {
              reportText += `    📅 Stundenplan: Keine Daten für diese Woche verfügbar\n`;
            }
            
            if (webUntisData.homework && webUntisData.homework.length > 0) {
              reportText += `  📝 Hausaufgaben (${webUntisData.homework.length}):\n`;
              webUntisData.homework.forEach((hw: any) => {
                const dueDate = hw.dueDate ? new Date(hw.dueDate).toLocaleDateString('de-DE') : 'Unbekannt';
                reportText += `    - ${hw.subject || 'Unbekanntes Fach'}: ${hw.text || hw.description || 'Keine Beschreibung'} (Fällig: ${dueDate})\n`;
              });
            } else {
              reportText += `    📝 Hausaufgaben: Keine für diese Woche\n`;
            }
            
            if (webUntisData.exams && webUntisData.exams.length > 0) {
              reportText += `  📋 Prüfungen (${webUntisData.exams.length}):\n`;
              webUntisData.exams.forEach((exam: any) => {
                const examDate = exam.date ? new Date(exam.date).toLocaleDateString('de-DE') : 'Unbekannt';
                reportText += `    - ${exam.subject || 'Unbekanntes Fach'}: ${exam.text || exam.description || 'Keine Beschreibung'} (Datum: ${examDate})\n`;
              });
            } else {
              reportText += `    📋 Prüfungen: Keine für diese Woche\n`;
            }
            
            // Note: Absences are not available in the current WebUntis data structure
            reportText += `  🚫 Abwesenheiten: Nicht verfügbar in der aktuellen API\n`;
            
            reportText += `  ℹ️ Datenquelle: WebUntis (${untisAuth.baseUrl})\n`;
            
          } catch (error) {
            console.error('Error loading comprehensive WebUntis data:', error);
            reportText += `    ❌ Fehler beim Laden der WebUntis-Daten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}\n`;
            reportText += `    💡 Tipp: Überprüfe deine WebUntis-Anmeldedaten in der config.json\n`;
          }
        } else {
          reportText += `📚 WebUntis-Daten: ⚠️ WebUntis nicht verbunden\n`;
          reportText += `    💡 Aktiviere WebUntis in den API-Einstellungen und verbinde dich\n`;
        }

        if (connectionStatus.logineo === 'connected') {
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
            
            const weekStart = week.startDate;
            const weekEnd = week.endDate;
            const weekStartTime = weekStart.getTime();
            const weekEndTime = weekEnd.getTime();
            
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
            
            if (logineoData.assignments.length > 0) {
              reportText += `  📋 Aufgaben-Übersicht (${logineoData.assignments.length}):\n`;
              const overview = generateAssignmentOverview(logineoData.assignments);
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
  
        reportText += `\n`;
      }
      
      if (apiSettings.ai.enabled) {
        setGenerationProgress('Generiere Berichtsheft-Einträge mit KI...');
        reportText += `\n🤖 KI-generierte Berichtsheft-Einträge:\n`;
        reportText += `(Basierend auf den gesammelten Daten)\n`;
        
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

  const handleUntisConnect = async () => {
    const username = webuntisLoginMode === 'manual' 
      ? webuntisCredentials.username 
      : apiSettings.untis.username;
    const password = webuntisLoginMode === 'manual' 
      ? webuntisCredentials.password 
      : apiSettings.untis.password;
    const server = webuntisLoginMode === 'manual' 
      ? webuntisCredentials.server 
      : (config as any).untis_server;

    if (!username || !password || !server) {
      setConnectionStatus(prev => ({ ...prev, untis: 'error' }));
      setConnectionMessages(prev => ({ 
        ...prev, 
        untis: webuntisLoginMode === 'manual' 
          ? 'Bitte füllen Sie alle Felder aus' 
          : 'WebUntis-Daten nicht in config.json konfiguriert' 
      }));
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

  const handleLogineoConnect = async () => {
    setConnectionStatus(prev => ({ ...prev, logineo: 'connecting' }));
    setConnectionMessages(prev => ({ ...prev, logineo: 'Verbinde mit Logineo/Moodle...' }));
    
    console.log('🔍 Debug - Credentials:', {
      input_username: logineoCredentials.username,
      input_password: logineoCredentials.password ? '***GESETZT***' : 'NICHT GESETZT',
      config_username: config.logineo_username,
      config_password: config.logineo_password ? '***GESETZT***' : 'NICHT GESETZT'
    });
    
    try {
      const credentials = {
        username: logineoLoginMode === 'manual' 
          ? logineoCredentials.username 
          : config.logineo_username || '',
        password: logineoLoginMode === 'manual' 
          ? logineoCredentials.password 
          : config.logineo_password || '',
        baseUrl: config.logineo_base_url || 'https://188086.logineonrw-lms.de'
      };

      const isConnected = await logineoService.testConnection(credentials);
      if (!isConnected) {
        throw new Error('Verbindungstest fehlgeschlagen');
      }

      const logineoData = await logineoService.getAllLogineoData(credentials);
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

  return (
    <div className="pageOne">
      <div className="container">
        {/* Header */}
        <div className="header">

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
                    <strong>WebUntis-Verbindung:</strong>
                  </div>
                  
                  {/* Login Mode Toggle */}
                  <div className="loginModeToggle">
                    <div className="toggleGroup">
                      <label className={`toggleOption ${webuntisLoginMode === 'config' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="webuntis-mode"
                          value="config"
                          checked={webuntisLoginMode === 'config'}
                          onChange={() => setWebuntisLoginMode('config')}
                        />
                        <span>📁 Aus JSON laden</span>
                      </label>
                      <label className={`toggleOption ${webuntisLoginMode === 'manual' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="webuntis-mode"
                          value="manual"
                          checked={webuntisLoginMode === 'manual'}
                          onChange={() => setWebuntisLoginMode('manual')}
                        />
                        <span>✏️ Manuell eingeben</span>
                      </label>
                    </div>
                  </div>

                  {/* Config Mode Display */}
                  {webuntisLoginMode === 'config' && (
                    <div className="configDisplay">
                      <div className="configInfo">
                        <p><strong>Benutzername:</strong> {apiSettings.untis.username || 'Nicht konfiguriert'}</p>
                        <p><strong>Passwort:</strong> {apiSettings.untis.password ? '••••••••' : 'Nicht konfiguriert'}</p>
                        <p><strong>Schulname:</strong> Städt. Heinrich-Hertz-Schule Düsseldorf</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Manual Mode Input Fields */}
                  {webuntisLoginMode === 'manual' && (
                    <div className="credentialInputs">
                      <div className="inputGroup">
                        <label htmlFor="webuntis-username">Benutzername:</label>
                        <input
                          id="webuntis-username"
                          type="text"
                          value={webuntisCredentials.username}
                          onChange={(e) => setWebuntisCredentials(prev => ({ ...prev, username: e.target.value }))}
                          placeholder="z.B. vorname.na"
                          className="credentialInput"
                        />
                      </div>
                      
                      <div className="inputGroup">
                        <label htmlFor="webuntis-password">Passwort:</label>
                        <input
                          id="webuntis-password"
                          type="password"
                          value={webuntisCredentials.password}
                          onChange={(e) => setWebuntisCredentials(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Dein Passwort"
                          className="credentialInput"
                        />
                      </div>
                    </div>
                  )}


                  
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
                    checked={true}
                    readOnly
                  />
                  <span className="slider"></span>
                </label>
              </div>
              <div className="apiFields">
                <div className="helpText">
                  <strong>Logineo/Moodle-Verbindung:</strong>
                </div>
                
                {/* Login Mode Toggle */}
                <div className="loginModeToggle">
                  <div className="toggleGroup">
                    <label className={`toggleOption ${logineoLoginMode === 'config' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="logineo-mode"
                        value="config"
                        checked={logineoLoginMode === 'config'}
                        onChange={() => setLogineoLoginMode('config')}
                      />
                      <span>📁 Aus JSON laden</span>
                    </label>
                    <label className={`toggleOption ${logineoLoginMode === 'manual' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="logineo-mode"
                        value="manual"
                        checked={logineoLoginMode === 'manual'}
                        onChange={() => setLogineoLoginMode('manual')}
                      />
                      <span>✏️ Manuell eingeben</span>
                    </label>
                  </div>
                </div>

                {/* Config Mode Display */}
                {logineoLoginMode === 'config' && (
                  <div className="configDisplay">
                    <div className="configInfo">
                      <p><strong>Benutzername:</strong> {config.logineo_username || 'Nicht konfiguriert'}</p>
                      <p><strong>Passwort:</strong> {config.logineo_password ? '••••••••' : 'Nicht konfiguriert'}</p>
                      <p><strong>URL:</strong> https://188086.logineonrw-lms.de</p>
                    </div>
                  </div>
                )}
                
                {/* Manual Mode Input Fields */}
                {logineoLoginMode === 'manual' && (
                  <div className="credentialInputs">
                    <div className="inputGroup">
                      <label htmlFor="logineo-username">Benutzername:</label>
                      <input
                        id="logineo-username"
                        type="text"
                        value={logineoCredentials.username}
                        onChange={(e) => setLogineoCredentials(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="z.B. nachname.vorname"
                        className="credentialInput"
                      />
                    </div>
                    
                    <div className="inputGroup">
                      <label htmlFor="logineo-password">Passwort:</label>
                      <input
                        id="logineo-password"
                        type="password"
                        value={logineoCredentials.password}
                        onChange={(e) => setLogineoCredentials(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Dein Passwort"
                        className="credentialInput"
                      />
                    </div>
                  </div>
                )}
                
                {/* Quick Access to Assignments */}
                {connectionStatus.logineo === 'connected' && (
                  <div className="quickActions">
                    <Link to="/assignments" className="assignments-link">
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

export default PageOne;


