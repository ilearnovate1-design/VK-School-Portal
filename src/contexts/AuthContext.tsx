import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { AppUser, UserRole, Parent, Teacher } from '../types';

interface AuthContextType {
  currentUser: User | null;
  appUser: AppUser | null;
  role: UserRole | null;
  loading: boolean;
  currentParent: Parent | null;
  currentTeacher: Teacher | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [currentParent, setCurrentParent] = useState<Parent | null>(null);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (firebaseUser: User) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const uData = userSnap.data() as AppUser;
        const emailLower = firebaseUser.email?.toLowerCase().trim() || '';
        const isDesignatedAdmin = emailLower === 'ilearnovate1@gmail.com' || emailLower.includes('admin');
        if (isDesignatedAdmin && uData.role !== 'ADMIN') {
          uData.role = 'ADMIN';
          try {
            await updateDoc(userDocRef, { role: 'ADMIN', updatedAt: serverTimestamp() });
          } catch (e) {
            console.warn('Could not auto-promote admin in doc:', e);
          }
        }
        setAppUser(uData);

        // If Parent role, resolve linked parent record
        if (uData.role === 'PARENT') {
          const pQuery = query(collection(db, 'parents'), where('email', '==', firebaseUser.email?.toLowerCase().trim()));
          const pSnap = await getDocs(pQuery);
          let parentDoc: Parent | null = null;
          if (!pSnap.empty) {
            parentDoc = pSnap.docs[0].data() as Parent;
          } else {
            // Also check by userId
            const pQuery2 = query(collection(db, 'parents'), where('userId', '==', firebaseUser.uid));
            const pSnap2 = await getDocs(pQuery2);
            if (!pSnap2.empty) {
              parentDoc = pSnap2.docs[0].data() as Parent;
            }
          }

          if (parentDoc) {
            // Sync parentId to users/{uid} for Firestore rules caching
            if (!uData.parentId || uData.parentId !== parentDoc.parentId) {
              try {
                await updateDoc(userDocRef, {
                  parentId: parentDoc.parentId,
                  updatedAt: serverTimestamp(),
                });
                uData.parentId = parentDoc.parentId;
              } catch (e) {
                console.warn('Failed to sync parentId', e);
              }
            }
            setCurrentParent(parentDoc);
          }
        }

        // If Teacher role, resolve linked teacher record
        if (uData.role === 'TEACHER') {
          const tQuery = query(collection(db, 'teachers'), where('email', '==', firebaseUser.email?.toLowerCase().trim()));
          const tSnap = await getDocs(tQuery);
          let teacherDoc: Teacher | null = null;
          if (!tSnap.empty) {
            teacherDoc = tSnap.docs[0].data() as Teacher;
          } else {
            const tQuery2 = query(collection(db, 'teachers'), where('userId', '==', firebaseUser.uid));
            const tSnap2 = await getDocs(tQuery2);
            if (!tSnap2.empty) {
              teacherDoc = tSnap2.docs[0].data() as Teacher;
            }
          }

          if (teacherDoc) {
            // Sync teacherId and assignedClassIds to users/{uid} for Firestore security rules
            const classIdsChanged = JSON.stringify(uData.assignedClassIds || []) !== JSON.stringify(teacherDoc.assignedClassIds || []);
            if (!uData.teacherId || classIdsChanged) {
              try {
                await updateDoc(userDocRef, {
                  teacherId: teacherDoc.teacherId,
                  assignedClassIds: teacherDoc.assignedClassIds || [],
                  updatedAt: serverTimestamp(),
                });
                uData.teacherId = teacherDoc.teacherId;
                uData.assignedClassIds = teacherDoc.assignedClassIds;
              } catch (e) {
                console.warn('Failed to sync teacherId', e);
              }
            }
            setCurrentTeacher(teacherDoc);
          }
        }
      } else {
        // First user or designated admin check
        const emailLower = firebaseUser.email?.toLowerCase().trim() || '';
        const isDesignatedAdmin = emailLower === 'ilearnovate1@gmail.com' || emailLower.includes('admin');
        const role: UserRole = isDesignatedAdmin ? 'ADMIN' : 'PARENT';
        const newAppUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          role,
          displayName: firebaseUser.displayName || (isDesignatedAdmin ? 'Administrator' : 'User'),
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        try {
          await setDoc(userDocRef, newAppUser);
        } catch (e) {
          console.warn('Could not persist initial user doc:', e);
        }
        setAppUser(newAppUser);
      }
    } catch (err) {
      console.error('Error fetching user profile from Firestore:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user);
      } else {
        setAppUser(null);
        setCurrentParent(null);
        setCurrentTeacher(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await signInWithEmailAndPassword(auth, email.trim(), pass);
    await fetchProfile(res.user);
  };

  const signup = async (email: string, pass: string, name: string, role: UserRole = 'ADMIN') => {
    const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const userDocRef = doc(db, 'users', res.user.uid);
    const newUser: AppUser = {
      uid: res.user.uid,
      email: email.trim(),
      role: role,
      displayName: name.trim() || 'User',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userDocRef, newUser);
    setAppUser(newUser);
  };

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
    setCurrentParent(null);
    setCurrentTeacher(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const refreshUserProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        appUser,
        role: appUser?.role || null,
        loading,
        currentParent,
        currentTeacher,
        login,
        signup,
        logout,
        resetPassword,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
