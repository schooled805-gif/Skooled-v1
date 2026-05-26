import React, { useState, useRef } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListStudents, useListClasses, getListStudentsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Search, GraduationCap, Download, Upload, Trash2, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

function generateStudentNumberPreview(schoolName: string, count: number) {
  const prefix = (schoolName ?? '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'STU';
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

function exportToCSV(rows: any[], filename: string) {
  const headers = ['Student Number', 'Full Name', 'Grade', 'Class', 'Date of Birth'];
  const data = rows.map(s => [s.student_number ?? '', s.full_name ?? '', s.grade ?? '', s.class_name ?? '', s.date_of_birth ?? '']);
  const csv = [headers, ...data].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminStudents() {
  const { schoolId, user, profile: adminProfile } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: students, isLoading } = useListStudents(schoolId ? { school_id: schoolId } : undefined);
  const { data: classes } = useListClasses(schoolId ? { school_id: schoolId } : undefined);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: '', email: '', grade: '', class_id: '', date_of_birth: '' });

  const classMap = new Map((classes ?? []).map(c => [c.id, c.name ?? '']));
  const filtered = (students ?? []).filter(s =>
    (s.full_name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
    (s.student_number?.toLowerCase() ?? '').includes(search.toLowerCase())
  );
  const previewNumber = generateStudentNumberPreview(adminProfile?.full_name ?? 'STU', students?.length ?? 0);
  const selectedClass = (classes ?? []).find(c => c.id === form.class_id);

  const handleCreate = async () => {
    if (!schoolId || !user?.id) return;
    if (!form.full_name.trim() || !form.email.trim() || !form.grade.trim()) {
      toast({ title: 'Name, email, and grade are required', variant: 'destructive' }); return;
    }
    if (!form.class_id) {
      toast({ title: 'Class assignment is required', description: 'A student cannot be enrolled without a class.', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/students/full-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(), grade: form.grade.trim(), class_id: form.class_id, date_of_birth: form.date_of_birth || undefined, school_id: schoolId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Failed to create student'); }
      toast({ title: 'Student enrolled!', description: `${form.full_name} has been added and will receive an email invitation.` });
      qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      setOpen(false);
      setForm({ full_name: '', email: '', grade: '', class_id: '', date_of_birth: '' });
    } catch (err: any) {
      toast({ title: 'Failed to add student', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE', headers: { 'x-user-id': user?.id ?? '' } });
      toast({ title: 'Student removed' });
      qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
    } catch { toast({ title: 'Failed to remove student', variant: 'destructive' }); }
  };

  const handleExport = () => {
    if (!students?.length) { toast({ title: 'No students to export' }); return; }
    exportToCSV(students.map(s => ({ ...s, class_name: classMap.get(s.class_id ?? '') ?? '' })), `students-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: 'Exported', description: `${students.length} students exported` });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId || !user?.id) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').filter(Boolean);
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');
      const cols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
      const nameIdx = cols.findIndex(c => c.includes('name'));
      const emailIdx = cols.findIndex(c => c.includes('email'));
      const gradeIdx = cols.findIndex(c => c.includes('grade'));
      const classIdx = cols.findIndex(c => c.includes('class'));
      const dobIdx = cols.findIndex(c => c.includes('dob') || c.includes('birth'));
      if (nameIdx < 0 || emailIdx < 0 || gradeIdx < 0) throw new Error('CSV must have Full Name, Email, and Grade columns');
      const classNameMap = new Map((classes ?? []).map(c => [c.name.toLowerCase(), c.id]));
      let success = 0, failed = 0;
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const full_name = vals[nameIdx] ?? '';
        const email = vals[emailIdx] ?? '';
        const grade = vals[gradeIdx] ?? '';
        const classRaw = classIdx >= 0 ? vals[classIdx] ?? '' : '';
        const class_id = classNameMap.get(classRaw.toLowerCase()) ?? undefined;
        const date_of_birth = dobIdx >= 0 ? vals[dobIdx] ?? '' : '';
        if (!full_name || !email || !grade || !class_id) { failed++; continue; }
        try {
          const r = await fetch('/api/students/full-create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': user.id }, body: JSON.stringify({ full_name, email: email.toLowerCase(), grade, class_id, date_of_birth: date_of_birth || undefined, school_id: schoolId }) });
          if (r.ok) success++; else failed++;
        } catch { failed++; }
      }
      toast({ title: 'Import complete', description: `${success} enrolled${failed > 0 ? `, ${failed} failed` : ''}` });
      qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Students</h1>
            <p className="text-gray-500 mt-1">Manage student enrolment records</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Import CSV
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!students?.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-student">
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>CSV import columns: <strong>Full Name, Email, Grade, Class Name, Date of Birth</strong>. Class Name must match an existing class exactly.</span>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> All Students
                <Badge variant="outline" className="ml-1">{filtered.length}</Badge>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input className="pl-9 w-60" placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-students" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-blue-600" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{search ? 'No results found' : 'No students enrolled yet'}</p>
                {!search && <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Enrol First Student</Button>}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Student ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(student => (
                    <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                      <TableCell className="pl-6 font-mono text-sm text-blue-700 font-medium">{student.student_number ?? '—'}</TableCell>
                      <TableCell className="font-medium">{student.full_name ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{student.grade}</Badge></TableCell>
                      <TableCell className="text-gray-500">
                        {student.class_id ? (classMap.get(student.class_id) ?? student.class_id.slice(0, 8)) : <span className="text-red-400 text-xs">No class assigned</span>}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">{student.date_of_birth ?? '—'}</TableCell>
                      <TableCell>
                        <button onClick={() => handleDelete(student.id, student.full_name ?? 'student')} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Enrol New Student</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              The student will receive an email invitation to set their password and access their portal.
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-xs text-gray-400">Auto-generated Student ID</p>
                <p className="font-mono font-bold text-gray-700 text-lg">{previewNumber}</p>
              </div>
              <Badge variant="outline" className="ml-auto text-xs">Auto</Badge>
            </div>
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" data-testid="input-full-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@school.edu" data-testid="input-email" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Grade <span className="text-red-500">*</span></Label>
                <Input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="e.g. Grade 10" data-testid="input-grade" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Class <span className="text-red-500">*</span></Label>
              <select
                className={`w-full border rounded-md px-3 py-2 text-sm ${!form.class_id ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
                value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))} data-testid="select-class"
              >
                <option value="">— Select a class (required) —</option>
                {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}{c.grade_level ? ` (${c.grade_level})` : ''}</option>)}
              </select>
              {!form.class_id && (
                <p className="text-xs text-orange-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Class assignment is required to complete enrolment</p>
              )}
            </div>
            {selectedClass && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
                <p className="font-medium text-emerald-700">✓ Assigned to: {selectedClass.name}</p>
                <p className="text-emerald-600 text-xs mt-0.5">{selectedClass.grade_level} · {selectedClass.academic_year ?? 'Current year'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.full_name || !form.email || !form.grade || !form.class_id} className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-student">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Enrol Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
