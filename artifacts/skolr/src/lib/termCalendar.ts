// School term calendar data for 2026, replicating the printed Curro 2026 term
// calendar. This is static reference data shown to parents and teachers.

export const CALENDAR_YEAR = 2026;

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface TermEvent {
  date: string; // YYYY-MM-DD
  label: string;
}

export interface Term {
  name: string;
  opens: string; // first school day, YYYY-MM-DD
  closes: string; // last school day, YYYY-MM-DD
  schoolDays: number;
  events: TermEvent[];
}

export interface DateRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export const PUBLIC_HOLIDAYS: PublicHoliday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-03-21', name: 'Human Rights Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-05', name: 'Easter' },
  { date: '2026-04-06', name: 'Family Day' },
  { date: '2026-04-27', name: 'Freedom Day' },
  { date: '2026-05-01', name: "Worker's Day" },
  { date: '2026-06-15', name: 'Special school holiday' },
  { date: '2026-06-16', name: 'Youth Day' },
  { date: '2026-08-09', name: "National Women's Day" },
  { date: '2026-08-10', name: "National Women's Day (observed)" },
  { date: '2026-09-24', name: 'Heritage Day' },
  { date: '2026-09-25', name: 'Special school holiday' },
  { date: '2026-12-16', name: 'Day of Reconciliation' },
  { date: '2026-12-25', name: 'Christmas' },
  { date: '2026-12-26', name: 'Day of Goodwill' },
];

export const TERMS: Term[] = [
  {
    name: 'Term 1',
    opens: '2026-01-14',
    closes: '2026-03-27',
    schoolDays: 53,
    events: [
      { date: '2026-01-05', label: 'Admin & support staff return' },
      { date: '2026-01-12', label: 'Academic staff return' },
      { date: '2026-01-14', label: 'School opens' },
      { date: '2026-03-27', label: 'School closes' },
    ],
  },
  {
    name: 'Term 2',
    opens: '2026-04-08',
    closes: '2026-06-26',
    schoolDays: 54,
    events: [
      { date: '2026-04-07', label: 'Academic staff return' },
      { date: '2026-04-08', label: 'School opens' },
      { date: '2026-06-26', label: 'School closes' },
      { date: '2026-07-01', label: 'Academic staff depart' },
    ],
  },
  {
    name: 'Term 3',
    opens: '2026-07-21',
    closes: '2026-09-23',
    schoolDays: 46,
    events: [
      { date: '2026-07-20', label: 'Academic staff return' },
      { date: '2026-07-21', label: 'School opens' },
      { date: '2026-09-23', label: 'School closes' },
    ],
  },
  {
    name: 'Term 4',
    opens: '2026-10-06',
    closes: '2026-12-09',
    schoolDays: 47,
    events: [
      { date: '2026-10-05', label: 'Academic staff return' },
      { date: '2026-10-06', label: 'School opens' },
      { date: '2026-12-09', label: 'School closes' },
      { date: '2026-12-11', label: 'Academic staff depart' },
      { date: '2026-12-22', label: 'Admin & support staff depart' },
    ],
  },
];

// Periods when the school is closed for holidays (excludes the public holidays,
// which take colour precedence). These are the gaps between term sessions.
export const SCHOOL_HOLIDAY_RANGES: DateRange[] = [
  { start: '2026-01-02', end: '2026-01-13' },
  { start: '2026-03-28', end: '2026-04-07' },
  { start: '2026-06-27', end: '2026-07-20' },
  { start: '2026-09-26', end: '2026-10-05' },
  { start: '2026-12-10', end: '2026-12-31' },
];

const PUBLIC_HOLIDAY_MAP: Record<string, string> = Object.fromEntries(
  PUBLIC_HOLIDAYS.map((h) => [h.date, h.name]),
);

export type DayType = 'public' | 'school-holiday' | 'school-day' | 'none';

export interface DayInfo {
  type: DayType;
  /** Holiday name (public holidays) or term/staff event label, when present. */
  label?: string;
}

/** Pad a number to two digits. */
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Build a YYYY-MM-DD string from a year, 0-based month and day. */
export function ymd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/**
 * Classify a single date. Public holidays win over school holidays, which win
 * over ordinary school days. Weekends within a term are "none" (uncoloured),
 * matching the printed calendar's two-category key.
 */
export function classifyDate(date: string): DayInfo {
  if (PUBLIC_HOLIDAY_MAP[date]) {
    return { type: 'public', label: PUBLIC_HOLIDAY_MAP[date] };
  }
  if (SCHOOL_HOLIDAY_RANGES.some((r) => inRange(date, r))) {
    return { type: 'school-holiday' };
  }
  for (const term of TERMS) {
    if (date >= term.opens && date <= term.closes) {
      const [, , dd] = date.split('-').map(Number);
      const dow = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, dd).getDay();
      if (dow === 0 || dow === 6) return { type: 'none' };
      return { type: 'school-day' };
    }
  }
  return { type: 'none' };
}

/** All term & staff events for a given 0-based month, sorted by date. */
export function eventsInMonth(year: number, monthIndex: number): TermEvent[] {
  const prefix = `${year}-${pad(monthIndex + 1)}-`;
  return TERMS.flatMap((t) => t.events)
    .filter((e) => e.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Public holidays for a given 0-based month, sorted by date. */
export function holidaysInMonth(year: number, monthIndex: number): PublicHoliday[] {
  const prefix = `${year}-${pad(monthIndex + 1)}-`;
  return PUBLIC_HOLIDAYS.filter((h) => h.date.startsWith(prefix)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
