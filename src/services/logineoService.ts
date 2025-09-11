// Logineo/Moodle Service
// Implementation based on working Moodle API integration from Discord bot

export interface LogineoCredentials {
  username: string;
  password: string;
  baseUrl?: string;
}

export interface LogineoCourse {
  id: number;
  shortname: string;
  fullname: string;
}

export interface LogineoAssignment {
  id: number;
  name: string;
  duedate: number;
  cutoffdate: number;
  course: {
    id: number;
    shortname: string;
    fullname: string;
  };
  assignments?: LogineoAssignment[];
}

export interface LogineoData {
  courses: LogineoCourse[];
  assignments: LogineoAssignment[];
}

// Helper function to check if response contains HTML (indicates error)
function hasHtml(str: string): boolean {
  return /<\/?(html|head|body|title)/i.test(str);
}

// Helper function to parse JSON or return raw text
async function parseJsonOrText(res: Response): Promise<{ data: any; raw: string }> {
  const text = await res.text();
  try {
    return { data: JSON.parse(text), raw: text };
  } catch {
    return { data: null, raw: text };
  }
}

// Get authentication token from Moodle
async function getToken(credentials: LogineoCredentials): Promise<string> {
  const baseUrl = credentials.baseUrl || 'https://188086.logineonrw-lms.de';
  
  // Clean password (remove common paste errors like "...&password=abc;a")
  const cleanPass = credentials.password.replace(/;a$/, '');

  const res = await fetch(`${baseUrl}/login/token.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: credentials.username,
      password: cleanPass,
      service: 'moodle_mobile_app',
    }),
  });

  const { data, raw } = await parseJsonOrText(res);

  if (!res.ok) {
    throw new Error(`Token HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }

  if (!data) {
    if (hasHtml(raw)) {
      throw new Error(`Token returned HTML (likely SSO/redirect or service disabled): ${raw.slice(0, 200)}`);
    }
    throw new Error(`Token non-JSON: ${raw.slice(0, 200)}`);
  }

  if (data.error) {
    throw new Error(`Token error: ${data.error} (${data.errorcode || 'no_code'})`);
  }

  if (!data.token) {
    throw new Error(`No token returned. Raw: ${raw.slice(0, 200)}`);
  }

  return data.token;
}

// Call Moodle web service
async function callWS(token: string, wsfunction: string, params: Record<string, any> = {}, baseUrl: string): Promise<any> {
  const res = await fetch(`${baseUrl}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      moodlewsrestformat: 'json',
      wstoken: token,
      wsfunction,
      ...params,
    }),
  });

  const { data, raw } = await parseJsonOrText(res);

  if (!res.ok) {
    throw new Error(`WS ${wsfunction} HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }

  if (!data) {
    if (hasHtml(raw)) {
      throw new Error(`WS ${wsfunction} returned HTML (likely no service perms): ${raw.slice(0, 200)}`);
    }
    throw new Error(`WS ${wsfunction} non-JSON: ${raw.slice(0, 200)}`);
  }

  if (data.exception) {
    const msg = `${data.exception}: ${data.message} [${data.errorcode || 'no_code'}]`;
    throw new Error(`WS ${wsfunction} exception: ${msg}`);
  }

  return data;
}

// Get user ID from site info
async function getUserId(token: string, baseUrl: string): Promise<number> {
  const info = await callWS(token, 'core_webservice_get_site_info', {}, baseUrl);
  return info?.userid;
}

// Get user's courses
async function getCourses(token: string, userid: number, baseUrl: string): Promise<LogineoCourse[]> {
  return await callWS(token, 'core_enrol_get_users_courses', { userid }, baseUrl);
}

// Get assignments for specific courses
async function getAssignments(token: string, courseIds: number[], baseUrl: string): Promise<any> {
  const params: Record<string, any> = {};
  courseIds.forEach((id, i) => {
    params[`courseids[${i}]`] = id;
  });
  return await callWS(token, 'mod_assign_get_assignments', params, baseUrl);
}

// Format date for display
export function formatDate(ts: number): string | null {
  if (!ts || ts <= 0) return null; // No fake 1970 dates
  const d = new Date(ts * 1000);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  }).format(d).replace(',', '');
}

// Compact course name (remove prefixes, parentheses, etc.)
export function compactCourseName(course: LogineoCourse): string {
  const raw = (course.shortname && String(course.shortname).trim()) ||
              (course.fullname && String(course.fullname).trim()) || 'Kurs';

  // Remove common FA/FI class prefixes
  let name = raw
    .replace(/^(FA|FI)\s*[_ ]*\d{2}\s*[_ ]*\d{0,2}\s*[_ ]*/i, '')
    .replace(/^(FA|FI)\s*[_ ]*/i, '');

  // Remove parentheses suffixes
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Collapse whitespace
  name = name.replace(/\s+/g, ' ').trim();

  // Shorten very long names
  if (name.length > 48) name = name.slice(0, 45) + '…';

  return name;
}

// Get assignment status
export function getAssignmentStatus(assignment: LogineoAssignment): string {
  const now = Math.floor(Date.now() / 1000);
  const due = assignment.duedate || 0;
  const cut = assignment.cutoffdate || 0;

  if (due > 0) {
    if (now < due) {
      // Soon if within 48h
      return (due - now <= 48 * 3600) ? '⏳ Bald fällig!' : '✅ Noch Zeit';
    } else if (cut > 0 && now < cut) {
      return '⚠️ Überfällig!';
    } else {
      return '⚠️ Überfällig!';
    }
  } else if (cut > 0) {
    return (now < cut) ? '✅ Noch Zeit' : '🔒 Geschlossen';
  } else {
    return 'Kein Datum...';
  }
}

// Generate formatted assignment overview text
export function generateAssignmentOverview(assignments: LogineoAssignment[]): string {
  const now = Math.floor(Date.now() / 1000);
  
  // Group assignments by course
  const courseMap = new Map<number, { course: LogineoCourse; assignments: LogineoAssignment[] }>();
  
  assignments.forEach(assignment => {
    if (!courseMap.has(assignment.course.id)) {
      courseMap.set(assignment.course.id, {
        course: assignment.course,
        assignments: []
      });
    }
    courseMap.get(assignment.course.id)!.assignments.push(assignment);
  });

  let output = '# 📚 Alle Upload-Hausaufgaben im Überblick\n\n';
  
  // Sort courses alphabetically by compact name
  const sortedCourses = Array.from(courseMap.values())
    .sort((a, b) => compactCourseName(a.course).localeCompare(compactCourseName(b.course), 'de'));

  for (const { course, assignments: courseAssignments } of sortedCourses) {
    if (courseAssignments.length === 0) continue;
    
    const courseName = compactCourseName(course);
    output += `**${courseName}**\n`;
    
    // Sort assignments by duedate (undefined last)
    courseAssignments.sort((a, b) => (a.duedate || Infinity) - (b.duedate || Infinity));
    
    for (const assignment of courseAssignments) {
      const status = getAssignmentStatus(assignment);
      const dueStr = formatDate(assignment.duedate);
      const cutStr = formatDate(assignment.cutoffdate);
      
      let when = '';
      if (dueStr) when = `fällig am \`${dueStr}\``;
      else if (cutStr) when = `schließt \`${cutStr}\``;
      
      const whenPart = when ? ` (${when})` : '';
      output += `• ${assignment.name}${whenPart} -> ${status}\n`;
    }
    
    output += '\n';
  }
  
  if (sortedCourses.length === 0) {
    output += '_Keine sichtbaren Aufgaben gefunden._\n';
  }
  
  return output;
}

export const logineoService = {
  async testConnection(credentials: LogineoCredentials): Promise<boolean> {
    try {
      await getToken(credentials);
      return true;
    } catch (error) {
      console.error('Logineo connection test failed:', error);
      return false;
    }
  },

  async getAllLogineoData(credentials: LogineoCredentials): Promise<LogineoData> {
    const baseUrl = credentials.baseUrl || 'https://188086.logineonrw-lms.de';
    
    try {
      const token = await getToken(credentials);
      const userid = await getUserId(token, baseUrl);
      const courses = await getCourses(token, userid, baseUrl);
      const courseIds = (courses || []).map(c => c.id);
      
      if (!courseIds.length) {
        return { courses: [], assignments: [] };
      }

      const assignmentsResponse = await getAssignments(token, courseIds, baseUrl);
      
      // Transform the response to match our interface
      const allAssignments: LogineoAssignment[] = [];
      
      if (assignmentsResponse.courses) {
        for (const course of assignmentsResponse.courses) {
          if (course.assignments) {
            for (const assignment of course.assignments) {
              allAssignments.push({
                id: assignment.id,
                name: assignment.name,
                duedate: assignment.duedate || 0,
                cutoffdate: assignment.cutoffdate || 0,
                course: {
                  id: course.id,
                  shortname: course.shortname,
                  fullname: course.fullname
                }
              });
            }
          }
        }
      }

      return {
        courses: courses || [],
        assignments: allAssignments
      };
    } catch (error) {
      console.error('Error fetching Logineo data:', error);
      throw new Error(`Logineo API Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  // Helper functions for UI
  formatDate,
  compactCourseName,
  getAssignmentStatus,
  generateAssignmentOverview
};