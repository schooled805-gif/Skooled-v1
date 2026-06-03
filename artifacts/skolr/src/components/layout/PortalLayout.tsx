import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { 
  LogOut, 
  Home, 
  Users, 
  Calendar, 
  MessageSquare, 
  FileText, 
  CheckSquare, 
  Megaphone,
  BookOpen,
  GraduationCap,
  UserRound,
  CalendarDays,
  Palette,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PortalLayoutProps {
  children: React.ReactNode;
  role: 'parent' | 'teacher' | 'student' | 'admin';
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const getRoleConfig = (role: string) => {
  switch (role) {
    case 'parent':
      return {
        fallbackColor: '#9333EA',
        hoverBg: 'hover:bg-purple-50',
        links: [
          { name: 'Dashboard', path: '/parent', icon: Home },
          { name: 'Tuckshop', path: '/parent/tuckshop', icon: ShoppingBag },
          { name: 'Schedule', path: '/parent/schedule', icon: Calendar },
          { name: 'Approvals', path: '/parent/approvals', icon: CheckSquare },
          { name: 'Messages', path: '/parent/messages', icon: MessageSquare },
          { name: 'Reports', path: '/parent/reports', icon: FileText },
        ]
      };
    case 'teacher':
      return {
        fallbackColor: '#059669',
        hoverBg: 'hover:bg-emerald-50',
        links: [
          { name: 'Dashboard', path: '/teacher', icon: Home },
          { name: 'My Classes', path: '/teacher/classes', icon: Users },
          { name: 'Messages', path: '/teacher/messages', icon: MessageSquare },
          { name: 'Approvals', path: '/teacher/approvals', icon: CheckSquare },
          { name: 'Announcements', path: '/teacher/announcements', icon: Megaphone },
        ]
      };
    case 'student':
      return {
        fallbackColor: '#F97316',
        hoverBg: 'hover:bg-orange-50',
        links: [
          { name: 'Dashboard', path: '/student', icon: Home },
          { name: 'Tuckshop', path: '/student/tuckshop', icon: ShoppingBag },
          { name: 'Timetable', path: '/student/timetable', icon: Calendar },
          { name: 'Reports', path: '/student/reports', icon: FileText },
          { name: 'Announcements', path: '/student/announcements', icon: Megaphone },
        ]
      };
    case 'admin':
      return {
        fallbackColor: '#2563EB',
        hoverBg: 'hover:bg-blue-50',
        links: [
          { name: 'Dashboard',     path: '/admin',              icon: Home },
          { name: 'Users',         path: '/admin/users',        icon: Users },
          { name: 'Teachers',      path: '/admin/teachers',     icon: UserRound },
          { name: 'Students',      path: '/admin/students',     icon: GraduationCap },
          { name: 'Classes',       path: '/admin/classes',      icon: BookOpen },
          { name: 'Timetable',     path: '/admin/timetable',    icon: Calendar },
          { name: 'Calendar',      path: '/admin/calendar',     icon: CalendarDays },
          { name: 'Events',        path: '/admin/events',       icon: Megaphone },
          { name: 'Tuckshop',      path: '/admin/tuckshop',     icon: ShoppingBag },
          { name: 'Approvals',     path: '/admin/approvals',    icon: CheckSquare },
          { name: 'Reports',       path: '/admin/reports',      icon: FileText },
          { name: 'Announcements', path: '/admin/announcements',icon: Megaphone },
          { name: 'Branding',      path: '/admin/branding',     icon: Palette },
        ]
      };
    default:
      return { fallbackColor: '#475569', hoverBg: 'hover:bg-gray-50', links: [] };
  }
};

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children, role }) => {
  const [location, setLocation] = useLocation();
  const { user, profile, school } = useAuth();

  const config = getRoleConfig(role);
  const brandColor = school?.primaryColor || config.fallbackColor;
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(brandColor);
  const accentColor = isValidHex ? brandColor : config.fallbackColor;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation('/login');
  };

  const displayName = profile?.full_name || user?.email || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Inject school brand hover styles */}
      <style>{`
        .skolr-nav-hover:hover {
          background-color: ${hexToRgba(accentColor, 0.08)};
          color: ${accentColor};
        }
      `}</style>

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center px-5 border-b border-gray-200 gap-3">
          {school?.logoUrl ? (
            <img
              src={school.logoUrl}
              alt={school.name ?? 'School logo'}
              className="h-8 w-8 object-contain rounded flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {(school?.name ?? 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate" style={{ color: accentColor }}>
              {school?.name ?? 'Skolr'}
            </p>
            <p className="text-xs text-gray-400 capitalize">{role} portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {config.links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.path || location.startsWith(`${link.path}/`);
            return (
              <Link
                key={link.name}
                href={link.path}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive ? '' : `text-gray-700 skolr-nav-hover`
                }`}
                style={isActive ? {
                  backgroundColor: hexToRgba(accentColor, 0.12),
                  color: accentColor,
                } : {}}
                data-testid={`link-${link.name.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {initials}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start text-gray-600"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
