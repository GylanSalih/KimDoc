// localStorage utilities for Logineo credentials
import type { LogineoCredentials } from '../services/logineoService';

const STORAGE_KEY = 'logineo_credentials';

export interface StoredLogineoCredentials {
  username: string;
  password: string;
  baseUrl: string;
  isLoggedIn: boolean;
  lastLogin: number; // timestamp
  enabled: boolean; // whether Logineo is enabled in settings
}

export const logineoStorage = {
  // Save credentials to localStorage
  saveCredentials: (credentials: LogineoCredentials, enabled: boolean = true): void => {
    try {
      const storedData: StoredLogineoCredentials = {
        username: credentials.username,
        password: credentials.password,
        baseUrl: credentials.baseUrl || 'https://188086.logineonrw-lms.de',
        isLoggedIn: true,
        lastLogin: Date.now(),
        enabled: enabled
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
      console.log('✅ Logineo credentials saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save Logineo credentials:', error);
    }
  },

  // Load credentials from localStorage
  loadCredentials: (): StoredLogineoCredentials | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored) as StoredLogineoCredentials;
      
      // Check if credentials are not too old (e.g., 7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      if (Date.now() - parsed.lastLogin > maxAge) {
        console.log('🕒 Logineo credentials expired, removing from localStorage');
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ Failed to load Logineo credentials:', error);
      return null;
    }
  },

  // Clear credentials from localStorage
  clearCredentials: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ Logineo credentials cleared from localStorage');
    } catch (error) {
      console.error('❌ Failed to clear Logineo credentials:', error);
    }
  },

  // Check if user is logged in
  isLoggedIn: (): boolean => {
    const stored = logineoStorage.loadCredentials();
    return stored?.isLoggedIn === true;
  },

  // Get credentials for API calls
  getCredentials: (): LogineoCredentials | null => {
    const stored = logineoStorage.loadCredentials();
    if (!stored) return null;
    
    return {
      username: stored.username,
      password: stored.password,
      baseUrl: stored.baseUrl
    };
  },

  // Update enabled status
  setEnabled: (enabled: boolean): void => {
    try {
      const stored = logineoStorage.loadCredentials();
      if (stored) {
        stored.enabled = enabled;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        console.log(`✅ Logineo enabled status updated to: ${enabled}`);
      }
    } catch (error) {
      console.error('❌ Failed to update Logineo enabled status:', error);
    }
  },

  // Check if Logineo is enabled
  isEnabled: (): boolean => {
    const stored = logineoStorage.loadCredentials();
    return stored?.enabled === true;
  }
};
