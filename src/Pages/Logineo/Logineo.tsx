import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, XCircle, Loader, AlertTriangle, Clock, ChevronLeft, ChevronRight, Calendar, Grid3X3 } from 'lucide-react';
import './Logineo.scss';
import { logineoService, type LogineoAssignment, type LogineoCourse } from '../../services/logineoService';
import { config } from '../../utils/config';

const Logineo: React.FC = () => {
  const [assignments, setAssignments] = useState<LogineoAssignment[]>([]);
  const [courses, setCourses] = useState<LogineoCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'grid'>('calendar');
  const [sortBy, setSortBy] = useState<'due-date' | 'status' | 'course' | 'name'>('due-date');

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

  // Filter and sort assignments based on selected course, status, and sort criteria
  const filteredAssignments = useMemo(() => {
    try {
      // First filter by course
      let filtered = assignments;
      if (selectedCourse !== 'all') {
        filtered = assignments.filter(assignment => {
          try {
            return assignment.course?.id?.toString() === selectedCourse;
          } catch (error) {
            console.error('Error filtering by course:', error, assignment);
            return false;
          }
        });
      }
      
      // Then filter by status
      if (selectedStatus !== 'all') {
        filtered = filtered.filter(assignment => {
          try {
            const statusClass = getStatusClass(assignment);
            return statusClass === selectedStatus;
          } catch (error) {
            console.error('Error filtering by status:', error, assignment);
            return false;
          }
        });
      }
      
      // Sort assignments based on selected criteria
      const sorted = [...filtered].sort((a, b) => {
        try {
          // Priority order: overdue > soon > on-time > closed > no-date
          const statusOrder = { 'overdue': 0, 'soon': 1, 'on-time': 2, 'closed': 3, 'no-date': 4 };
          
          switch (sortBy) {
            case 'due-date':
              // Sort by due date (overdue first, then by date)
              const aStatus = getStatusClass(a);
              const bStatus = getStatusClass(b);
              
              const aStatusOrder = statusOrder[aStatus as keyof typeof statusOrder] ?? 5;
              const bStatusOrder = statusOrder[bStatus as keyof typeof statusOrder] ?? 5;
              
              if (aStatusOrder !== bStatusOrder) {
                return aStatusOrder - bStatusOrder;
              }
              
              // If same status, sort by actual due date
              if (a.duedate && b.duedate) {
                return a.duedate - b.duedate;
              }
              if (a.duedate) return -1;
              if (b.duedate) return 1;
              return 0;
              
            case 'status':
              // Sort by status only
              const aStatusOnly = getStatusClass(a);
              const bStatusOnly = getStatusClass(b);
              const aStatusOrderOnly = statusOrder[aStatusOnly as keyof typeof statusOrder] ?? 5;
              const bStatusOrderOnly = statusOrder[bStatusOnly as keyof typeof statusOrder] ?? 5;
              return aStatusOrderOnly - bStatusOrderOnly;
              
            case 'course':
              // Sort by course name
              const aCourseName = a.course ? logineoService.compactCourseName(a.course) : '';
              const bCourseName = b.course ? logineoService.compactCourseName(b.course) : '';
              return aCourseName.localeCompare(bCourseName);
              
            case 'name':
              // Sort by assignment name
              const aName = a.name || '';
              const bName = b.name || '';
              return aName.localeCompare(bName);
              
            default:
              return 0;
          }
        } catch (error) {
          console.error('Error sorting assignments:', error, { a, b, sortBy });
          return 0;
        }
      });
      
      return sorted;
    } catch (error) {
      console.error('Error in filteredAssignments:', error);
      return assignments; // Fallback to original assignments
    }
  }, [assignments, selectedCourse, selectedStatus, sortBy]);

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
    try {
      if (!assignment) return <FileText className="status-icon no-date" />;
      const status = logineoService.getAssignmentStatus(assignment);
      if (!status) return <FileText className="status-icon no-date" />;
      
      const statusLower = status.toLowerCase();
      
      // Check for overdue indicators
      if (status.includes('⚠️') || statusLower.includes('überfällig') || statusLower.includes('overdue')) {
        return <AlertTriangle className="status-icon overdue" />;
      }
      
      // Check for soon indicators
      if (status.includes('⏳') || statusLower.includes('bald') || statusLower.includes('soon')) {
        return <Clock className="status-icon soon" />;
      }
      
      // Check for on-time indicators
      if (status.includes('✅') || statusLower.includes('zeit') || statusLower.includes('on-time')) {
        return <CheckCircle className="status-icon on-time" />;
      }
      
      // Check for closed indicators
      if (status.includes('🔒') || statusLower.includes('geschlossen') || statusLower.includes('closed')) {
        return <XCircle className="status-icon closed" />;
      }
      
      return <FileText className="status-icon no-date" />;
    } catch (error) {
      console.error('Error getting status icon:', error, assignment);
      return <FileText className="status-icon no-date" />;
    }
  };

  const getStatusClass = (assignment: LogineoAssignment) => {
    try {
      if (!assignment) return 'no-date';
      const status = logineoService.getAssignmentStatus(assignment);
      if (!status) return 'no-date';
      
      // Check for various status indicators
      const statusLower = status.toLowerCase();
      
      // Check for overdue indicators
      if (status.includes('⚠️') || statusLower.includes('überfällig') || statusLower.includes('overdue')) {
        return 'overdue';
      }
      
      // Check for soon indicators
      if (status.includes('⏳') || statusLower.includes('bald') || statusLower.includes('soon')) {
        return 'soon';
      }
      
      // Check for on-time indicators
      if (status.includes('✅') || statusLower.includes('zeit') || statusLower.includes('on-time')) {
        return 'on-time';
      }
      
      // Check for closed indicators
      if (status.includes('🔒') || statusLower.includes('geschlossen') || statusLower.includes('closed')) {
        return 'closed';
      }
      
      return 'no-date';
    } catch (error) {
      console.error('Error getting status class:', error, assignment);
      return 'no-date';
    }
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


      <div className={`logineo-controls ${viewMode === 'grid' ? 'grid-mode' : ''}`}>
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

        <div className="control-group status-filter">
          <label htmlFor="status-filter">Status:</label>
          <select 
            id="status-filter" 
            value={selectedStatus} 
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">Alle Status</option>
            <option value="overdue">⚠️ Überfällig</option>
            <option value="soon">⏳ Bald fällig</option>
            <option value="on-time">✅ Noch Zeit</option>
            <option value="closed">🔒 Geschlossen</option>
            <option value="no-date">📄 Kein Datum</option>
          </select>
        </div>

        <div className="view-toggle">
          <button 
            className={`toggle-button ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <Calendar size={16} />
            Kalender
          </button>
          <button 
            className={`toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 size={16} />
            Grid
          </button>
        </div>

        {viewMode === 'grid' && (
          <div className="control-group sort-control">
            <label htmlFor="sort-filter">Sortieren nach:</label>
            <select 
              id="sort-filter" 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as 'due-date' | 'status' | 'course' | 'name')}
            >
              <option value="due-date">Fälligkeit (Überfällig zuerst)</option>
              <option value="status">Status</option>
              <option value="course">Kurs</option>
              <option value="name">Name</option>
            </select>
          </div>
        )}

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
        <>
          {viewMode === 'calendar' ? (
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
          ) : (
            <div className="grid-container">
              <div className="grid-header">
                <h2>📋 Aufgaben-Übersicht</h2>
                <p>{filteredAssignments.length} Aufgaben gefunden</p>
              </div>
              
              <div className="assignments-grid">
                {filteredAssignments.map(assignment => {
                  try {
                    if (!assignment) return null;
                    
                    return (
                      <div 
                        key={assignment.id || Math.random()} 
                        className={`assignment-card ${getStatusClass(assignment)}`}
                        onClick={() => {
                          try {
                            setSelectedDay(new Date(assignment.duedate ? assignment.duedate * 1000 : new Date()));
                            setShowModal(true);
                          } catch (error) {
                            console.error('Error opening assignment modal:', error);
                          }
                        }}
                      >
                        <div className="assignment-card-header">
                          {getStatusIcon(assignment)}
                          <div className="assignment-status">
                            {assignment ? logineoService.getAssignmentStatus(assignment) : 'Unbekannt'}
                          </div>
                        </div>
                        
                        <h3 className="assignment-title">
                          {assignment.name || 'Unbenannte Aufgabe'}
                        </h3>
                        
                        <div className="assignment-course">
                          {assignment.course ? logineoService.compactCourseName(assignment.course) : 'Unbekannter Kurs'}
                        </div>
                        
                        {assignment.duedate && (
                          <div className="assignment-due-date">
                            <Clock size={14} />
                            <span>{logineoService.formatDate(assignment.duedate)}</span>
                          </div>
                        )}
                        
                        {assignment.cutoffdate && assignment.cutoffdate !== assignment.duedate && (
                          <div className="assignment-cutoff-date">
                            <AlertTriangle size={14} />
                            <span>Schließt: {logineoService.formatDate(assignment.cutoffdate)}</span>
                          </div>
                        )}
                      </div>
                    );
                  } catch (error) {
                    console.error('Error rendering assignment card:', error, assignment);
                    return null;
                  }
                })}
              </div>
              
              {filteredAssignments.length === 0 && (
                <div className="empty-state">
                  <FileText size={48} />
                  <h3>Keine Aufgaben gefunden</h3>
                  <p>Versuche einen anderen Kurs auszuwählen oder aktualisiere die Daten.</p>
                </div>
              )}

              <div className="grid-legend">
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
        </>
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
