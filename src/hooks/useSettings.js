import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getUserSettingsDoc } from '../firebase';
import { onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const DEFAULT_SETTINGS = {
  theme: 'light',
  currency: 'INR',
  displayName: '',
  notifications: false,
  language: 'en',
  nvidiaModel: 'meta/llama-3.3-70b-instruct',
  // Budget settings
  monthlyBudget: 0,
  categoryBudgets: {},
  // Notification preferences (granular)
  notificationPreferences: {
    billReminders: true,
    overspendingAlerts: true,
    savingsMilestones: true,
    weeklySummary: false
  }
};

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'syncing' | 'saved' | 'offline' | 'error'

  // Load from localStorage as cache on mount (before Firestore)
  useEffect(() => {
    let cached = localStorage.getItem('money-map-settings');

    // Migrate from old SettingsContext keys if new key not found
    if (!cached) {
      const oldKeys = [
        'moneyMap_theme',
        'moneyMap_currency',
        'moneyMap_displayName',
        'moneyMap_notifications',
        'moneyMap_language',
        'moneyMap_nvidiaModel'
      ];
      const migrated = {};
      let hasOld = false;
      oldKeys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) {
          hasOld = true;
          const settingKey = key.replace('moneyMap_', '');
          if (settingKey === 'notifications') {
            migrated[settingKey] = val === 'true';
          } else {
            migrated[settingKey] = val;
          }
        }
      });
      if (hasOld) {
        cached = JSON.stringify(migrated);
        localStorage.setItem('money-map-settings', cached);
        // Optionally clear old keys
        oldKeys.forEach(key => localStorage.removeItem(key));
      }
    }

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to parse cached settings:', e);
      }
    }
  }, []);

  // Apply theme to document when it changes
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Set up real-time listener for user settings
  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const settingsRef = getUserSettingsDoc(user.uid);

      // Listen for changes
      const unsubscribe = onSnapshot(
        settingsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const newSettings = {
              theme: data.theme ?? DEFAULT_SETTINGS.theme,
              currency: data.currency ?? DEFAULT_SETTINGS.currency,
              displayName: data.displayName ?? DEFAULT_SETTINGS.displayName,
              notifications: data.notifications ?? DEFAULT_SETTINGS.notifications,
              language: data.language ?? DEFAULT_SETTINGS.language,
              nvidiaModel: data.nvidiaModel ?? DEFAULT_SETTINGS.nvidiaModel,
              // New fields with defaults
              monthlyBudget: data.monthlyBudget ?? DEFAULT_SETTINGS.monthlyBudget,
              categoryBudgets: data.categoryBudgets ?? DEFAULT_SETTINGS.categoryBudgets,
              notificationPreferences: {
                billReminders: data.notificationPreferences?.billReminders ?? DEFAULT_SETTINGS.notificationPreferences.billReminders,
                overspendingAlerts: data.notificationPreferences?.overspendingAlerts ?? DEFAULT_SETTINGS.notificationPreferences.overspendingAlerts,
                savingsMilestones: data.notificationPreferences?.savingsMilestones ?? DEFAULT_SETTINGS.notificationPreferences.savingsMilestones,
                weeklySummary: data.notificationPreferences?.weeklySummary ?? DEFAULT_SETTINGS.notificationPreferences.weeklySummary
              }
            };
            setSettings(newSettings);
            // Cache to localStorage for offline fallback
            localStorage.setItem('money-map-settings', JSON.stringify(newSettings));
            setSyncStatus('saved');
          } else {
            // Document doesn't exist - initialize with defaults ONCE
            setDoc(settingsRef, {
              ...DEFAULT_SETTINGS,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            }, { merge: false }).catch(err => {
              console.error('Failed to initialize settings:', err);
              setSyncStatus('offline');
            });
            setSettings(DEFAULT_SETTINGS);
            localStorage.setItem('money-map-settings', JSON.stringify(DEFAULT_SETTINGS));
            setSyncStatus('saved');
          }
          setLoading(false);
        },
        (err) => {
          console.error('Settings listener error:', err);
          setError(err.message);
          // Fallback to localStorage
          const saved = localStorage.getItem('money-map-settings');
          if (saved) {
            try {
              setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
              setSyncStatus('offline');
            } catch {
              setSettings(DEFAULT_SETTINGS);
              setSyncStatus('error');
            }
          } else {
            setSettings(DEFAULT_SETTINGS);
            setSyncStatus('error');
          }
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  // Update a single setting
  const updateSetting = useCallback(async (key, value) => {
    if (!user) {
      setSyncStatus('error');
      throw new Error('User not authenticated');
    }

    setSyncStatus('syncing');
    try {
      const settingsRef = getUserSettingsDoc(user.uid);
      const updates = {
        [key]: value,
        updatedAt: serverTimestamp()
      };
      await setDoc(settingsRef, updates, { merge: true });
      setSyncStatus('saved');
      // onSnapshot will automatically update local state and cache to localStorage
    } catch (err) {
      console.error('Update setting error:', err);
      // Fallback: save to localStorage so changes persist offline
      const offlineSettings = { ...settings, [key]: value };
      localStorage.setItem('money-map-settings', JSON.stringify(offlineSettings));
      setSettings(offlineSettings);
      setSyncStatus('offline');
      // Don't throw - allow UI to continue with offline mode
      // Return a resolved promise to not break caller flow
      return Promise.resolve();
    }
  }, [user, settings]);

  return {
    settings,
    loading,
    error,
    syncStatus,
    updateSetting
  };
}
