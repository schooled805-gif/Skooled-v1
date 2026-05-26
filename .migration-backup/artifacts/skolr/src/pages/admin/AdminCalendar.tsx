import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useListEvents } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { useLocation } from 'wouter';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EVENT_COLORS: Record<string, string> = {
  holiday:    'bg-red-100 text-red-700 border-red-200',
  exam:       'bg-orange-100 text-orange-700 border-orange-200',
  sports:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  cultural:   'bg-purple-100 text-purple-700 border-purple-200',
  meeting:    'bg-blue-100 text-blue-700 border-blue-200',
  other:      'bg-gray-100 text-gray-700 border-gray-200',
};

function eventColor(type: string | null | undefined): string {
  return EVENT_COLORS[type ?? 'other'] ?? EVENT_COLORS.other;
}

export default function AdminCalendar() {
  const { schoolId } = useAuth();
  const [, setLocation] = useLocation();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const { data: events, isLoading } = useListEvents();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  // Build a map: "YYYY-MM-DD" => events[]
  const eventsByDate: Record<string, typeof events> = {};
  (events ?? []).forEach(ev => {
    const key = ev.start_datetime?.slice(0, 10);
    if (!key) return;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key]!.push(ev);
  });

  // Grid cells: nulls for padding + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Events this month for the list view
  const monthEvents = (events ?? []).filter(ev => {
    const d = ev.start_datetime ? new Date(ev.start_datetime) : null;
    return d && d.getFullYear() === year && d.getMonth() === month;
  }).sort((a, b) => (a.start_datetime ?? '').localeCompare(b.start_datetime ?? ''));

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">School Calendar</h1>
            <p className="text-gray-500 mt-1">Events, holidays, and key dates</p>
          </div>
          <Button
            onClick={() => setLocation('/admin/events')}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-manage-events"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Event
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="xl:col-span-2">
            <Card>
              <CardContent className="p-4">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{MONTHS[month]} {year}</h2>
                    <Button variant="outline" size="sm" onClick={goToday} className="text-xs">Today</Button>
                  </div>
                  <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar cells */}
                {isLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-blue-400" /></div>
                ) : (
                  <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                    {cells.map((day, idx) => {
                      if (day === null) {
                        return <div key={`pad-${idx}`} className="bg-gray-50 min-h-[80px]" />;
                      }
                      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayEvents = eventsByDate[key] ?? [];
                      return (
                        <div
                          key={key}
                          className={`bg-white min-h-[80px] p-1.5 ${isToday(day) ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                        >
                          <span className={`text-xs font-medium ${isToday(day) ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-gray-600'}`}>
                            {day}
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {dayEvents.slice(0, 2).map(ev => (
                              <div
                                key={ev.id}
                                className={`text-[10px] px-1 py-0.5 rounded border truncate font-medium ${eventColor(ev.event_type)}`}
                                title={ev.title}
                              >
                                {ev.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 2} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Month event list */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {MONTHS[month]} Events
            </h3>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-blue-400" /></div>
            ) : monthEvents.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No events this month</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setLocation('/admin/events')}
                  >
                    Add Event
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {monthEvents.map(ev => {
                  const d = ev.start_datetime ? new Date(ev.start_datetime) : null;
                  return (
                    <Card key={ev.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex gap-3 items-start">
                        <div className="text-center shrink-0 w-10">
                          <p className="text-xs text-gray-400 uppercase">{d ? MONTHS[d.getMonth()].slice(0, 3) : ''}</p>
                          <p className="text-lg font-bold text-gray-900 leading-none">{d?.getDate()}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{ev.title}</p>
                          {ev.description && <p className="text-xs text-gray-400 truncate">{ev.description}</p>}
                          {ev.event_type && (
                            <Badge className={`text-[10px] mt-1 ${eventColor(ev.event_type)}`}>
                              {ev.event_type}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
