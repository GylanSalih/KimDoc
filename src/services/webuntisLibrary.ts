import { WebUntis } from 'webuntis';
import { config } from '../utils/config';

export interface WebUntisData {
  timetable: any[];
  homework: any[];
  exams: any[];
  absences: any[];
  userInfo: any;
}

export class WebUntisLibraryService {
  private untis: WebUntis | null = null;

  async connect(): Promise<boolean> {
    try {
      console.log('Trying WebUntis library connection...');
      
      // Try different school configurations for Heinrich-Hertz-Schule
      const schoolConfigs = [
        { school: 'heinrich-hertz-schule', server: 'ajax.webuntis.com' },
        { school: 'heinrichhertzschule', server: 'ajax.webuntis.com' },
        { school: 'heinrich-hertz-Schule', server: 'ajax.webuntis.com' },
        { school: 'stadtheinrichhertzschule', server: 'ajax.webuntis.com' },
        { school: 'hhs-duesseldorf', server: 'ajax.webuntis.com' },
        { school: 'heinrich-hertz-schule', server: 'neuss.webuntis.com' },
        { school: 'heinrich-hertz-schule', server: 'herakles.webuntis.com' }
      ];
      
      for (const schoolConfig of schoolConfigs) {
        try {
          console.log(`Trying WebUntis library with: ${schoolConfig.school} on ${schoolConfig.server}`);
          
          this.untis = new WebUntis(
            schoolConfig.school,
            config.untis_username || '',
            config.untis_password || '',
            schoolConfig.server
          );
          
          await this.untis.login();
          console.log(`Successfully connected with WebUntis library: ${schoolConfig.school}@${schoolConfig.server}`);
          return true;
        } catch (error) {
          console.log(`WebUntis library failed for ${schoolConfig.school}@${schoolConfig.server}:`, error);
          this.untis = null;
          continue;
        }
      }
      
      console.log('All WebUntis library attempts failed');
      return false;
    } catch (error) {
      console.error('WebUntis library connection failed:', error);
      return false;
    }
  }

  async getComprehensiveData(weekStart: Date): Promise<WebUntisData> {
    if (!this.untis) {
      throw new Error('WebUntis not connected. Call connect() first.');
    }

    const results: WebUntisData = {
      timetable: [],
      homework: [],
      exams: [],
      absences: [],
      userInfo: null
    };

    try {
      // Get user info
      console.log('Fetching user info with WebUntis library...');
      try {
        const userInfo = await this.untis.getCurrentUser();
        results.userInfo = userInfo;
        console.log('User info loaded:', userInfo);
      } catch (error) {
        console.error('Error fetching user info:', error);
      }

      // Get timetable for the week
      console.log('Fetching timetable with WebUntis library...');
      try {
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const timetable = await this.untis.getOwnTimetableForRange(weekStart, weekEnd);
        results.timetable = timetable;
        console.log(`Found ${timetable.length} timetable entries`);
      } catch (error) {
        console.error('Error fetching timetable:', error);
      }

      // Get homework
      console.log('Fetching homework with WebUntis library...');
      try {
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const homework = await this.untis.getHomeworksForRange(weekStart, weekEnd);
        results.homework = homework;
        console.log(`Found ${homework.length} homework entries`);
      } catch (error) {
        console.error('Error fetching homework:', error);
      }

      // Get exams
      console.log('Fetching exams with WebUntis library...');
      try {
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const exams = await this.untis.getExamsForRange(weekStart, weekEnd);
        results.exams = exams;
        console.log(`Found ${exams.length} exam entries`);
      } catch (error) {
        console.error('Error fetching exams:', error);
      }

      // Get absences
      console.log('Fetching absences with WebUntis library...');
      try {
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const absences = await this.untis.getAbsencesForRange(weekStart, weekEnd);
        results.absences = absences;
        console.log(`Found ${absences.length} absence entries`);
      } catch (error) {
        console.error('Error fetching absences:', error);
      }

      console.log('WebUntis library data loaded:', results);
      return results;

    } catch (error) {
      console.error('Error in getComprehensiveData:', error);
      return results;
    }
  }

  async disconnect(): Promise<void> {
    if (this.untis) {
      try {
        await this.untis.logout();
        console.log('WebUntis library disconnected');
      } catch (error) {
        console.error('Error disconnecting WebUntis library:', error);
      }
      this.untis = null;
    }
  }

  isConnected(): boolean {
    return this.untis !== null;
  }
}

// Export a singleton instance
export const webUntisLibrary = new WebUntisLibraryService();
