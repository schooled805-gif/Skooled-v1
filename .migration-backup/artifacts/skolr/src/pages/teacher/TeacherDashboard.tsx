import React from 'react';
import { Link } from 'wouter';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useListTimetableEntries,
  useListApprovals,
  useListAnnouncements,
  useListClasses,
} from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock, Users, CheckSquare, Megaphone, ArrowRight, BookOpen } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const today = DAY_NAMES[new Date().getDay()];

  const { data: allEntries, isLoading: loadingTimetable } = useListTimetableEntries();
  const { data: approvals, isLoading: loadingApprovals } = useListApprovals();
  const { data: announcements, isLoading: loadingAnn } = useListAnnouncements();
  const { data: classes, isLoading: loadingClasses } = useListClasses();

  const todayEntries = (allEntries ?? [])
    .filter(e => e.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const pendingApprovals = (approvals ?? []).filter(a => a.status === 'pending');

  const typeColor = (type: string) =>
    ({ lesson: 'bg-emerald-100 text-emerald-700', sport: 'bg-blue-100 text-blue-700', exam: 'bg-red-100 text-red-700' })[type] ?? 'bg-gray-100 text-gray-600';

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 mt-1">Here's your overview for {today}.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Today's Classes", value: loadingTimetable ? '–' : todayEntries.length, color: 'border-l-emerald-400', bg: 'bg-emerald-100', icon: <BookOpen className="h-4 w-4 text-emerald-600" /> },
            { label: 'My Classes', value: loadingClasses ? '–' : (classes?.length ?? 0), color: 'border-l-blue-400', bg: 'bg-blue-100', icon: <Users className="h-4 w-4 text-blue-600" /> },
            { label: 'Pending Approvals', value: loadingApprovals ? '–' : pendingApprovals.length, color: 'border-l-amber-400', bg: 'bg-amber-100', icon: <CheckSquare className="h-4 w-4 text-amber-600" /> },
            { label: 'Announcements', value: loadingAnn ? '–' : (announcements?.length ?? 0), color: 'border-l-purple-400', bg: 'bg-purple-100', icon: <Megaphone className="h-4 w-4 text-purple-600" /> },
          ].map(s => (
            <Card key={s.label} className={`border-l-4 ${s.color}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's schedule */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" /> Today's Schedule — {today}
              </CardTitle>
              <Link href="/teacher/classes">
                <span className="text-xs text-emerald-600 hover:underline cursor-pointer">All classes</span>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingTimetable ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-emerald-400" /></div>
              ) : todayEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No classes scheduled today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div className="text-xs text-gray-500 w-20 shrink-0 font-mono">
                        {entry.start_time}–{entry.end_time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{entry.subject_name ?? 'Subject'}</p>
                        {entry.class_name && <p className="text-xs text-gray-400">{entry.class_name}</p>}
                      </div>
                      {entry.room && <span className="text-xs text-gray-400">Rm {entry.room}</span>}
                      <Badge className={`${typeColor(entry.type)} hover:opacity-90 text-xs`}>{entry.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending approvals + Recent announcements */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-600" /> Pending Approvals
                </CardTitle>
                <Link href="/teacher/approvals">
                  <span className="text-xs text-emerald-600 hover:underline cursor-pointer">View all</span>
                </Link>
              </CardHeader>
              <CardContent>
                {loadingApprovals ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin h-4 w-4 text-emerald-400" /></div>
                ) : pendingApprovals.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">No pending approvals</p>
                ) : (
                  <div className="space-y-2">
                    {pendingApprovals.slice(0, 3).map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <CheckSquare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span className="text-gray-700 truncate">{a.event_title ?? 'Event'}</span>
                        <span className="text-gray-400 text-xs shrink-0">{a.student_name}</span>
                      </div>
                    ))}
                    {pendingApprovals.length > 3 && (
                      <p className="text-xs text-gray-400">+{pendingApprovals.length - 3} more</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-emerald-600" /> Recent Announcements
                </CardTitle>
                <Link href="/teacher/announcements">
                  <span className="text-xs text-emerald-600 hover:underline cursor-pointer">Post new</span>
                </Link>
              </CardHeader>
              <CardContent>
                {loadingAnn ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin h-4 w-4 text-emerald-400" /></div>
                ) : !(announcements?.length) ? (
                  <p className="text-sm text-gray-400 text-center py-3">No announcements yet</p>
                ) : (
                  <div className="space-y-2">
                    {(announcements ?? []).slice(0, 3).map(a => (
                      <div key={a.id} className="text-sm">
                        <p className="font-medium text-gray-800 truncate">{a.title}</p>
                        <p className="text-xs text-gray-400 truncate">{a.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'My Classes', href: '/teacher/classes', color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
            { label: 'Approvals', href: '/teacher/approvals', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
            { label: 'Messages', href: '/teacher/messages', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'Announcements', href: '/teacher/announcements', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`p-4 rounded-xl border text-sm font-medium text-center cursor-pointer transition-colors ${item.color}`}>
                {item.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
