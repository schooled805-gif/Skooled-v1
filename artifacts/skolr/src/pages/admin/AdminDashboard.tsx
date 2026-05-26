import React from 'react';
import { Link } from 'wouter';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetDashboardSummary, useListAnnouncements } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, GraduationCap, BookOpen, CheckSquare, MessageSquare, Calendar, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const priorityColor = (p: string | null) =>
  ({ high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700' })[p ?? ''] ?? 'bg-gray-100 text-gray-600';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: announcements, isLoading: loadingAnn } = useListAnnouncements();

  const stats = [
    { label: 'Students', value: summary?.total_students ?? 0, icon: <GraduationCap className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-100', href: '/admin/students' },
    { label: 'Teachers', value: summary?.total_teachers ?? 0, icon: <BookOpen className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-100', href: '/admin/users' },
    { label: 'Classes', value: summary?.total_classes ?? 0, icon: <Calendar className="h-5 w-5 text-purple-600" />, bg: 'bg-purple-100', href: '/admin/classes' },
    { label: 'Pending Approvals', value: summary?.pending_approvals ?? 0, icon: <CheckSquare className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-100', href: '/admin/approvals' },
    { label: 'Unread Messages', value: summary?.unread_messages ?? 0, icon: <MessageSquare className="h-5 w-5 text-indigo-600" />, bg: 'bg-indigo-100', href: '/admin/users' },
    { label: 'Events', value: summary?.upcoming_events ?? 0, icon: <Calendar className="h-5 w-5 text-rose-600" />, bg: 'bg-rose-100', href: '/admin/events' },
  ];

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 mt-1">Here's a live overview of school operations.</p>
        </div>

        {/* Stats grid */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {stats.map(s => (
              <Link key={s.label} href={s.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                      {s.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent announcements */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-blue-600" /> Recent Announcements
              </CardTitle>
              <Link href="/admin/announcements">
                <span className="text-xs text-blue-600 hover:underline cursor-pointer">Manage</span>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingAnn ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-blue-400" /></div>
              ) : !(announcements?.length) ? (
                <div className="text-center py-6">
                  <Megaphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No announcements yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(announcements ?? []).slice(0, 5).map(a => (
                    <div key={a.id} className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                          {a.priority && <Badge className={`${priorityColor(a.priority)} text-xs hover:opacity-90 shrink-0`}>{a.priority}</Badge>}
                          <Badge variant="outline" className="text-xs shrink-0">{a.audience_type}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Add User', href: '/admin/users', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
                  { label: 'Add Student', href: '/admin/students', color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200' },
                  { label: 'New Class', href: '/admin/classes', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
                  { label: 'New Event', href: '/admin/events', color: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' },
                  { label: 'Upload Report', href: '/admin/reports', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
                  { label: 'Announcement', href: '/admin/announcements', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200' },
                ].map(item => (
                  <Link key={item.href} href={item.href}>
                    <div className={`p-3 rounded-lg border text-sm font-medium text-center cursor-pointer transition-colors ${item.color}`}>
                      {item.label}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
