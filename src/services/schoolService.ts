import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { SchoolSettings } from '../types';
import { DEFAULT_GRADING_SCALE } from '../utils/formatters';

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'School Management Portal',
  address: 'Nigeria',
  phone: '',
  email: '',
  website: '',
  currentAcademicSession: '2026/2027',
  currentTerm: 'First Term',
  gradingScale: DEFAULT_GRADING_SCALE,
};

export const getSchoolSettings = async (): Promise<SchoolSettings | null> => {
  try {
    const docRef = doc(db, 'schoolSettings', 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SchoolSettings;
    }
    return null;
  } catch (err) {
    console.error('Error fetching school settings:', err);
    return null;
  }
};

export const saveSchoolSettings = async (settings: Partial<SchoolSettings>): Promise<void> => {
  const docRef = doc(db, 'schoolSettings', 'general');
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    await setDoc(docRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } else {
    await setDoc(docRef, {
      ...DEFAULT_SCHOOL_SETTINGS,
      ...settings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};
