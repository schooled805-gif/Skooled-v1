import React, { useState, useRef } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useListProfiles, getListProfilesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, UserRound, Mail, Phone, Trash2, BookOpen, Download, Upload, AlertCircle } from 'lucide-react';

function exportTeachersCSV(teachers: any[]) {
  const headers = ['Full Name', 'Email', 'Phone'];
  const rows = teachers.map(t => [t.full_name ?? '', t.email ?? '', t.phone ?? '']);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `teachers-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTeachers() {
  const { schoolId, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: teachers, isLoading } = useListProfiles(schoolId ? { role: 'teacher', school_id: schoolId } : { role: 'teacher' });
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (!form.full_name || !form.email) { toast({ title: 'Name and email are required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/teachers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id ?? '' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email, phone: form.phone || undefined, school_id: schoolId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Failed to add teacher'); }
      const result = await res.json();
      toast({
        title: 'Teacher added',
        description: result.invited
          ? `Invitation email sent to ${form.email}`
          : `${form.full_name} added. Share the signup link: ${window.location.origin}/signup`,
      });
      qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
      setAddOpen(false);
      setForm({ full_name: '', email: '', phone: '' });
    } catch (err: any) {
      toast({ title: 'Failed to add teacher', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the school?`)) return;
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE', headers: { 'x-user-id': user?.id ?? '' } });
      if (!res.ok) throw new Error();
      toast({ title: 'Teacher removed' });
      qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    } catch { toast({ title: 'Failed to remove teacher', variant: 'destructive' }); }
  };

  const handleExport = () => {
    if (!teachers?.length) { toast({ title: 'No teachers to export' }); return; }
    exportTeachersCSV(teachers);
    toast({ title: 'Exported', description: `${teachers.length} teachers exported` });
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
      const phoneIdx = cols.findIndex(c => c.includes('phone'));
      if (nameIdx < 0 || emailIdx < 0) throw new Error('CSV must have Full Name and Email columns');
      let success = 0, failed = 0;
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const full_name = vals[nameIdx] ?? ''; const email = vals[emailIdx] ?? ''; const phone = phoneIdx >= 0 ? vals[phoneIdx] ?? '' : '';
        if (!full_name || !email) { failed++; continue; }
        try {
          const r = await fetch('/api/teachers/invite', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': user.id }, body: JSON.stringify({ full_name, email: email.toLowerCase(), phone: phone || undefined, school_id: schoolId }) });
          if (r.ok) success++; else failed++;
        } catch { failed++; }
      }
      toast({ title: 'Import complete', description: `${success} teachers added${failed > 0 ? `, ${failed} failed` : ''}` });
      qc.invalidateQueries({ queryKey: getListProfilesQueryKey() });
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Teachers</h1>
            <p className="text-gray-500 mt-1">Manage teaching staff at your school</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Import CSV
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!teachers?.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-teacher">
              <Plus className="h-4 w-4 mr-2" /> Add Teacher
            </Button>
          </div>
        </div>

        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm text-emerald-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Teachers are added by school admins only. When added, they receive an email invitation to set their password and access their portal. CSV format: <strong>Full Name, Email, Phone</strong></span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !teachers?.length ? (
          <Card>
            <CardContent className="py-16 text-center">
              <UserRound className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No teachers yet</p>
              <p className="text-gray-400 text-sm mt-1">Add teachers — they'll receive an email invitation</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add First Teacher
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(teachers ?? []).map(teacher => (
              <Card key={teacher.id} className="hover:shadow-md transition-shadow" data-testid={`card-teacher-${teacher.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-emerald-700 font-bold text-sm">{teacher.full_name?.[0]?.toUpperCase() ?? 'T'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{teacher.full_name}</p>
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1"><Mail className="h-3 w-3" /> {teacher.email}</p>
                        {teacher.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {teacher.phone}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">Teacher</Badge>
                      <button onClick={() => handleDelete(teacher.id, teacher.full_name ?? 'teacher')} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-testid={`btn-delete-teacher-${teacher.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                    <BookOpen className="h-3.5 w-3.5" /><span>Invited via email</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Teacher</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
              The teacher will receive an email invitation to set their password and access their portal.
            </div>
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" data-testid="input-teacher-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@school.edu" data-testid="input-teacher-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.full_name || !form.email} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-teacher">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
