import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListReports, useCreateReport, getListReportsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminReports() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: reports, isLoading } = useListReports();
  const create = useCreateReport();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: '', title: '', term: '', year: new Date().getFullYear(), file_url: '', visible_to_student: false });

  const handleCreate = () => {
    if (!schoolId) return;
    create.mutate({ data: { ...form, school_id: schoolId } }, {
      onSuccess: () => {
        toast({ title: 'Report uploaded' });
        qc.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setOpen(false);
        setForm({ student_id: '', title: '', term: '', year: new Date().getFullYear(), file_url: '', visible_to_student: false });
      },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports</h1>
            <p className="text-gray-500 mt-1">Upload and manage student reports</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-upload-report">
            <Plus className="h-4 w-4 mr-2" /> Upload Report
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : !reports?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No reports uploaded yet</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <Card key={r.id} data-testid={`card-report-${r.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <FileText className="h-8 w-8 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{r.title}</p>
                    <p className="text-sm text-gray-500">{r.student_name} — Term {r.term}, {r.year}</p>
                  </div>
                  <Badge className={r.visible_to_student ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'} variant="outline">
                    {r.visible_to_student ? 'Visible' : 'Hidden'}
                  </Badge>
                  <a href={r.file_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" data-testid={`button-download-${r.id}`}>
                      <Download className="h-4 w-4 mr-1" /> View
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Report</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1"><Label>Student ID</Label><Input value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} placeholder="Student UUID" data-testid="input-student-id" /></div>
            <div className="space-y-1"><Label>Report Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Term 1 Report" data-testid="input-title" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Term</Label><Input value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} placeholder="e.g. 1" data-testid="input-term" /></div>
              <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} data-testid="input-year" /></div>
            </div>
            <div className="space-y-1"><Label>File URL (Supabase Storage)</Label><Input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." data-testid="input-file-url" /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="visible" checked={form.visible_to_student} onChange={e => setForm(f => ({ ...f, visible_to_student: e.target.checked }))} data-testid="checkbox-visible" />
              <Label htmlFor="visible">Visible to student</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-report">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
