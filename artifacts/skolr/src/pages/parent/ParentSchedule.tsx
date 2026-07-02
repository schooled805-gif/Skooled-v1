import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useListTimetableEntries } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ParentSchedule() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const { data: entries, isLoading } = useListTimetableEntries();
  const { data: signups } = useQuery<any[]>({
    queryKey: ['parent-activity-signups'],
    queryFn: async () => {
      const r = await fetch('/api/activity-signups', { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
    enabled: !!token,
  });
  const { data: activities } = useQuery<any[]>({
    queryKey: ['parent-activities'],
    queryFn: async () => {
      const r = await fetch('/api/activities', { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
    enabled: !!token,
  });
  const { data: customEvents } = useQuery<any[]>({
    queryKey: ['parent-custom-events'],
    queryFn: async () => {
      const r = await fetch('/api/custom-events', { headers: { Authorization: `Bearer ${token}` } });
      return r.ok ? r.json() : [];
    },
    enabled: !!token,
  });
  const signedIds = new Set((signups ?? []).map(s => s.activity_id));
  const myActivities = (activities ?? []).filter(a => signedIds.has(a.id));

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Weekly Schedule</h1>
          <p className="text-gray-500 mt-1">Your children's timetable for the week</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-purple-600" /></div>
        ) : (
          <div className="grid gap-4">
            {DAYS.map(day => {
              const dayEntries = (entries ?? []).filter(e => e.day_of_week?.toLowerCase() === day.toLowerCase());
              const dayActivities = myActivities.filter(a => a.day_of_week?.toLowerCase() === day.toLowerCase());
              const dayCustom = (customEvents ?? []).filter(c =>
                (c.days_of_week ?? []).some((d: string) => d.toLowerCase() === day.toLowerCase()));
              const hasNothing = dayEntries.length === 0 && dayActivities.length === 0 && dayCustom.length === 0;
              return (
                <Card key={day}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-purple-700">{day}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hasNothing ? (
                      <p className="text-sm text-gray-400 py-2">No lessons</p>
                    ) : (
                      <div className="space-y-2">
                        {dayEntries.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(entry => (
                          <div key={entry.id} className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-1 text-sm text-gray-500 w-28 shrink-0">
                              <Clock className="h-3.5 w-3.5" />
                              {entry.start_time} – {entry.end_time}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{entry.subject_name ?? 'Subject'}</span>
                              {entry.teacher_name && <span className="text-sm text-gray-500 ml-2">with {entry.teacher_name}</span>}
                            </div>
                            {entry.room && <Badge variant="outline" className="text-xs">{entry.room}</Badge>}
                            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">{entry.type}</Badge>
                          </div>
                        ))}
                        {dayActivities
                          .slice()
                          .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
                          .map(act => (
                          <div key={act.id} className="flex items-center gap-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                            <div className="flex items-center gap-1 text-sm text-gray-500 w-28 shrink-0">
                              <Clock className="h-3.5 w-3.5" />
                              {act.start_time ?? '—'}{act.end_time ? ` – ${act.end_time}` : ''}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{act.name}</span>
                              {act.location && <span className="text-sm text-gray-500 ml-2">@ {act.location}</span>}
                            </div>
                            <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">Activity</Badge>
                          </div>
                        ))}
                        {dayCustom
                          .slice()
                          .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
                          .map(ev => (
                          <div key={ev.id} className="flex items-center gap-4 p-3 bg-teal-50 rounded-lg border border-teal-100">
                            <div className="flex items-center gap-1 text-sm text-gray-500 w-28 shrink-0">
                              <Clock className="h-3.5 w-3.5" />
                              {ev.start_time ?? '—'}{ev.end_time ? ` – ${ev.end_time}` : ''}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{ev.title}</span>
                              {ev.location && <span className="text-sm text-gray-500 ml-2">@ {ev.location}</span>}
                            </div>
                            <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 text-xs">Personal</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
