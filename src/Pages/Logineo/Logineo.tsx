import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, XCircle, Loader, AlertTriangle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import './Logineo.scss';
import { logineoService, type LogineoAssignment, type LogineoCourse } from '../../services/logineoService';
import { config } from '../../utils/config';

const Logineo: React.FC = () => {
  const [assignments, setAssignments] = useState<LogineoAssignment[]>([]);
  const [courses, setCourses] = useState<LogineoCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const credentials = {
        username: config.logineo_username || '',
        password: config.logineo_password || '',
        baseUrl: (config as any).logineo_base_url || 'https://188086.logineonrw-lms.de'
      };

      const data = await logineoService.getAllLogineoData(credentials);
      setAssignments(data.assignments);
      setCourses(data.courses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Filter assignments based on selected course and status
  const filteredAssignments = useMemo(() => {
    const filtered = assignments.filter(assignment => {
      const courseMatch = selectedCourse === 'all' || assignment.course.id.toString() === selectedCourse;
      const statusMatch = selectedStatus === 'all' || getStatusClass(assignment) === selectedStatus;
      return courseMatch && statusMatch;
    });
    
    console.log('Filtered assignments:', {
      total: assignments.length,
      filtered: filtered.length,
      selectedCourse,
      selectedStatus
    });
    
    return filtered;
  }, [assignments, selectedCourse, selectedStatus]);

  // Calendar logic - use filtered assignments
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayAssignments = filteredAssignments.filter(assignment => {
        if (!assignment.duedate) return false;
        const dueDate = new Date(assignment.duedate * 1000);
        return dueDate.toDateString() === date.toDateString();
      });
      
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === today.toDateString(),
        assignments: dayAssignments
      });
    }
    
    return days;
  }, [currentDate, filteredAssignments]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const handleDayClick = (day: any) => {
    if (day.assignments.length > 0) {
      setSelectedDay(day.date);
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDay(null);
  };

  const getSelectedDayAssignments = () => {
    if (!selectedDay) return [];
    return filteredAssignments.filter(assignment => {
      if (!assignment.duedate) return false;
      const dueDate = new Date(assignment.duedate * 1000);
      return dueDate.toDateString() === selectedDay.toDateString();
    });
  };

  const getStatusIcon = (assignment: LogineoAssignment) => {
    const status = logineoService.getAssignmentStatus(assignment);
    if (status.includes('⏳')) return <Clock className="status-icon soon" />;
    if (status.includes('⚠️')) return <AlertTriangle className="status-icon overdue" />;
    if (status.includes('✅')) return <CheckCircle className="status-icon on-time" />;
    if (status.includes('🔒')) return <XCircle className="status-icon closed" />;
    return <FileText className="status-icon no-date" />;
  };

  const getStatusClass = (assignment: LogineoAssignment) => {
    const status = logineoService.getAssignmentStatus(assignment);
    if (status.includes('⏳')) return 'soon';
    if (status.includes('⚠️')) return 'overdue';
    if (status.includes('✅')) return 'on-time';
    if (status.includes('🔒')) return 'closed';
    return 'no-date';
  };


  return (
    <div className="logineo-page">
      <div className="logineo-header">
        <Link to="/berichtsheft" className="back-button">
          <ArrowLeft size={20} />
          Zurück zum Berichtsheft
        </Link>
        <h1>📅 Aufgaben-Kalender</h1>
        <p>Deine Moodle-Aufgaben im Kalender-Überblick</p>
        {selectedCourse !== 'all' && (
          <p style={{ color: '#666', fontSize: '0.9em' }}>
            Zeige {filteredAssignments.length} von {assignments.length} Aufgaben für den ausgewählten Kurs
          </p>
        )}
      </div>

      <div className="logineo-controls">
        <div className="control-group">
          <label htmlFor="course-filter">Kurs:</label>
          <select 
            id="course-filter" 
            value={selectedCourse} 
            onChange={(e) => setSelectedCourse(e.target.value)}
          >
            <option value="all">Alle Kurse</option>
            {courses.map(course => (
              <option key={course.id} value={course.id.toString()}>
                {logineoService.compactCourseName(course)}
              </option>
            ))}
          </select>
        </div>

        <button 
          className="refresh-button" 
          onClick={loadAssignments}
          disabled={loading}
        >
          {loading ? <Loader className="spinning" size={16} /> : '🔄 Aktualisieren'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <XCircle size={20} />
          <span>Fehler beim Laden der Aufgaben: {error}</span>
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <Loader className="spinning" size={20} />
          <span>Lade Aufgaben...</span>
        </div>
      )}

      {!loading && !error && (
        <div className="calendar-container">
          <div className="calendar-header">
            <button 
              className="nav-button" 
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="month-year">{formatMonthYear(currentDate)}</h2>
            <button 
              className="nav-button" 
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'].map(day => (
                <div key={day} className="weekday-header">{day}</div>
              ))}
            </div>
            
            <div className="calendar-days">
              {calendarDays.map((day, index) => (
                <div 
                  key={index} 
                  className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.assignments.length > 0 ? 'has-assignments' : ''}`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="day-number">{day.date.getDate()}</div>
                  <div className="day-assignments">
                    {day.assignments.slice(0, 3).map(assignment => (
                      <div 
                        key={assignment.id} 
                        className={`assignment-item ${getStatusClass(assignment)}`}
                        title={`${assignment.name} - ${logineoService.getAssignmentStatus(assignment)}`}
                      >
                        {getStatusIcon(assignment)}
                        <span className="assignment-title">
                          {assignment.name.length > 15 
                            ? assignment.name.substring(0, 15) + '...' 
                            : assignment.name
                          }
                        </span>
                      </div>
                    ))}
                    {day.assignments.length > 3 && (
                      <div className="more-assignments">
                        +{day.assignments.length - 3} weitere
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <Clock className="status-icon soon" />
              <span>Bald fällig</span>
            </div>
            <div className="legend-item">
              <AlertTriangle className="status-icon overdue" />
              <span>Überfällig</span>
            </div>
            <div className="legend-item">
              <CheckCircle className="status-icon on-time" />
              <span>Noch Zeit</span>
            </div>
            <div className="legend-item">
              <XCircle className="status-icon closed" />
              <span>Geschlossen</span>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Details Modal */}
      {showModal && selectedDay && (
        <div className="assignment-modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                📅 Aufgaben für {selectedDay.toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
              <button className="close-button" onClick={closeModal}>
                ✕
              </button>
            </div>
            
            <div className="assignment-list">
              {getSelectedDayAssignments().length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted-foreground)' }}>
                  <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>Keine Aufgaben für diesen Tag</p>
                </div>
              ) : (
                getSelectedDayAssignments().map(assignment => (
                  <div key={assignment.id} className="assignment-item">
                    <div className="assignment-header">
                      {getStatusIcon(assignment)}
                      <h3>{assignment.name}</h3>
                      <div className="assignment-status">
                        {logineoService.getAssignmentStatus(assignment)}
                      </div>
                    </div>
                    
                    <div className="assignment-details">
                      <div className="detail-row">
                        <strong>Kurs:</strong>
                        <span>{logineoService.compactCourseName(assignment.course)}</span>
                      </div>
                      
                      {assignment.duedate && (
                        <div className="detail-row">
                          <strong>Fällig:</strong>
                          <span>{logineoService.formatDate(assignment.duedate)}</span>
                        </div>
                      )}
                      
                      {assignment.cutoffdate && assignment.cutoffdate !== assignment.duedate && (
                        <div className="detail-row">
                          <strong>Schließt:</strong>
                          <span>{logineoService.formatDate(assignment.cutoffdate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logineo;
