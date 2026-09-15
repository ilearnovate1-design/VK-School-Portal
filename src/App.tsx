import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSchool } from './contexts/SchoolContext';
import { AppShell } from './components/layout/AppShell';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { LoginPage } from './pages/auth/LoginPage';
import { InitialSetupPage } from './pages/auth/InitialSetupPage';
import { AdminDashboard } from './pages/dashboard/AdminDashboard';
import { TeacherDashboard } from './pages/dashboard/TeacherDashboard';
import { ParentDashboard } from './pages/dashboard/ParentDashboard';
import { StudentsPage } from './pages/students/StudentsPage';
import { AttendancePage } from './pages/attendance/AttendancePage';
import { FeesPage } from './pages/fees/FeesPage';
import { ResultsPage } from './pages/results/ResultsPage';
import { AssignmentsPage } from './pages/assignments/AssignmentsPage';
import { ClassesPage } from './pages/classes/ClassesPage';
import { TeachersPage } from './pages/teachers/TeachersPage';
import { ParentsPage } from './pages/parents/ParentsPage';
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { ReportCardModal } from './components/results/ReportCardModal';
import { Student, Result, SchoolClass } from './types';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';

export default function App() {
  const { currentUser, role, loading: authLoading } = useAuth();
  const { settings, loading: schoolLoading, isConfigured } = useSchool();

  const [currentPage, setCurrentPage] = useState<string>('dashboard');

  // Global Report Card Viewer state
  const [reportStudent, setReportStudent] = useState<Student | null>(null);
  const [reportClass, setReportClass] = useState<SchoolClass | null>(null);
  const [reportResults, setReportResults] = useState<Result[]>([]);

  const handleViewReportCard = async (student: Student) => {
    try {
      // 1. Fetch Class
      if (student.classId) {
        const cDoc = await getDoc(doc(db, 'classes', student.classId));
        if (cDoc.exists()) setReportClass(cDoc.data() as SchoolClass);
      }

      // 2. Fetch Results
      const rSnap = await getDocs(
        query(
          collection(db, 'results'),
          where('studentId', '==', student.studentId),
          where('term', '==', settings.currentTerm),
          where('academicSession', '==', settings.currentAcademicSession)
        )
      );
      const rList: Result[] = [];
      rSnap.forEach((d) => rList.push(d.data() as Result));
      setReportResults(rList);
      setReportStudent(student);
    } catch (err) {
      console.error('Error opening report card:', err);
    }
  };

  // Loading state
  if (authLoading || schoolLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <LoadingSpinner size="lg" text="Connecting to Nigerian School Portal..." />
      </div>
    );
  }

  // Not logged in: Show Login Screen
  if (!currentUser) {
    if (currentPage === 'setup') {
      return (
        <InitialSetupPage
          onComplete={() => setCurrentPage('dashboard')}
        />
      );
    }
    return (
      <LoginPage
        onSetupRequested={() => setCurrentPage('setup')}
      />
    );
  }

  // Logged in: Render inside AppShell
  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      {/* 1. Dashboard View */}
      {currentPage === 'dashboard' && (
        <>
          {role === 'ADMIN' && (
            <AdminDashboard 
              onNavigate={setCurrentPage} 
              onOpenQuickAction={(action) => {
                if (action === 'add-student') setCurrentPage('students');
                if (action === 'record-payment') setCurrentPage('fees');
                if (action === 'create-assignment') setCurrentPage('assignments');
                if (action === 'new-announcement') setCurrentPage('announcements');
              }}
            />
          )}
          {role === 'TEACHER' && <TeacherDashboard onNavigate={setCurrentPage} />}
          {role === 'PARENT' && (
            <ParentDashboard
              onNavigate={setCurrentPage}
              onViewReportCard={handleViewReportCard}
            />
          )}
        </>
      )}

      {/* 2. Students Directory & Profile */}
      {currentPage === 'students' && <StudentsPage />}

      {/* 3. Daily Attendance & Clock-In */}
      {currentPage === 'attendance' && <AttendancePage />}

      {/* 4. School Fees & Bursary */}
      {currentPage === 'fees' && (
        <>
          {role === 'PARENT' ? (
            <ParentDashboard
              onNavigate={setCurrentPage}
              onViewReportCard={handleViewReportCard}
            />
          ) : role === 'ADMIN' ? (
            <FeesPage />
          ) : (
            <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
              <p className="text-xs text-slate-500 mt-1">Financial records and bursary tariffs are restricted to school administrators.</p>
            </div>
          )}
        </>
      )}

      {/* 5. Terminal Examination Results & CA */}
      {currentPage === 'results' && (
        <>
          {role === 'PARENT' ? (
            <ParentDashboard
              onNavigate={setCurrentPage}
              onViewReportCard={handleViewReportCard}
            />
          ) : (
            <ResultsPage />
          )}
        </>
      )}

      {/* 6. Homework & Assignments */}
      {currentPage === 'assignments' && <AssignmentsPage />}

      {/* 7. Class Arms & Grades */}
      {currentPage === 'classes' && <ClassesPage />}

      {/* 8. Teachers Directory (Admin Only) */}
      {currentPage === 'teachers' && (
        role === 'ADMIN' ? (
          <TeachersPage />
        ) : (
          <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-1">Staff employment directories are restricted to school administrators.</p>
          </div>
        )
      )}

      {/* 9. Parents Directory (Admin Only) */}
      {currentPage === 'parents' && (
        role === 'ADMIN' ? (
          <ParentsPage />
        ) : (
          <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-1">Guardian directories are restricted to school administrators.</p>
          </div>
        )
      )}

      {/* 10. Announcements & Bulletins */}
      {currentPage === 'announcements' && <AnnouncementsPage />}

      {/* 11. School Profile & Academic Session Settings (Admin Only) */}
      {currentPage === 'settings' && (
        role === 'ADMIN' ? (
          <SettingsPage />
        ) : (
          <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-1">System settings and school configurations are restricted to administrators.</p>
          </div>
        )
      )}

      {/* 12. Security Audit Logs (Admin Only) */}
      {currentPage === 'audit' && (
        role === 'ADMIN' ? (
          <AuditLogsPage />
        ) : (
          <div className="p-8 text-center max-w-md mx-auto bg-white rounded-2xl border border-slate-200 mt-8 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-1">Institutional security audit logs are restricted to school administrators.</p>
          </div>
        )
      )}

      {/* 13. Initial Setup wizard */}
      {currentPage === 'setup' && (
        <InitialSetupPage
          onComplete={() => setCurrentPage('dashboard')}
        />
      )}

      {/* Global Terminal Report Card Modal */}
      <ReportCardModal
        isOpen={!!reportStudent}
        onClose={() => {
          setReportStudent(null);
          setReportClass(null);
        }}
        student={reportStudent}
        schoolClass={reportClass}
        results={reportResults}
      />
    </AppShell>
  );
}
