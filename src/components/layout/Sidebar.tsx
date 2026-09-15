import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Briefcase,
  Layers,
  CalendarCheck2,
  Receipt,
  Award,
  ClipboardList,
  Megaphone,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
}) => {
  const { role } = useAuth();

  const getNavItems = (): NavItem[] => {
    if (role === 'ADMIN') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'students', label: 'Students', icon: Users },
        { id: 'parents', label: 'Parents', icon: UserCheck },
        { id: 'teachers', label: 'Teachers', icon: Briefcase },
        { id: 'classes', label: 'Classes', icon: Layers },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
        { id: 'fees', label: 'Fees & Payments', icon: Receipt },
        { id: 'results', label: 'Results & Reports', icon: Award },
        { id: 'assignments', label: 'Assignments', icon: ClipboardList },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
      ];
    } else if (role === 'TEACHER') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'classes', label: 'My Classes', icon: Layers },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
        { id: 'assignments', label: 'Assignments', icon: ClipboardList },
        { id: 'results', label: 'Results', icon: Award },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ];
    } else {
      // PARENT
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'students', label: 'My Children', icon: Users },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
        { id: 'results', label: 'Results', icon: Award },
        { id: 'fees', label: 'Fees & Receipts', icon: Receipt },
        { id: 'assignments', label: 'Assignments', icon: ClipboardList },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ];
    }
  };

  const navItems = getNavItems();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs uppercase font-bold tracking-widest text-slate-500">
              {role === 'ADMIN' ? 'School Admin' : role === 'TEACHER' ? 'Teacher Portal' : 'Parent Portal'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors min-h-[44px] text-left cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-3 border-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 leading-tight">
            Designed for 50–100 pupils
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Simple • Fast • Mobile-First
          </p>
        </div>
      </aside>
    </>
  );
};
