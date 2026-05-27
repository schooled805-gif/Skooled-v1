import React from 'react';
import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/public/Landing";
import Login from "@/pages/public/Login";
import Signup from "@/pages/public/Signup";
import ProfileSetup from "@/pages/public/ProfileSetup";
import ResetPassword from "@/pages/public/ResetPassword";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminBranding from "@/pages/admin/AdminBranding";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminTeachers from "@/pages/admin/AdminTeachers";
import AdminStudents from "@/pages/admin/AdminStudents";
import AdminClasses from "@/pages/admin/AdminClasses";
import AdminTimetable from "@/pages/admin/AdminTimetable";
import AdminCalendar from "@/pages/admin/AdminCalendar";
import AdminEvents from "@/pages/admin/AdminEvents";
import AdminApprovals from "@/pages/admin/AdminApprovals";
import AdminReports from "@/pages/admin/AdminReports";
import AdminAnnouncements from "@/pages/admin/AdminAnnouncements";

import ParentDashboard from "@/pages/parent/ParentDashboard";
import ParentSchedule from "@/pages/parent/ParentSchedule";
import ParentApprovals from "@/pages/parent/ParentApprovals";
import ParentMessages from "@/pages/parent/ParentMessages";
import ParentReports from "@/pages/parent/ParentReports";

import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import TeacherSetup from "@/pages/teacher/TeacherSetup";
import TeacherClasses from "@/pages/teacher/TeacherClasses";
import TeacherMessages from "@/pages/teacher/TeacherMessages";
import TeacherApprovals from "@/pages/teacher/TeacherApprovals";
import TeacherAnnouncements from "@/pages/teacher/TeacherAnnouncements";

import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentTimetable from "@/pages/student/StudentTimetable";
import StudentReports from "@/pages/student/StudentReports";
import StudentAnnouncements from "@/pages/student/StudentAnnouncements";

const queryClient = new QueryClient();

const AuthGuard = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, loading, role } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (loading) return;
    if (!user) { setLocation('/login'); return; }
    if (!role) { setLocation('/profile-setup'); return; }
  }, [loading, user, role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !role) return null;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Access Denied. <Link href="/" className="ml-2 underline text-blue-600">Go home</Link>
      </div>
    );
  }

  return <>{children}</>;
};

const RootRedirect = () => {
  const { user, role, loading } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (loading) return;
    if (!user) return;            // not logged in → show landing page
    if (!role) { setLocation('/profile-setup'); return; }
    setLocation(`/${role}`);      // logged in → go to portal
  }, [loading, user, role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  return <Landing />;
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/profile-setup" component={ProfileSetup} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Admin */}
      <Route path="/admin">
        <AuthGuard allowedRoles={['admin']}><AdminDashboard /></AuthGuard>
      </Route>
      <Route path="/admin/users">
        <AuthGuard allowedRoles={['admin']}><AdminUsers /></AuthGuard>
      </Route>
      <Route path="/admin/teachers">
        <AuthGuard allowedRoles={['admin']}><AdminTeachers /></AuthGuard>
      </Route>
      <Route path="/admin/students">
        <AuthGuard allowedRoles={['admin']}><AdminStudents /></AuthGuard>
      </Route>
      <Route path="/admin/classes">
        <AuthGuard allowedRoles={['admin']}><AdminClasses /></AuthGuard>
      </Route>
      <Route path="/admin/timetable">
        <AuthGuard allowedRoles={['admin']}><AdminTimetable /></AuthGuard>
      </Route>
      <Route path="/admin/calendar">
        <AuthGuard allowedRoles={['admin']}><AdminCalendar /></AuthGuard>
      </Route>
      <Route path="/admin/events">
        <AuthGuard allowedRoles={['admin']}><AdminEvents /></AuthGuard>
      </Route>
      <Route path="/admin/approvals">
        <AuthGuard allowedRoles={['admin']}><AdminApprovals /></AuthGuard>
      </Route>
      <Route path="/admin/reports">
        <AuthGuard allowedRoles={['admin']}><AdminReports /></AuthGuard>
      </Route>
      <Route path="/admin/branding">
        <AuthGuard allowedRoles={['admin']}><AdminBranding /></AuthGuard>
      </Route>
      <Route path="/admin/announcements">
        <AuthGuard allowedRoles={['admin']}><AdminAnnouncements /></AuthGuard>
      </Route>

      {/* Parent */}
      <Route path="/parent">
        <AuthGuard allowedRoles={['parent']}><ParentDashboard /></AuthGuard>
      </Route>
      <Route path="/parent/schedule">
        <AuthGuard allowedRoles={['parent']}><ParentSchedule /></AuthGuard>
      </Route>
      <Route path="/parent/approvals">
        <AuthGuard allowedRoles={['parent']}><ParentApprovals /></AuthGuard>
      </Route>
      <Route path="/parent/messages">
        <AuthGuard allowedRoles={['parent']}><ParentMessages /></AuthGuard>
      </Route>
      <Route path="/parent/reports">
        <AuthGuard allowedRoles={['parent']}><ParentReports /></AuthGuard>
      </Route>

      {/* Teacher */}
      <Route path="/teacher/setup">
        <AuthGuard allowedRoles={['teacher']}><TeacherSetup /></AuthGuard>
      </Route>
      <Route path="/teacher">
        <AuthGuard allowedRoles={['teacher']}><TeacherDashboard /></AuthGuard>
      </Route>
      <Route path="/teacher/classes">
        <AuthGuard allowedRoles={['teacher']}><TeacherClasses /></AuthGuard>
      </Route>
      <Route path="/teacher/messages">
        <AuthGuard allowedRoles={['teacher']}><TeacherMessages /></AuthGuard>
      </Route>
      <Route path="/teacher/approvals">
        <AuthGuard allowedRoles={['teacher']}><TeacherApprovals /></AuthGuard>
      </Route>
      <Route path="/teacher/announcements">
        <AuthGuard allowedRoles={['teacher']}><TeacherAnnouncements /></AuthGuard>
      </Route>

      {/* Student */}
      <Route path="/student">
        <AuthGuard allowedRoles={['student']}><StudentDashboard /></AuthGuard>
      </Route>
      <Route path="/student/timetable">
        <AuthGuard allowedRoles={['student']}><StudentTimetable /></AuthGuard>
      </Route>
      <Route path="/student/reports">
        <AuthGuard allowedRoles={['student']}><StudentReports /></AuthGuard>
      </Route>
      <Route path="/student/announcements">
        <AuthGuard allowedRoles={['student']}><StudentAnnouncements /></AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
