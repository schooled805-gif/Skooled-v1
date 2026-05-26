import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useListApprovals, useRespondToApproval, getListApprovalsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const statusIcon = (status: string) => {
  if (status === 'approved') return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (status === 'declined') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
};

export default function ParentApprovals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: approvals, isLoading } = useListApprovals({ parent_id: user?.id });
  const respond = useRespondToApproval();
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<'approved' | 'declined'>('approved');
  const [comment, setComment] = useState('');

  const handleOpen = (id: string, act: 'approved' | 'declined') => {
    setSelected(id);
    setAction(act);
    setComment('');
  };

  const handleSubmit = () => {
    if (!selected) return;
    respond.mutate({ id: selected, data: { status: action, response_comment: comment } }, {
      onSuccess: () => {
        toast({ title: `Approval ${action}` });
        qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
        setSelected(null);
      },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });
  };

  return (
    <PortalLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Approvals</h1>
          <p className="text-gray-500 mt-1">Consent requests requiring your response</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-purple-600" /></div>
        ) : !approvals?.length ? (
          <Card><CardContent className="py-12 text-center text-gray-400">No approval requests</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {approvals.map(a => (
              <Card key={a.id} data-testid={`card-approval-${a.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  {statusIcon(a.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.event_title ?? 'Event'}</p>
                    <p className="text-sm text-gray-500">{a.student_name ?? 'Student'}</p>
                    {a.response_comment && <p className="text-xs text-gray-400 mt-1 italic">"{a.response_comment}"</p>}
                  </div>
                  <Badge className={`${statusBadge(a.status)} hover:opacity-90 text-xs`}>{a.status}</Badge>
                  {a.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleOpen(a.id, 'approved')} data-testid={`button-approve-${a.id}`}>Approve</Button>
                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleOpen(a.id, 'declined')} data-testid={`button-decline-${a.id}`}>Decline</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === 'approved' ? 'Approve' : 'Decline'} Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">Add an optional comment:</p>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment..." data-testid="input-approval-comment" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={respond.isPending}
              className={action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              data-testid="button-confirm-response"
            >
              {respond.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm ${action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
