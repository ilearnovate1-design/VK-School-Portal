import React, { useState } from 'react';
import { 
  Menu, X, Bell, LogOut, User, GraduationCap, ChevronDown 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSchool } from '../../contexts/SchoolContext';
import { Badge } from '../common/Badge';

interface NavbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  currentPageTitle: string;
  onNavigate: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  currentPageTitle,
  onNavigate,
}) => {
  const { appUser, logout } = useAuth();
  const { settings, notifications, unreadNotificationsCount, markNotificationsAsRead } = useSchool();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleToggleNotifications = async () => {
    const willShow = !showNotifications;
    setShowNotifications(willShow);
    if (willShow && unreadNotificationsCount > 0) {
      await markNotificationsAsRead();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-2xs">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Brand/Page Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="mobile-menu-toggle-btn"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-xs">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
              ) : (
                <GraduationCap className="w-5 h-5" />
              )}
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                {settings.schoolName || 'School Management'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {settings.currentAcademicSession} • {settings.currentTerm}
              </p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-sm font-semibold text-slate-900 truncate max-w-[170px]">
                {currentPageTitle}
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Notifications & User profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              id="notifications-btn"
              onClick={handleToggleNotifications}
              aria-label="View notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div 
                id="notifications-popover"
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 animate-in fade-in zoom-in-95"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Notifications
                  </span>
                  <button 
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('announcements');
                    }}
                    className="text-xs text-emerald-700 hover:underline font-medium"
                  >
                    View All Announcements
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No recent notifications
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {notifications.slice(0, 5).map((n) => (
                      <div key={n.notificationId} className="p-2.5 rounded-lg bg-slate-50 text-xs">
                        <div className="font-semibold text-slate-900">{n.title}</div>
                        <p className="text-slate-600 mt-0.5">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              type="button"
              id="user-profile-menu-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left min-h-[44px]"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-semibold text-xs">
                {appUser?.displayName ? appUser.displayName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[120px]">
                  {appUser?.displayName || 'User'}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  <Badge 
                    size="sm"
                    variant={appUser?.role === 'ADMIN' ? 'purple' : appUser?.role === 'TEACHER' ? 'info' : 'success'}
                  >
                    {appUser?.role || 'Guest'}
                  </Badge>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>

            {showUserMenu && (
              <div 
                id="user-dropdown-menu"
                className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 animate-in fade-in"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {appUser?.displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{appUser?.email}</p>
                  <div className="mt-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      Role: {appUser?.role}
                    </span>
                  </div>
                </div>

                {appUser?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('settings');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg text-left"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    School Settings
                  </button>
                )}

                <button
                  type="button"
                  id="logout-btn"
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg text-left font-medium mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
