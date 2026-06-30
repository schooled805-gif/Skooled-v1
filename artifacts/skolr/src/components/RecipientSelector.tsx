import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, GraduationCap, BookOpen, UserRound } from 'lucide-react';

export interface RecipientScope {
  student_ids: string[];
  class_ids: string[];
  grade_levels: string[];
  subject_ids: string[];
}

export interface SelectableStudent { id: string; full_name: string | null; grade: string | null; class_id: string | null; }
export interface SelectableClass { id: string; name: string; grade_level: string | null; }
export interface SelectableSubject { id: string; name: string; }

interface Props {
  students: SelectableStudent[];
  classes: SelectableClass[];
  subjects: SelectableSubject[];
  value: RecipientScope;
  onChange: (scope: RecipientScope) => void;
}

type Mode = 'individual' | 'class' | 'grade' | 'subject';

const MODES: { key: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'grade', label: 'By Grade', icon: GraduationCap },
  { key: 'class', label: 'By Class', icon: Users },
  { key: 'subject', label: 'By Subject', icon: BookOpen },
  { key: 'individual', label: 'Individual', icon: UserRound },
];

export const emptyScope: RecipientScope = { student_ids: [], class_ids: [], grade_levels: [], subject_ids: [] };

export function scopeCount(scope: RecipientScope): number {
  return scope.student_ids.length + scope.class_ids.length + scope.grade_levels.length + scope.subject_ids.length;
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function RecipientSelector({ students, classes, subjects, value, onChange }: Props) {
  const [mode, setMode] = React.useState<Mode>('grade');

  const grades = Array.from(new Set(students.map((s) => s.grade).filter((g): g is string => !!g))).sort();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border transition-colors ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              data-testid={`tab-recipients-${m.key}`}
            >
              <Icon className="h-4 w-4" /> {m.label}
            </button>
          );
        })}
      </div>

      <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
        {mode === 'grade' && (grades.length ? grades.map((g) => (
          <label key={g} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={value.grade_levels.includes(g)} onChange={() => onChange({ ...value, grade_levels: toggle(value.grade_levels, g) })} data-testid={`recipient-grade-${g}`} />
            <span>Grade {g}</span>
          </label>
        )) : <p className="px-3 py-4 text-sm text-gray-400">No grades available</p>)}

        {mode === 'class' && (classes.length ? classes.map((c) => (
          <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={value.class_ids.includes(c.id)} onChange={() => onChange({ ...value, class_ids: toggle(value.class_ids, c.id) })} data-testid={`recipient-class-${c.id}`} />
            <span>{c.name}{c.grade_level ? ` (Grade ${c.grade_level})` : ''}</span>
          </label>
        )) : <p className="px-3 py-4 text-sm text-gray-400">No classes available</p>)}

        {mode === 'subject' && (subjects.length ? subjects.map((s) => (
          <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={value.subject_ids.includes(s.id)} onChange={() => onChange({ ...value, subject_ids: toggle(value.subject_ids, s.id) })} data-testid={`recipient-subject-${s.id}`} />
            <span>{s.name}</span>
          </label>
        )) : <p className="px-3 py-4 text-sm text-gray-400">No subjects available</p>)}

        {mode === 'individual' && (students.length ? students.map((s) => (
          <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={value.student_ids.includes(s.id)} onChange={() => onChange({ ...value, student_ids: toggle(value.student_ids, s.id) })} data-testid={`recipient-student-${s.id}`} />
            <span>{s.full_name ?? 'Student'}{s.grade ? ` — Grade ${s.grade}` : ''}</span>
          </label>
        )) : <p className="px-3 py-4 text-sm text-gray-400">No students available</p>)}
      </div>

      {scopeCount(value) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.grade_levels.map((g) => <Badge key={`g${g}`} variant="outline" className="text-xs">Grade {g}</Badge>)}
          {value.class_ids.map((id) => <Badge key={`c${id}`} variant="outline" className="text-xs">{classes.find((c) => c.id === id)?.name ?? 'Class'}</Badge>)}
          {value.subject_ids.map((id) => <Badge key={`s${id}`} variant="outline" className="text-xs">{subjects.find((s) => s.id === id)?.name ?? 'Subject'}</Badge>)}
          {value.student_ids.map((id) => <Badge key={`st${id}`} variant="outline" className="text-xs">{students.find((s) => s.id === id)?.full_name ?? 'Student'}</Badge>)}
        </div>
      )}
      <Label className="text-xs text-gray-400 font-normal">Selections combine — parents of all matched students receive this.</Label>
    </div>
  );
}
