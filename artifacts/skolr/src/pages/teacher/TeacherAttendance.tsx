import React, { useEffect, useMemo, useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useListClasses, useListSubjects, useListStudents } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ClipboardCheck, Check } from 'lucide-react';

type Status = 'present' | 'absent' | 'late' | 'excused';
interface AttendanceRow { student_id: string; class_id: string | null; subject_id: string | null; date: string; status: string; }

async function apiFetch(url: string, token: string, options?: Omit<RequestInit, 'body'> & { body?: unknown }) {
  const { body, ...rest } = options ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(rest.headers ?? {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error ?? 'Request failed'); }
  if (res.status === 204) return null;
  return res.json();
}

const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: 'present', label: 'Present', color: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'absent', label: 'Absent', color: 'bg-red-600 text-white border-red-600' },
  { key: 'late', label: 'Late', color: 'bg-amber-500 text-white border-amber-500' },
  { key: 'excused', label: 'Excused', color: 'bg-blue-600 text-white border-blue-600' },
];

export default function TeacherAttendance() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const qc = useQueryClient();
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);

  const { data: classes } = useListClasses();
  const { data: subjects } = useListSubjects();
  const { data: students } = useListStudents();

  const roster = useMemo(
    () => (students ?? []).filter((s: any) => classId && s.class_id === classId),
    [students, classId]
  );

  const { data: existing } = useQuery<AttendanceRow[]>({
    queryKey: ['attendance', date, classId, subjectId],
    queryFn: () => apiFetch(`/api/attendance?date=${date}&class_id=${classId}${subjectId ? `&subject_id=${subjectId}` : ''}`, token),
    enabled: !!token && !!classId && !!date,
  });

  useEffect(() => {
    const next: Record<string, Status> = {};
    for (const s of roster) next[(s as any).id] = 'present';
    for (const r of existing ?? []) {
      if (['present', 'absent', 'late', 'excused'].includes(r.status)) next[r.student_id] = r.status as Status;
    }
    setMarks(next);
  }, [existing, roster]);

  const handleSave = async () => {
    if (!classId) { toast({ title: 'Select a class first', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const records = roster.map((s: any) => ({ student_id: s.id, status: marks[s.id] ?? 'present' }));
      const result = await apiFetch('/api/attendance/mark', token, {
        method: 'POST',
        body: { date, class_id: classId, subject_id: subjectId || undefined, records },
      });
      toast({ title: 'Register saved', description: `${result.saved} student(s) recorded.` });
      qc.invalidateQueries({ queryKey: ['attendance', date, classId, subjectId] });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const counts = STATUSES.map((s) => ({ ...s, n: roster.filter((r: any) => (marks[r.id] ?? 'present') === s.key).length }));

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Attendance Register</h1>
          <p className="text-gray-500 mt-1">Mark who's present in your class</p>
        </div>

        <Card>
          <CardContent className="p-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-date" />
            </div>
            <div className="space-y-1">
              <Label>Class</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)} data-testid="select-class">
                <option value="">Select a class…</option>
                {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Subject <span className="text-gray-400 font-normal">(optional)</span></Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} data-testid="select-subject">
                <option value="">General</option>
                {(subjects ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {!classId ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Select a class to load the roster</p>
          </CardContent></Card>
        ) : !roster.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No students in this class</CardContent></Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {counts.map((c) => <span key={c.key} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{c.label}: <strong>{c.n}</strong></span>)}
            </div>
            <Card>
              <CardContent className="p-0 divide-y">
                {roster.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid={`row-student-${s.id}`}>
                    <span className="text-sm font-medium text-gray-900">{s.full_name ?? 'Student'}</span>
                    <div className="flex gap-1.5">
                      {STATUSES.map((st) => {
                        const active = (marks[s.id] ?? 'present') === st.key;
                        return (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => setMarks((m) => ({ ...m, [s.id]: st.key }))}
                            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${active ? st.color : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                            data-testid={`button-${st.key}-${s.id}`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-save-register">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} Save Register
              </Button>
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
