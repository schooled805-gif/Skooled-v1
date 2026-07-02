import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Printer, CalendarDays, CalendarRange } from 'lucide-react';
import {
  CALENDAR_YEAR,
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  PUBLIC_HOLIDAYS,
  TERMS,
  classifyDate,
  eventsInMonth,
  holidaysInMonth,
  ymd,
  type DayType,
} from '@/lib/termCalendar';

interface TermCalendarProps {
  accentColor: string;
}

const TYPE_CELL: Record<DayType, string> = {
  public: 'bg-red-100 text-red-700 font-semibold',
  'school-holiday': 'bg-amber-100 text-amber-700',
  'school-day': 'text-gray-800',
  none: 'text-gray-400',
};

/** Return an array of week rows (Sunday-first) for a month, null = blank cell. */
function monthMatrix(year: number, monthIndex: number): (number | null)[][] {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Local (not UTC) YYYY-MM-DD so the "today" highlight is correct in every
// timezone. Building from ISO would shift by a day for users behind UTC.
const now0 = new Date();
const todayStr = ymd(now0.getFullYear(), now0.getMonth(), now0.getDate());

// Day-of-month from a YYYY-MM-DD string without constructing a Date (which
// would parse as UTC midnight and can display the previous day locally).
const dayOf = (d: string) => Number(d.slice(8, 10));

function MiniMonth({
  year,
  monthIndex,
  accentColor,
  size = 'sm',
}: {
  year: number;
  monthIndex: number;
  accentColor: string;
  size?: 'sm' | 'lg';
}) {
  const weeks = monthMatrix(year, monthIndex);
  const cell = size === 'lg' ? 'h-10 text-sm' : 'h-7 text-xs';
  return (
    <div>
      <p
        className="text-center font-semibold mb-1.5"
        style={{ color: accentColor }}
      >
        {MONTH_NAMES[monthIndex]}
      </p>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_INITIALS.map((w, i) => (
          <div
            key={i}
            className={`text-center font-medium text-gray-400 ${size === 'lg' ? 'text-xs pb-1' : 'text-[10px]'}`}
          >
            {w}
          </div>
        ))}
        {weeks.flat().map((day, idx) => {
          if (day === null) return <div key={idx} className={cell} />;
          const date = ymd(year, monthIndex, day);
          const info = classifyDate(date);
          const isToday = date === todayStr;
          return (
            <div
              key={idx}
              title={info.label ?? undefined}
              className={`flex items-center justify-center rounded ${cell} ${TYPE_CELL[info.type]}`}
              style={isToday ? { outline: `2px solid ${accentColor}`, outlineOffset: '-2px' } : undefined}
              data-testid={`day-${date}`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded bg-red-100 border border-red-200" />
        Public holidays
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded bg-amber-100 border border-amber-200" />
        School holidays
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded bg-white border border-gray-300" />
        School days
      </span>
    </div>
  );
}

function MonthDetail({ year, monthIndex, accentColor }: { year: number; monthIndex: number; accentColor: string }) {
  const holidays = holidaysInMonth(year, monthIndex);
  const events = eventsInMonth(year, monthIndex);
  const fmt = (d: string) => {
    const day = Number(d.slice(8, 10));
    return `${day} ${MONTH_NAMES[monthIndex].slice(0, 3)}`;
  };
  if (!holidays.length && !events.length) {
    return <p className="text-sm text-gray-400">No public holidays or term events this month.</p>;
  }
  return (
    <div className="space-y-4">
      {holidays.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Public holidays</p>
          <ul className="space-y-1.5">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center gap-2 text-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="w-14 text-gray-500 tabular-nums">{fmt(h.date)}</span>
                <span className="text-gray-800">{h.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {events.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Term events</p>
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={`${e.date}-${e.label}`} className="flex items-center gap-2 text-sm">
                <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
                <span className="w-14 text-gray-500 tabular-nums">{fmt(e.date)}</span>
                <span className="text-gray-800">{e.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TermCalendar({ accentColor }: TermCalendarProps) {
  const [view, setView] = useState<'year' | 'month'>('year');
  const now = new Date();
  const initialMonth = now.getFullYear() === CALENDAR_YEAR ? now.getMonth() : 0;
  const [monthIndex, setMonthIndex] = useState(initialMonth);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView('year')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === 'year' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            style={view === 'year' ? { backgroundColor: accentColor } : undefined}
            data-testid="button-view-year"
          >
            <CalendarRange className="h-4 w-4" /> Whole year
          </button>
          <button
            type="button"
            onClick={() => setView('month')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === 'month' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            style={view === 'month' ? { backgroundColor: accentColor } : undefined}
            data-testid="button-view-month"
          >
            <CalendarDays className="h-4 w-4" /> Single month
          </button>
        </div>

        <div className="flex items-center gap-2">
          {view === 'month' && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMonthIndex((m) => (m + 11) % 12)}
                disabled={monthIndex === 0}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="w-32 text-center text-sm font-semibold text-gray-900">
                {MONTH_NAMES[monthIndex]} {CALENDAR_YEAR}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMonthIndex((m) => (m + 1) % 12)}
                disabled={monthIndex === 11}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={() => window.print()} data-testid="button-print-calendar">
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      <Legend />

      {view === 'year' ? (
        <Card>
          <CardHeader>
            <CardTitle>Term Calendar {CALENDAR_YEAR}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_, m) => (
                <MiniMonth key={m} year={CALENDAR_YEAR} monthIndex={m} accentColor={accentColor} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <MiniMonth year={CALENDAR_YEAR} monthIndex={monthIndex} accentColor={accentColor} size="lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{MONTH_NAMES[monthIndex]} highlights</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthDetail year={CALENDAR_YEAR} monthIndex={monthIndex} accentColor={accentColor} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Term summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TERMS.map((t) => (
          <Card key={t.name}>
            <CardContent className="pt-6">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <span className="text-xs font-medium text-gray-500">{t.schoolDays} days</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {dayOf(t.opens)} {MONTH_NAMES[Number(t.opens.slice(5, 7)) - 1].slice(0, 3)}
                {' – '}
                {dayOf(t.closes)} {MONTH_NAMES[Number(t.closes.slice(5, 7)) - 1].slice(0, 3)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full public-holiday list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public holidays {CALENDAR_YEAR}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {PUBLIC_HOLIDAYS.map((h) => {
              const mi = Number(h.date.slice(5, 7)) - 1;
              return (
                <li key={`${h.date}-${h.name}`} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-gray-500 tabular-nums">
                    {Number(h.date.slice(8, 10))} {MONTH_NAMES[mi].slice(0, 3)}
                  </span>
                  <span className="text-gray-800">{h.name}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
