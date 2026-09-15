import React from 'react';
import { 
  LayoutDashboard, 
  CalendarCheck2, 
  Users, 
  Receipt, 
  ClipboardList 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate }) => {
  const { role } = useAuth();

  const getItems = () => {
    if (role === 'ADMIN') {
      return [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
        { id: 'students', label: 'Students', icon: Users },
        { id: 'fees', label: 'Fees', icon: Receipt },
      ];
    } else if (role === 'TEACHER') {
      return [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
        { id: 'assignments', label: 'Assignments', icon: ClipboardList },
      ];
    } else {
      // PARENT
      return [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
        { id: 'fees', label: 'Fees', icon: Receipt },
        { id: 'assignments', label: 'Assignments', icon: ClipboardList },
      ];
    }
  };

  const items = getItems();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200/90 shadow-lg px-2 pt-1 pb-[max(env(safe-area-inset-bottom),4px)] flex items-center justify-around">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            id={`bottom-nav-${item.id}`}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center py-1.5 px-3 min-h-[48px] rounded-lg transition-colors ${
              isActive ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
