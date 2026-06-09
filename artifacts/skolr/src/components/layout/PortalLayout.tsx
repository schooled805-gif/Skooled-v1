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
  Wallet,
  Trophy,
  BookMarked,
  Menu,
  UtensilsCrossed,
} from 'lucide-react';
import { isMealMenuSchool } from '@/lib/phases';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';

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
          { name: 'Account', path: '/parent/account', icon: Wallet },
          { name: 'Tuckshop', path: '/parent/tuckshop', icon: ShoppingBag },
          { name: 'Calendar', path: '/parent/calendar', icon: CalendarDays },
          { name: 'Schedule', path: '/parent/schedule', icon: Calendar },
          { name: 'Activities', path: '/parent/activities', icon: Trophy },
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
          { name: 'Reports', path: '/teacher/reports', icon: FileText },
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
          { name: 'Subjects',      path: '/admin/subjects',     icon: BookMarked },
          { name: 'Timetable',     path: '/admin/timetable',    icon: Calendar },
          { name: 'Activities',    path: '/admin/activities',   icon: Trophy },
          { name: 'Calendar',      path: '/admin/calendar',     icon: CalendarDays },
          { name: 'Events',        path: '/admin/events',       icon: Megaphone },
          { name: 'Tuckshop',      path: '/admin/tuckshop',     icon: ShoppingBag },
          { name: 'Fees',          path: '/admin/fees',         icon: Wallet },
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
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const config = getRoleConfig(role);
  // Nursery/pre-primary-only schools have no tuckshop — show a daily Menu tab instead.
  const mealMenu = isMealMenuSchool(school?.phases);
  const links = mealMenu
    ? config.links.map(link =>
        link.path.endsWith('/tuckshop') && role === 'admin'
          ? { name: 'Menu', path: '/admin/menu', icon: UtensilsCrossed }
          : link
      )
    : config.links;
  const brandColor = school?.primaryColor || config.fallbackColor;
  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(brandColor);
  const accentColor = isValidHex ? brandColor : config.fallbackColor;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation('/login');
  };

  const displayName = profile?.full_name || user?.email || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  // Shared sidebar content, used both in the fixed desktop sidebar and the
  // mobile slide-in drawer. `onNavigate` lets the drawer close on link tap.
  const sidebarContent = (onNavigate?: () => void) => (
    <>
      {/* Header */}
      <div className="h-16 flex items-center px-5 border-b border-gray-200 gap-3 flex-shrink-0">
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
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.path || location.startsWith(`${link.path}/`);
          return (
            <Link
              key={link.name}
              href={link.path}
              onClick={onNavigate}
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
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
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
    </>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Inject school brand hover styles */}
      <style>{`
        .skolr-nav-hover:hover {
          background-color: ${hexToRgba(accentColor, 0.08)};
          color: ${accentColor};
        }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        {sidebarContent()}
      </aside>

      {/* Mobile slide-in drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col gap-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          {sidebarContent(() => setMobileNavOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden h-14 flex items-center gap-3 px-4 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 -ml-2 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
            data-testid="button-open-menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          {school?.logoUrl ? (
            <img
              src={school.logoUrl}
              alt={school.name ?? 'School logo'}
              className="h-7 w-7 object-contain rounded flex-shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {(school?.name ?? 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-bold text-sm truncate" style={{ color: accentColor }}>
            {school?.name ?? 'Skolr'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
