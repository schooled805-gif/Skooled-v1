import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListStudents, useCreateStudent, useListClasses, getListStudentsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Search, GraduationCap } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function AdminStudents() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: students, isLoading } = useListStudents(schoolId ? { school_id: schoolId } : undefined);
  const { data: classes } = useListClasses(schoolId ? { school_id: schoolId } : undefined);
  const create = useCreateStudent();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ profile_id: '', class_id: '', grade: '', date_of_birth: '', student_number: '' });

  const filtered = (students ?? []).filter(s =>
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(search.toLowerCase())
  );

  const classMap = new Map((classes ?? []).map(c => [c.id, c.name]));

  const handleCreate = () => {
    if (!schoolId) return;
    create.mutate({
      data: {
        profile_id: form.profile_id,
        class_id: form.class_id || undefined,
        grade: form.grade,
        date_of_birth: form.date_of_birth || undefined,
        student_number: form.student_number || undefined,
        school_id: schoolId,
      }
    }, {
      onSuccess: () => {
        toast({ title: 'Student created' });
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setOpen(false);
        setForm({ profile_id: '', class_id: '', grade: '', date_of_birth: '', student_number: '' });
      },
      onError: () => toast({ title: 'Error creating student', variant: 'destructive' }),
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Students</h1>
            <p className="text-gray-500 mt-1">Manage student enrolment records</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-student">
            <Plus className="h-4 w-4 mr-2" /> Add Student
          </Button>
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
                <Input
                  className="pl-9 w-60"
                  placeholder="Search name or number…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search-students"
                />
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
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead>Student #</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>DOB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(student => (
                    <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                      <TableCell className="pl-6 font-medium">{student.full_name ?? '—'}</TableCell>
                      <TableCell className="text-gray-500 font-mono text-sm">{student.student_number ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.grade}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {student.class_id ? (classMap.get(student.class_id) ?? student.class_id.slice(0, 8)) : '—'}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">{student.date_of_birth ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Profile ID</Label>
              <Input value={form.profile_id} onChange={e => setForm(f => ({ ...f, profile_id: e.target.value }))} placeholder="Profile UUID (must exist)" data-testid="input-profile-id" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Grade</Label>
                <Input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="e.g. Grade 10" data-testid="input-grade" />
              </div>
              <div className="space-y-1">
                <Label>Student Number</Label>
                <Input value={form.student_number} onChange={e => setForm(f => ({ ...f, student_number: e.target.value }))} placeholder="e.g. STU001" data-testid="input-student-number" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Class</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.class_id}
                onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                data-testid="select-class"
              >
                <option value="">— No class —</option>
                {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Date of Birth (optional)</Label>
              <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} data-testid="input-dob" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-create-student">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
