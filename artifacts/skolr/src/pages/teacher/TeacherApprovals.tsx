import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  useListApprovals, useListEvents, useListStudents, useListClasses, useListSubjects,
  getListApprovalsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RecipientSelector, emptyScope, scopeCount, type RecipientScope } from '@/components/RecipientSelector';

async function apiPost(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error ?? 'Request failed');
  }
  return res.json();
}

export default function TeacherApprovals() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: approvals, isLoading } = useListApprovals();
  const { data: events } = useListEvents();
  const { data: students } = useListStudents();
  const { data: classes } = useListClasses();
  const { data: subjects } = useListSubjects();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState('');
  const [scope, setScope] = useState<RecipientScope>(emptyScope);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!eventId || scopeCount(scope) === 0) return;
    setSubmitting(true);
    try {
      const result = await apiPost('/api/approvals/bulk', token, { event_id: eventId, ...scope });
      toast({ title: 'Approval requests created', description: `${result.created} request(s) sent to parents.` });
      qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
      setOpen(false);
      setEventId('');
      setScope(emptyScope);
    } catch (err: any) {
      toast({ title: 'Could not create', description: err?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) => ({ pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', declined: 'bg-red-100 text-red-700' } as Record<string,string>)[s] ?? 'bg-gray-100 text-gray-600';

  return (
    <PortalLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Approvals</h1>
            <p className="text-gray-500 mt-1">Request consent from parents</p>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Approval Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Event</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)} data-testid="select-event">
                <option value="">Select an event…</option>
                {(events ?? []).map((ev: any) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Recipients</Label>
              <RecipientSelector
                students={(students ?? []) as any}
                classes={(classes ?? []) as any}
                subjects={(subjects ?? []) as any}
                value={scope}
                onChange={setScope}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !eventId || scopeCount(scope) === 0} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-create-approval">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
