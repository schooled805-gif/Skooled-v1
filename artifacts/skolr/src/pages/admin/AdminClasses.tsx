import React, { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useListClasses, useCreateClass, getListClassesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface School { id: string; name: string; }

export default function AdminClasses() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: classes, isLoading } = useListClasses(schoolId ? { school_id: schoolId } : undefined);
  const create = useCreateClass();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', grade_level: '', academic_year: '' });

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
    create.mutate({ data: { ...form, school_id: resolvedSchoolId } }, {
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

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !classes?.length ? (
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
            {classes.map(cls => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow" data-testid={`card-class-${cls.id}`}>
                <CardContent className="p-4">
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
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{cls.grade_level ?? '—'}</Badge>
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
    </PortalLayout>
  );
}
