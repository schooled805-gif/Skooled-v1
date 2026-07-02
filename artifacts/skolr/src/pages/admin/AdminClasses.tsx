import React, { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useListClasses, useCreateClass, getListClassesQueryKey, useListProfiles } from '@workspace/api-client-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePhase } from '@/contexts/PhaseContext';
import { PhaseTabs } from '@/components/PhaseTabs';
import { Loader2, Plus, BookOpen, Ban, CircleCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface School { id: string; name: string; }

export default function AdminClasses() {
  const { schoolId, session } = useAuth();
  const { multiPhase, activePhase } = usePhase();
  const token = session?.access_token ?? '';
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: classes, isLoading } = useListClasses(schoolId ? { school_id: schoolId } : undefined);
  const { data: profiles } = useListProfiles(schoolId ? { school_id: schoolId } : undefined);
  const teachers = ((profiles ?? []) as any[]).filter((p) => p.role === 'teacher');
  const phaseTeachers = teachers.filter((t) => !multiPhase || t.phase === activePhase || !t.phase);
  const visibleClasses = (classes ?? []).filter(
    (c) => !multiPhase || (c as any).phase === activePhase || !(c as any).phase,
  );

  const [savingTeacherIds, setSavingTeacherIds] = useState<Set<string>>(new Set());
  const assignTeacher = useMutation({
    mutationFn: async ({ id, teacher_id }: { id: string; teacher_id: string | null }) => {
      const res = await fetch(`/api/classes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacher_id }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any)?.error ?? 'Failed');
      return res.json();
    },
    onMutate: ({ id }) => {
      setSavingTeacherIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListClassesQueryKey() });
      toast({ title: 'Class teacher updated' });
    },
    onError: (err: any) => toast({ title: 'Could not update class teacher', description: err?.message, variant: 'destructive' }),
    onSettled: (_data, _err, { id }) => {
      setSavingTeacherIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    },
  });
  const create = useCreateClass();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', grade_level: '', academic_year: '' });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'disabled' }) => {
      const res = await fetch(`/api/classes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any)?.error ?? 'Failed');
      return res.json();
    },
    onSuccess: (_d, { status }) => {
      qc.invalidateQueries({ queryKey: getListClassesQueryKey() });
      toast({ title: status === 'disabled' ? 'Class disabled' : 'Class enabled' });
    },
    onError: (err: any) => toast({ title: 'Action failed', description: err?.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok && res.status !== 204) throw new Error(((await res.json().catch(() => ({}))) as any)?.error ?? 'Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListClassesQueryKey() });
      setDeleteTarget(null);
      toast({ title: 'Class removed' });
    },
    onError: (err: any) => toast({ title: 'Could not remove class', description: err?.message, variant: 'destructive' }),
  });

  // Fallback school selection if schoolId not in auth context
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const needsSchoolPicker = !schoolId;

  useEffect(() => {
    if (needsSchoolPicker && open) {
      fetch('/api/schools').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setSchools(d);
      }).catch(() => {});
    }
  }, [needsSchoolPicker, open]);

  const resolvedSchoolId = schoolId ?? selectedSchoolId;

  const handleCreate = () => {
    if (!resolvedSchoolId) {
      toast({ title: 'Please select a school first', variant: 'destructive' });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: 'Class name is required', variant: 'destructive' });
      return;
    }
    create.mutate({ data: { ...form, school_id: resolvedSchoolId, ...(multiPhase && activePhase ? { phase: activePhase } : {}) } as any }, {
      onSuccess: () => {
        toast({ title: 'Class created successfully' });
        qc.invalidateQueries({ queryKey: getListClassesQueryKey() });
        setOpen(false);
        setForm({ name: '', grade_level: '', academic_year: '' });
        setSelectedSchoolId('');
      },
      onError: (err: any) => toast({
        title: 'Failed to create class',
        description: err?.message ?? 'Please try again',
        variant: 'destructive',
      }),
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Classes</h1>
            <p className="text-gray-500 mt-1">Manage school classes</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-new-class">
            <Plus className="h-4 w-4 mr-2" /> New Class
          </Button>
        </div>

        <PhaseTabs />

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !visibleClasses.length ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No classes yet</p>
              <p className="text-gray-400 text-sm mt-1">Create your first class to get started</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> New Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleClasses.map(cls => (
              <Card key={cls.id} className={`hover:shadow-md transition-shadow ${(cls as any).status === 'disabled' ? 'opacity-60' : ''}`} data-testid={`card-class-${cls.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{cls.name}</p>
                        <p className="text-xs text-gray-400">{cls.academic_year ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{cls.grade_level ?? '—'}</Badge>
                      {(cls as any).status === 'disabled' && <Badge className="bg-gray-200 text-gray-600 hover:bg-gray-200">Disabled</Badge>}
                    </div>
                  </div>
                  <div className="space-y-1 pt-1 border-t">
                    <p className="text-xs text-gray-400">Class Teacher</p>
                    <select
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm"
                      value={(cls as any).teacher_id ?? ''}
                      disabled={savingTeacherIds.has(cls.id)}
                      onChange={(e) => assignTeacher.mutate({ id: cls.id, teacher_id: e.target.value || null })}
                      data-testid={`select-class-teacher-${cls.id}`}
                    >
                      <option value="">— No class teacher —</option>
                      {phaseTeachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t">
                    {(cls as any).status === 'disabled' ? (
                      <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1" disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: cls.id, status: 'active' })} data-testid={`button-enable-${cls.id}`}>
                        <CircleCheck className="h-3.5 w-3.5" /> Enable
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50 gap-1" disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: cls.id, status: 'disabled' })} data-testid={`button-disable-${cls.id}`}>
                        <Ban className="h-3.5 w-3.5" /> Disable
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1" disabled={remove.isPending}
                      onClick={() => setDeleteTarget(cls)} data-testid={`button-delete-${cls.id}`}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {needsSchoolPicker && (
              <div className="space-y-1.5">
                <Label>School <span className="text-red-500">*</span></Label>
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                  <SelectTrigger data-testid="select-school">
                    <SelectValue placeholder="Select a school…" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {schools.length === 0 && (
                  <p className="text-xs text-amber-600">No schools found. Create a school first.</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Class Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 10A"
                data-testid="input-class-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Grade Level</Label>
              <Input
                value={form.grade_level}
                onChange={e => setForm(f => ({ ...f, grade_level: e.target.value }))}
                placeholder="e.g. Grade 10"
                data-testid="input-grade-level"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <Input
                value={form.academic_year}
                onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                placeholder="e.g. 2025/2026"
                data-testid="input-academic-year"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={create.isPending || (!resolvedSchoolId)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-class"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this class?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {deleteTarget?.name ?? 'this class'}. If students are still enrolled the delete will be blocked — disable the class instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (deleteTarget) remove.mutate(deleteTarget.id); }}
              data-testid="button-confirm-delete-class"
            >
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete class'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
