import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { GradingScaleItem } from '../types';

export const formatNaira = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '₦0';
  return '₦' + Math.round(amount).toLocaleString('en-NG');
};

export const formatDate = (dateInput: any): string => {
  if (!dateInput) return '—';
  let d: Date;
  if (typeof dateInput === 'string') {
    // Check if it's YYYY-MM-DD
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateInput);
    }
  } else if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    d = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    d = dateInput;
  } else if (dateInput.seconds) {
    d = new Date(dateInput.seconds * 1000);
  } else {
    return '—';
  }

  if (isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatTime = (dateInput: any): string => {
  if (!dateInput) return '—';
  let d: Date;
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    d = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    d = dateInput;
  } else if (dateInput.seconds) {
    d = new Date(dateInput.seconds * 1000);
  } else if (typeof dateInput === 'string') {
    d = new Date(dateInput);
  } else {
    return '—';
  }

  if (isNaN(d.getTime())) return '—';

  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DEFAULT_GRADING_SCALE: GradingScaleItem[] = [
  { min: 70, max: 100, grade: 'A', remark: 'Distinction' },
  { min: 60, max: 69, grade: 'B', remark: 'Very Good' },
  { min: 50, max: 59, grade: 'C', remark: 'Credit' },
  { min: 45, max: 49, grade: 'D', remark: 'Pass' },
  { min: 40, max: 44, grade: 'E', remark: 'Fair' },
  { min: 0, max: 39, grade: 'F', remark: 'Fail' },
];

export const calculateGrade = (score: number, scale: GradingScaleItem[] = DEFAULT_GRADING_SCALE) => {
  const rounded = Math.round(score);
  const found = scale.find(item => rounded >= item.min && rounded <= item.max);
  if (found) {
    return { grade: found.grade, remark: found.remark };
  }
  return { grade: 'F', remark: 'Fail' };
};

export const calculateGradeAndRemark = (score: number) => {
  if (score >= 70) return { grade: 'A', remark: 'Excellent' };
  if (score >= 60) return { grade: 'B', remark: 'Very Good' };
  if (score >= 50) return { grade: 'C', remark: 'Good' };
  if (score >= 45) return { grade: 'D', remark: 'Fair' };
  if (score >= 40) return { grade: 'E', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
};

export const generateReceiptNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `REC-${year}-${random}`;
};

export const numberToWordsNaira = (amount: number): string => {
  if (isNaN(amount) || amount <= 0) return 'Zero Naira Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertChunk = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
      if (n > 0) str += 'and ';
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str.trim();
  };

  const integerPart = Math.floor(amount);
  const million = Math.floor(integerPart / 1000000);
  const thousand = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  let words = '';
  if (million > 0) {
    words += convertChunk(million) + ' Million ';
  }
  if (thousand > 0) {
    words += convertChunk(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertChunk(remainder);
  }

  words = words.trim();
  return words ? `${words} Naira Only` : 'Zero Naira Only';
};

export const parseFirebaseError = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const message = error.message || error.code || String(error);
  if (message.includes('auth/invalid-credential') || message.includes('auth/invalid-login-credentials') || message.includes('auth/wrong-password') || message.includes('auth/user-not-found')) {
    return 'Invalid email address or password. Please check and try again.';
  }
  if (message.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists.';
  }
  if (message.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (message.includes('permission-denied')) {
    return 'Permission denied. You do not have authorization to perform this action.';
  }
  if (message.includes('network-request-failed')) {
    return 'Network connection problem. Please check your internet connection and retry.';
  }
  if (message.includes('auth/operation-not-allowed')) {
    return 'Email/Password authentication is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.';
  }
  return `Unable to complete operation: ${message}. Please try again or contact the administrator.`;
};

export const logAudit = async (
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  description: string
) => {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId,
      action,
      entityType,
      entityId,
      description,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
};
