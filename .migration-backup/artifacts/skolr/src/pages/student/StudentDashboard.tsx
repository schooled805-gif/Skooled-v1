import React, { useState } from 'react';
import { Link } from 'wouter';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useListTimetableEntries, useListAnnouncements, useListReports } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock, FileText, Megaphone, BookOpen } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const priorityColor = (p: string | null) =>
  ({ high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700' })[p ?? ''] ?? 'bg-gray-100 text-gray-600';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const today = DAY_NAMES[new Date().getDay()];
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  const { data: allEntries, isLoading: loadingTimetable } = useListTimetableEntries();
  const { data: announcements, isLoading: loadingAnn } = useListAnnouncements({ audience_type: 'student' });
  const { data: reports, isLoading: loadingReports } = useListReports();

  const todayEntries = (allEntries ?? [])
    .filter(e => e.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nextClass = todayEntries.find(e => {
    const [h, m] = e.start_time.split(':').map(Number);
    const now = new Date();
    return h > now.getHours() || (h === now.getHours() && m > now.getMinutes());
  });

  const visibleReports = (reports ?? []).filter(r => r.visible_to_student);

  const typeColor = (type: string) =>
    ({ lesson: 'bg-orange-100 text-orange-700', sport: 'bg-blue-100 text-blue-700', exam: 'bg-red-100 text-red-700' })[type] ?? 'bg-gray-100 text-gray-600';

  return (
    <PortalLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Hey{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {nextClass
              ? `Next up: ${nextClass.subject_name ?? 'class'} at ${nextClass.start_time}`
              : todayEntries.length > 0
              ? `You have ${todayEntries.length} class${todayEntries.length !== 1 ? 'es' : ''} today`
              : "No classes scheduled today — enjoy your day!"}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Today's Classes", value: loadingTimetable ? '–' : todayEntries.length, color: 'text-orange-600' },
            { label: 'Announcements', value: loadingAnn ? '–' : (announcements?.length ?? 0), color: 'text-purple-600' },
            { label: 'My Reports', value: loadingReports ? '–' : visibleReports.length, color: 'text-blue-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's timetable */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-orange-500" /> Today — {today}
              </CardTitle>
              <Link href="/student/timetable">
                <span className="text-xs text-orange-500 hover:underline cursor-pointer">Full timetable</span>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingTimetable ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-orange-400" /></div>
              ) : todayEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Free day — no classes!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayEntries.map(entry => {
                    const [h] = entry.start_time.split(':').map(Number);
                    const now = new Date();
                    const isPast = h < now.getHours();
                    return (
                      <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isPast ? 'opacity-50 bg-gray-50 border-gray-100' : 'bg-orange-50 border-orange-100'}`}>
                        <div className="text-xs text-gray-500 w-20 shrink-0 font-mono">
                          {entry.start_time}–{entry.end_time}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{entry.subject_name ?? 'Subject'}</p>
                          {entry.teacher_name && <p className="text-xs text-gray-400">{entry.teacher_name}</p>}
                        </div>
                        {entry.room && <span className="text-xs text-gray-400 shrink-0">Rm {entry.room}</span>}
                        <Badge className={`${typeColor(entry.type)} hover:opacity-90 text-xs`}>{entry.type}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {/* Announcements */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-orange-500" /> Announcements
                </CardTitle>
                <Link href="/student/announcements">
                  <span className="text-xs text-orange-500 hover:underline cursor-pointer">All</span>
                </Link>
              </CardHeader>
              <CardContent>
                {loadingAnn ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin h-4 w-4 text-orange-400" /></div>
                ) : !(announcements?.length) ? (
                  <p className="text-sm text-gray-400 text-center py-3">No announcements</p>
                ) : (
                  <div className="space-y-2">
                    {(announcements ?? []).slice(0, 3).map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnnouncement(a)}
                        className="w-full text-left hover:bg-orange-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-gray-800 truncate flex-1">{a.title}</p>
                          {(a as any).priority && (
                            <Badge className={`${priorityColor((a as any).priority)} text-xs hover:opacity-90 shrink-0`}>
                              {(a as any).priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reports */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" /> My Reports
                </CardTitle>
                <Link href="/student/reports">
                  <span className="text-xs text-orange-500 hover:underline cursor-pointer">View all</span>
                </Link>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin h-4 w-4 text-orange-400" /></div>
                ) : visibleReports.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-3">No reports available yet</p>
                ) : (
                  <div className="space-y-2">
                    {visibleReports.slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        <span className="text-gray-700 truncate">{r.title}</span>
                        <span className="text-gray-400 text-xs shrink-0">T{r.term} {r.year}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Timetable', href: '/student/timetable', color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' },
            { label: 'Reports', href: '/student/reports', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
            { label: 'Announcements', href: '/student/announcements', color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200' },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`p-4 rounded-xl border text-sm font-medium text-center cursor-pointer transition-colors ${item.color}`}>
                {item.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Announcement detail dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-3 pr-6">
              <Megaphone className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <span>{selectedAnnouncement?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {selectedAnnouncement?.priority && (
              <Badge className={`${priorityColor(selectedAnnouncement.priority)} text-xs`}>
                {selectedAnnouncement.priority} priority
              </Badge>
            )}
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedAnnouncement?.body}</p>
            {selectedAnnouncement?.author_name && (
              <p className="text-xs text-gray-400 pt-2 border-t">Posted by {selectedAnnouncement.author_name}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
