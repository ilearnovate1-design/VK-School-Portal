import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getPageTitle = (page: string) => {
    switch (page) {
      case 'dashboard': return 'Dashboard';
      case 'students': return 'Students';
      case 'parents': return 'Parents';
      case 'teachers': return 'Teachers';
      case 'classes': return 'Classes';
      case 'attendance': return 'Daily Attendance';
      case 'fees': return 'Fees & Payments';
      case 'results': return 'Examination Results';
      case 'assignments': return 'Assignments';
      case 'announcements': return 'Announcements';
      case 'settings': return 'School Settings';
      case 'audit': return 'Audit Logs & Security';
      default: return 'School Portal';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Sidebar for Desktop & Off-canvas for Mobile */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentPage={currentPage}
        onNavigate={onNavigate}
      />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col flex-1 pb-16 md:pb-0">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          currentPageTitle={getPageTitle(currentPage)}
          onNavigate={onNavigate}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav currentPage={currentPage} onNavigate={onNavigate} />
    </div>
  );
};
