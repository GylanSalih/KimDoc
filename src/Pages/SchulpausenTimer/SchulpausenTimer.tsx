import React, { useState, useEffect } from 'react';
import { Clock, Coffee, BookOpen, Bell, Calendar } from 'lucide-react';
import styles from './SchulpausenTimer.module.scss';

interface Pause {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number; // in Minuten
}

interface TimeUntilPause {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

const SchulpausenTimer: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextPause, setNextPause] = useState<Pause | null>(null);
  const [timeUntilPause, setTimeUntilPause] = useState<TimeUntilPause>({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
  const [isPauseTime, setIsPauseTime] = useState(false);
  const [currentPause, setCurrentPause] = useState<Pause | null>(null);

  // Pausenzeiten (Montag bis Freitag)
  const pauses: Pause[] = [
    {
      id: 'first',
      name: '1. Pause',
      startTime: '09:15',
      endTime: '09:30',
      duration: 15
    },
    {
      id: 'lunch',
      name: 'Mittagspause',
      startTime: '12:56',
      endTime: '13:20',
      duration: 24
    },
    {
      id: 'second',
      name: '2. Pause',
      startTime: '14:50',
      endTime: '15:00',
      duration: 10
    }
  ];

  // Schule beginnt um 07:45
  const schoolStartTime = '07:45';
  const schoolEndTime = '15:45';

  // Aktuelle Zeit aktualisieren
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Nächste Pause berechnen
  useEffect(() => {
    const now = currentTime;
    const currentDay = now.getDay(); // 0 = Sonntag, 1 = Montag, ..., 5 = Freitag
    
    // Nur Montag bis Freitag (1-5)
    if (currentDay < 1 || currentDay > 5) {
      setNextPause(null);
      setIsPauseTime(false);
      setCurrentPause(null);
      return;
    }

    const currentTimeString = now.toTimeString().slice(0, 5);
    const currentTimeMinutes = timeToMinutes(currentTimeString);

    // Prüfen ob wir gerade in einer Pause sind
    for (const pause of pauses) {
      const pauseStartMinutes = timeToMinutes(pause.startTime);
      const pauseEndMinutes = timeToMinutes(pause.endTime);
      
      if (currentTimeMinutes >= pauseStartMinutes && currentTimeMinutes < pauseEndMinutes) {
        setIsPauseTime(true);
        setCurrentPause(pause);
        setNextPause(null);
        return;
      }
    }

    // Nächste Pause finden
    let nextPauseFound: Pause | null = null;
    let minTimeDiff = Infinity;

    for (const pause of pauses) {
      const pauseStartMinutes = timeToMinutes(pause.startTime);
      
      if (pauseStartMinutes > currentTimeMinutes) {
        const timeDiff = pauseStartMinutes - currentTimeMinutes;
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          nextPauseFound = pause;
        }
      }
    }

    setNextPause(nextPauseFound);
    setIsPauseTime(false);
    setCurrentPause(null);
  }, [currentTime]);

  // Verbleibende Zeit bis zur nächsten Pause berechnen
  useEffect(() => {
    if (!nextPause && !isPauseTime) {
      setTimeUntilPause({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
      return;
    }

    const now = currentTime;
    const currentTimeString = now.toTimeString().slice(0, 5);
    const currentTimeMinutes = timeToMinutes(currentTimeString);

    let targetTimeMinutes: number;

    if (isPauseTime && currentPause) {
      // Wenn wir in der Pause sind, zeige Zeit bis Ende der Pause
      targetTimeMinutes = timeToMinutes(currentPause.endTime);
    } else if (nextPause) {
      // Wenn wir nicht in der Pause sind, zeige Zeit bis Beginn der nächsten Pause
      targetTimeMinutes = timeToMinutes(nextPause.startTime);
    } else {
      return;
    }

    const timeDiffMinutes = targetTimeMinutes - currentTimeMinutes;
    
    if (timeDiffMinutes <= 0) {
      setTimeUntilPause({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
      return;
    }

    const totalSeconds = timeDiffMinutes * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    setTimeUntilPause({ hours, minutes, seconds, totalSeconds });
  }, [currentTime, nextPause, isPauseTime, currentPause]);

  // Hilfsfunktion: Zeit-String zu Minuten konvertieren
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Hilfsfunktion: Minuten zu Zeit-String konvertieren
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Formatierte Zeit anzeigen
  const formatTime = (time: TimeUntilPause): string => {
    if (time.hours > 0) {
      return `${time.hours}h ${time.minutes}m ${time.seconds}s`;
    } else if (time.minutes > 0) {
      return `${time.minutes}m ${time.seconds}s`;
    } else {
      return `${time.seconds}s`;
    }
  };

  // Fortschritt berechnen (für die Pause)
  const getProgress = (): number => {
    if (!currentPause) return 0;
    
    const now = currentTime;
    const currentTimeString = now.toTimeString().slice(0, 5);
    const currentTimeMinutes = timeToMinutes(currentTimeString);
    const pauseStartMinutes = timeToMinutes(currentPause.startTime);
    const pauseEndMinutes = timeToMinutes(currentPause.endTime);
    
    const totalPauseDuration = pauseEndMinutes - pauseStartMinutes;
    const elapsed = currentTimeMinutes - pauseStartMinutes;
    
    return Math.max(0, Math.min(100, (elapsed / totalPauseDuration) * 100));
  };

  // Prüfen ob Schule vorbei ist
  const isSchoolOver = (): boolean => {
    const currentTimeString = currentTime.toTimeString().slice(0, 5);
    const currentTimeMinutes = timeToMinutes(currentTimeString);
    const schoolEndMinutes = timeToMinutes(schoolEndTime);
    
    return currentTimeMinutes >= schoolEndMinutes;
  };

  // Prüfen ob Schule noch nicht begonnen hat
  const isSchoolNotStarted = (): boolean => {
    const currentTimeString = currentTime.toTimeString().slice(0, 5);
    const currentTimeMinutes = timeToMinutes(currentTimeString);
    const schoolStartMinutes = timeToMinutes(schoolStartTime);
    
    return currentTimeMinutes < schoolStartMinutes;
  };

  const currentDay = currentTime.getDay();
  const isWeekend = currentDay === 0 || currentDay === 6;

  if (isWeekend) {
    return (
      <div className={styles.schulpausenTimer}>
        <div className={styles.container}>
          <div className={styles.weekendMessage}>
            <Calendar size={80} />
            <h1>Wochenende!</h1>
            <p>Heute ist kein Schultag. Der Timer ist nur Montag bis Freitag aktiv.</p>
            <div className={styles.nextSchoolDay}>
              <p>Nächster Schultag: Montag um 07:45</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSchoolNotStarted()) {
    return (
      <div className={styles.schulpausenTimer}>
        <div className={styles.container}>
          <div className={styles.beforeSchoolMessage}>
            <BookOpen size={80} />
            <h1>Schule beginnt bald!</h1>
            <p>Die Schule beginnt um 07:45 Uhr</p>
            <div className={styles.timeDisplay}>
              <span className={styles.timeLabel}>Noch:</span>
              <span className={styles.timeValue}>
                {formatTime(timeUntilPause)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSchoolOver()) {
    return (
      <div className={styles.schulpausenTimer}>
        <div className={styles.container}>
          <div className={styles.schoolOverMessage}>
            <Bell size={80} />
            <h1>Schule vorbei!</h1>
            <p>Die Schule ist um 15:45 Uhr zu Ende gegangen.</p>
            <div className={styles.nextSchoolDay}>
              <p>Nächster Schultag: Morgen um 07:45</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.schulpausenTimer}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Schulpausen Timer</h1>
          <p>Zeit bis zur nächsten Pause</p>
        </div>

        <div className={styles.timerSection}>
          {/* Aktuelle Zeit */}
          <div className={styles.currentTime}>
            <Clock size={24} />
            <span>{currentTime.toLocaleTimeString('de-DE', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            })}</span>
          </div>

          {/* Timer Display */}
          <div className={styles.timerDisplay}>
            {isPauseTime && currentPause ? (
              <div className={styles.pauseMode}>
                <div className={styles.pauseIcon}>
                  <Coffee size={60} />
                </div>
                <h2>Pause!</h2>
                <p className={styles.pauseName}>{currentPause.name}</p>
                <div className={styles.pauseTime}>
                  <span className={styles.pauseTimeLabel}>Pause endet in:</span>
                  <span className={styles.pauseTimeValue}>
                    {formatTime(timeUntilPause)}
                  </span>
                </div>
                <div className={styles.pauseProgress}>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ width: `${getProgress()}%` }}
                    />
                  </div>
                  <span className={styles.progressText}>
                    {Math.round(getProgress())}% der Pause vorbei
                  </span>
                </div>
              </div>
            ) : nextPause ? (
              <div className={styles.waitingMode}>
                <div className={styles.waitingIcon}>
                  <BookOpen size={60} />
                </div>
                <h2>Unterricht</h2>
                <p className={styles.nextPauseName}>Nächste Pause: {nextPause.name}</p>
                <div className={styles.timeUntilPause}>
                  <span className={styles.timeLabel}>Noch:</span>
                  <span className={styles.timeValue}>
                    {formatTime(timeUntilPause)}
                  </span>
                </div>
                <div className={styles.nextPauseInfo}>
                  <p>Pause beginnt um {nextPause.startTime} Uhr</p>
                  <p>Dauer: {nextPause.duration} Minuten</p>
                </div>
              </div>
            ) : (
              <div className={styles.noPauseMode}>
                <h2>Keine Pause mehr heute</h2>
                <p>Alle Pausen sind vorbei. Schule endet um 15:00 Uhr.</p>
              </div>
            )}
          </div>

          {/* Pausenzeiten Übersicht */}
          <div className={styles.pausesOverview}>
            <h3>Heutige Pausenzeiten</h3>
            <div className={styles.pausesList}>
              {pauses.map((pause, index) => {
                const isCurrentPause = currentPause?.id === pause.id;
                const isNextPause = nextPause?.id === pause.id;
                const isPastPause = timeToMinutes(currentTime.toTimeString().slice(0, 5)) >= timeToMinutes(pause.endTime);
                
                return (
                  <div 
                    key={pause.id}
                    className={`${styles.pauseItem} ${
                      isCurrentPause ? styles.current : ''
                    } ${
                      isNextPause ? styles.next : ''
                    } ${
                      isPastPause ? styles.past : ''
                    }`}
                  >
                    <div className={styles.pauseNumber}>
                      {index + 1}
                    </div>
                    <div className={styles.pauseInfo}>
                      <span className={styles.pauseName}>{pause.name}</span>
                      <span className={styles.pauseTime}>
                        {pause.startTime} - {pause.endTime} Uhr
                      </span>
                    </div>
                    <div className={styles.pauseStatus}>
                      {isCurrentPause && <span className={styles.statusCurrent}>Jetzt</span>}
                      {isNextPause && <span className={styles.statusNext}>Als nächstes</span>}
                      {isPastPause && <span className={styles.statusPast}>Vorbei</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchulpausenTimer;
