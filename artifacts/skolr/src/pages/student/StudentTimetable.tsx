import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useListTimetableEntries } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const typeColor = (type: string) => {
  const map: Record<string, string> = {
    lesson: 'bg-orange-100 text-orange-700',
    sport: 'bg-blue-100 text-blue-700',
    event: 'bg-purple-100 text-purple-700',
    exam: 'bg-red-100 text-red-700',
    homework: 'bg-gray-100 text-gray-700',
  };
  return map[type] ?? 'bg-gray-100 text-gray-600';
};

export default function StudentTimetable() {
  const { data: entries, isLoading } = useListTimetableEntries();

  return (
    <PortalLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Timetable</h1>
          <p className="text-gray-500 mt-1">Your weekly schedule</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>
        ) : (
          <div className="grid gap-4">
            {DAYS.map(day => {
              const dayEntries = (entries ?? []).filter(e => e.day_of_week?.toLowerCase() === day.toLowerCase());
              return (
                <Card key={day}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-orange-600">{day}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dayEntries.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">Free day</p>
                    ) : (
                      <div className="space-y-2">
                        {dayEntries.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(entry => (
                          <div key={entry.id} className="flex items-center gap-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
                            <div className="flex items-center gap-1 text-sm text-gray-500 w-28 shrink-0">
                              <Clock className="h-3.5 w-3.5" />
                              {entry.start_time}–{entry.end_time}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{entry.subject_name ?? 'Subject'}</span>
                              {entry.teacher_name && <span className="text-sm text-gray-500 ml-2">— {entry.teacher_name}</span>}
                            </div>
                            {entry.room && <span className="text-xs text-gray-400">Room {entry.room}</span>}
                            <Badge className={`${typeColor(entry.type)} hover:opacity-90 text-xs`}>{entry.type}</Badge>
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
