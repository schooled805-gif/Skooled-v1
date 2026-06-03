import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useListTimetableEntries } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function ParentSchedule() {
  const { profile } = useAuth();
  const { data: entries, isLoading } = useListTimetableEntries();

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
              return (
                <Card key={day}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-purple-700">{day}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dayEntries.length === 0 ? (
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
