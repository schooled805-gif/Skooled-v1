import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useListApprovals, useCreateApproval, useListEvents, useListStudents, getListApprovalsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TeacherApprovals() {
  const { user, schoolId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: approvals, isLoading } = useListApprovals();
  const { data: events } = useListEvents();
  const { data: students } = useListStudents();
  const createApproval = useCreateApproval();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ event_id: '', student_id: '', parent_user_id: '' });

  const handleCreate = () => {
    if (!schoolId) return;
    createApproval.mutate({
      data: { ...form, school_id: schoolId }
    }, {
      onSuccess: () => {
        toast({ title: 'Approval request created' });
        qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
        setOpen(false);
        setForm({ event_id: '', student_id: '', parent_user_id: '' });
      },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });
  };

  const statusColor = (s: string) => ({ pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', declined: 'bg-red-100 text-red-700' } as Record<string,string>)[s] ?? 'bg-gray-100 text-gray-600';

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Approvals</h1>
            <p className="text-gray-500 mt-1">Manage consent requests</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-new-approval">
            <Plus className="h-4 w-4 mr-2" /> New Request
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-emerald-600" /></div>
        ) : !approvals?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No approval requests</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {approvals.map(a => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{a.event_title ?? 'Event'}</p>
                    <p className="text-sm text-gray-500">{a.student_name}</p>
                    {a.response_comment && <p className="text-xs text-gray-400 italic mt-1">"{a.response_comment}"</p>}
                  </div>
                  <Badge className={`${statusColor(a.status)} hover:opacity-90 text-xs`}>{a.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Approval Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Event ID</Label>
              <Input value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))} placeholder="Event UUID" data-testid="input-event-id" />
            </div>
            <div className="space-y-1">
              <Label>Student ID</Label>
              <Input value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} placeholder="Student UUID" data-testid="input-student-id" />
            </div>
            <div className="space-y-1">
              <Label>Parent User ID</Label>
              <Input value={form.parent_user_id} onChange={e => setForm(f => ({ ...f, parent_user_id: e.target.value }))} placeholder="Parent user UUID" data-testid="input-parent-id" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createApproval.isPending} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-create-approval">
              {createApproval.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
