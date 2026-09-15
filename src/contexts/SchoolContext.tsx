import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolSettings, AppNotification } from '../types';
import { getSchoolSettings, DEFAULT_SCHOOL_SETTINGS, saveSchoolSettings } from '../services/schoolService';
import { useAuth } from './AuthContext';

interface SchoolContextType {
  settings: SchoolSettings;
  loading: boolean;
  loadingSettings: boolean;
  isConfigured: boolean;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  reloadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchSettings = async () => {
    try {
      const data = await getSchoolSettings();
      if (data) {
        setSettings(data);
      } else {
        // If not initialized yet, use default
        setSettings(DEFAULT_SCHOOL_SETTINGS);
      }
    } catch (e) {
      console.error('Error in fetchSettings:', e);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Listen for in-app notifications
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach((doc) => {
        list.push({ notificationId: doc.id, ...(doc.data() as any) });
      });
      setNotifications(list);
    }, (error) => {
      // Ignored if index is pending
      console.warn('Notifications listener:', error.message);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const updateSettings = async (newSettings: Partial<SchoolSettings>) => {
    await saveSchoolSettings(newSettings);
    await fetchSettings();
  };

  const markNotificationsAsRead = async () => {
    if (!currentUser) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.notificationId), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark notifications as read', err);
    }
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <SchoolContext.Provider
      value={{
        settings,
        loading: loadingSettings,
        loadingSettings,
        isConfigured: !!settings?.schoolName,
        notifications,
        unreadNotificationsCount,
        reloadSettings: fetchSettings,
        updateSettings,
        markNotificationsAsRead,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = (): SchoolContextType => {
  const ctx = useContext(SchoolContext);
  if (!ctx) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return ctx;
};
