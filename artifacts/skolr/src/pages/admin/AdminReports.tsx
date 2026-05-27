import React, { useState, useRef } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useListReports, useListStudents, getListReportsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, FileText, Download, Upload, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminReports() {
  const { schoolId, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: reports, isLoading } = useListReports();
  const { data: students } = useListStudents(schoolId ? { school_id: schoolId } : undefined);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    student_id: '',
    title: '',
    term: '',
    year: new Date().getFullYear(),
    visible_to_student: false,
    file_url: '',
    file_name: '',
    grade: '',
    subject: '',
    teacher_name: '',
    comments: '',
    score: '',
  });

  const filtered = (reports ?? []).filter(r =>
    (r.title?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
    (r.student_name?.toLowerCase() ?? '').includes(search.toLowerCase())
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 10MB', variant: 'destructive' }); return;
    }
    setUploadingFile(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/reports/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id ?? '' },
        body: JSON.stringify({ file_data: base64, file_name: file.name }),
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setForm(f => ({ ...f, file_url: url, file_name: file.name }));
      toast({ title: 'File ready', description: file.name });
    } catch {
      toast({ title: 'Upload failed', description: 'Could not process the file', variant: 'destructive' });
    } finally { setUploadingFile(false); }
  };

  const handleCreate = async () => {
    if (!schoolId) return;
    if (!form.student_id || !form.title || !form.term || !form.file_url) {
      toast({ title: 'Student, title, term, and file are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        student_id: form.student_id,
        title: form.title,
        term: form.term,
        year: form.year,
        file_url: form.file_url,
        visible_to_student: form.visible_to_student,
        school_id: schoolId,
      };
      if (form.grade.trim()) payload.grade = form.grade.trim();
      if (form.subject.trim()) payload.subject = form.subject.trim();
      if (form.teacher_name.trim()) payload.teacher_name = form.teacher_name.trim();
      if (form.comments.trim()) payload.comments = form.comments.trim();
      if (form.score.trim()) payload.score = parseFloat(form.score);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id ?? '' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save report');
      toast({ title: 'Report uploaded', description: `${form.title} has been saved` });
      qc.invalidateQueries({ queryKey: getListReportsQueryKey() });
      setOpen(false);
      setForm({ student_id: '', title: '', term: '', year: new Date().getFullYear(), visible_to_student: false, file_url: '', file_name: '', grade: '', subject: '', teacher_name: '', comments: '', score: '' });
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      toast({ title: 'Error saving report', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <PortalLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports</h1>
            <p className="text-gray-500 mt-1">Upload and manage student progress reports</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="button-upload-report">
            <Plus className="h-4 w-4 mr-2" /> Upload Report
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9 max-w-xs" placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{search ? 'No reports found' : 'No reports uploaded yet'}</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <Card key={r.id} data-testid={`card-report-${r.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{r.title}</p>
                        {r.grade && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">{r.grade}</span>
                        )}
                        {r.score != null && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">{r.score}%</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {r.student_name} — Term {r.term}, {r.year}
                        {r.subject ? ` · ${r.subject}` : ''}
                        {r.teacher_name ? ` · ${r.teacher_name}` : ''}
                      </p>
                      {r.comments && (
                        <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">"{r.comments}"</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={r.visible_to_student ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}>
                        {r.visible_to_student ? 'Visible' : 'Hidden'}
                      </Badge>
                      <a href={r.file_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" data-testid={`button-download-${r.id}`}>
                          <Download className="h-4 w-4 mr-1" /> View
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Student Report</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Student <span className="text-red-500">*</span></Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} data-testid="select-student">
                <option value="">— Select student —</option>
                {(students ?? []).map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.id} ({s.student_number ?? 'no ID'})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Report Title <span className="text-red-500">*</span></Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Term 1 Progress Report" data-testid="input-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Term <span className="text-red-500">*</span></Label>
                <Input value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} placeholder="e.g. 1" data-testid="input-term" />
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} data-testid="input-year" />
              </div>
            </div>

            {/* File upload from computer */}
            <div className="space-y-1.5">
              <Label>Report File <span className="text-red-500">*</span></Label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={handleFileSelect} />
                {uploadingFile ? (
                  <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /><p className="text-sm text-gray-500">Processing file…</p></div>
                ) : form.file_name ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <p className="text-sm font-medium text-gray-700">{form.file_name}</p>
                    <p className="text-xs text-gray-400">Click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">Click to select a file from your computer</p>
                    <p className="text-xs text-gray-400">PDF, DOC, DOCX, JPG, PNG — max 10MB</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Grade</Label>
                <Input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} placeholder="e.g. A, B+, 85%" data-testid="input-grade" />
              </div>
              <div className="space-y-1.5">
                <Label>Score (%)</Label>
                <Input type="number" min="0" max="100" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="e.g. 87" data-testid="input-score" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Mathematics" data-testid="input-subject" />
            </div>
            <div className="space-y-1.5">
              <Label>Teacher Name</Label>
              <Input value={form.teacher_name} onChange={e => setForm(f => ({ ...f, teacher_name: e.target.value }))} placeholder="e.g. Mrs Smith" data-testid="input-teacher-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Comments</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={form.comments}
                onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                placeholder="Teacher's comments about the student's progress…"
                data-testid="textarea-comments"
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="visible" checked={form.visible_to_student} onChange={e => setForm(f => ({ ...f, visible_to_student: e.target.checked }))} data-testid="checkbox-visible" className="rounded" />
              <Label htmlFor="visible" className="cursor-pointer">Make visible to student immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.student_id || !form.title || !form.term || !form.file_url} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-report">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Upload Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
