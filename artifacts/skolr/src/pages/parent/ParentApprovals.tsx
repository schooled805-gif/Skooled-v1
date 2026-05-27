import React, { useState } from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useListApprovals, useRespondToApproval, getListApprovalsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle, XCircle, Clock, PenLine } from 'lucide-react';
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
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: approvals, isLoading } = useListApprovals({ parent_id: user?.id });
  const respond = useRespondToApproval();

  const [selected, setSelected] = useState<any | null>(null);
  const [action, setAction] = useState<'approved' | 'declined'>('approved');
  const [comment, setComment] = useState('');
  const [consented, setConsented] = useState(false);
  const [signature, setSignature] = useState('');

  const handleOpen = (approval: any, act: 'approved' | 'declined') => {
    setSelected(approval);
    setAction(act);
    setComment('');
    setConsented(false);
    setSignature('');
  };

  const canSubmit = action === 'declined'
    ? true
    : (consented && signature.trim().length > 0);

  const handleSubmit = () => {
    if (!selected) return;
    const fullComment = [
      comment.trim(),
      action === 'approved' && signature.trim() ? `Signed: ${signature.trim()}` : '',
    ].filter(Boolean).join(' | ');

    respond.mutate({ id: selected.id, data: { status: action, response_comment: fullComment || undefined } }, {
      onSuccess: () => {
        toast({ title: action === 'approved' ? 'Approval confirmed' : 'Request declined' });
        qc.invalidateQueries({ queryKey: getListApprovalsQueryKey() });
        setSelected(null);
      },
      onError: () => toast({ title: 'Error', description: 'Could not submit response.', variant: 'destructive' }),
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
                    <p className="font-medium text-gray-900 truncate">{(a as any).event_title ?? 'Event'}</p>
                    <p className="text-sm text-gray-500">{(a as any).student_name ?? 'Student'}</p>
                    {a.response_comment && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{a.response_comment}"</p>
                    )}
                  </div>
                  <Badge className={`${statusBadge(a.status)} hover:opacity-90 text-xs`}>{a.status}</Badge>
                  {a.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleOpen(a, 'approved')}
                        data-testid={`button-approve-${a.id}`}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => handleOpen(a, 'declined')}
                        data-testid={`button-decline-${a.id}`}>
                        Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action === 'approved'
                ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                : <XCircle className="h-5 w-5 text-red-500" />}
              {action === 'approved' ? 'Approve Request' : 'Decline Request'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selected && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{selected.event_title ?? 'Event'}</p>
                <p className="text-gray-500 text-xs mt-0.5">for {selected.student_name ?? 'student'}</p>
              </div>
            )}

            {action === 'approved' && (
              <>
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Checkbox
                    id="consent-check"
                    checked={consented}
                    onCheckedChange={(v) => setConsented(v === true)}
                    data-testid="checkbox-consent"
                  />
                  <Label htmlFor="consent-check" className="text-sm text-gray-700 leading-snug cursor-pointer">
                    I consent to this request and give permission for{' '}
                    <span className="font-medium">{selected?.student_name ?? 'my child'}</span>{' '}
                    to participate in this activity.
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <PenLine className="h-3.5 w-3.5 text-gray-500" />
                    Type your full name to sign <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder={profile?.full_name ?? 'Your full name'}
                    value={signature}
                    onChange={e => setSignature(e.target.value)}
                    data-testid="input-signature"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-600">
                Comment <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={action === 'approved' ? 'Any additional notes…' : 'Reason for declining…'}
                data-testid="input-approval-comment"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={respond.isPending || !canSubmit}
              className={action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              data-testid="button-confirm-response"
            >
              {respond.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : action === 'approved' ? 'Confirm Approval' : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
